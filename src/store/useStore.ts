import { create } from "zustand";
import { isFirstLaunch, loadAppData, saveAppData } from "@/lib/storage";
import { pullFromServer, pushToServer } from "@/lib/syncApi";
import type {
  Account,
  Budget,
  Category,
  CategoryType,
  Transaction,
  DisciplineState,
  Loan,
  LoanPayment,
  SafeToSpendMetrics,
  SafeToSpendStatus,
} from "@/lib/types";
import {
  calculateSafeToSpendToday,
  calculateDisciplineDebt,
  getSafeToSpendStatus,
  getLoanOutstanding,
  getBudgetPlannedAmount,
  getMonthSummary,
  getTransactionReversal,
  DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD,
  type MonthSummary,
} from "@/utils/calculations";
import {
  applyPullResult,
  applyPushResult,
  collectDirtyRecords,
  hasDirtyRecords,
  isEmptyPullResult,
} from "@/utils/sync";

const genId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
const now = (): string => new Date().toISOString();

export interface AddIncomeParams {
  amount: number;
  spendableAccountId: string;
  protectedAccountId: string;
  selectedSavingsAmount: number;
  date: string;
  categoryId?: string;
  note?: string;
}

export interface AddExpenseParams {
  amount: number;
  accountId: string;
  categoryId: string;
  date: string;
  note?: string;
}

export interface AddTransferParams {
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  date: string;
  note?: string;
  reason?: string;
  countsAsDebtRepayment?: boolean;
  /** Internal use only (not exposed on the add-transaction form) — set when this transfer is the onward leg of a loan repayment, so transaction-detail.tsx locks it the same as the repayment itself. */
  loanPaymentId?: string | null;
}

export interface AddAdjustmentParams {
  accountId: string;
  /** Signed: positive corrects the balance upward, negative corrects it downward. */
  delta: number;
  date: string;
  /** Required — an adjustment has no category, so the note is the only record of why the balance moved. */
  note: string;
}

export interface AddLoanParams {
  borrowerName: string;
  principal: number;
  sourceAccountId: string;
  dateLent: string;
  expectedRepaymentDate?: string | null;
  note?: string;
}

export interface RecordLoanRepaymentParams {
  loanId: string;
  amount: number;
  destinationAccountId: string;
  date: string;
  note?: string;
}

interface AppStore {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  disciplineState: DisciplineState;
  loans: Loan[];
  loanPayments: LoanPayment[];
  budgets: Budget[];
  isLoaded: boolean;

  loadData: () => Promise<void>;

  addAccount: (
    name: string,
    type: "spendable" | "protected",
    initialBalance?: number,
  ) => Promise<void>;
  updateAccount: (id: string, name: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  addCategory: (name: string, type: CategoryType) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  /** Upsert-by-(categoryId, month): sets or replaces that month's planned amount without touching any other month's Budget record. */
  setBudget: (
    categoryId: string,
    month: string,
    plannedAmount: number,
  ) => Promise<void>;
  /** 0 when no Budget record exists for that category+month — the PRD-specified default, not an error case. */
  getBudgetPlannedAmount: (categoryId: string, month: string) => number;
  /** `month` in `YYYY-MM`. Actuals are always derived from transactions, never entered manually. */
  getMonthSummary: (month: string) => MonthSummary;

  addIncome: (
    p: AddIncomeParams,
  ) => Promise<{ success: boolean; error?: string }>;
  addExpense: (
    p: AddExpenseParams,
  ) => Promise<{ success: boolean; error?: string; willGoDanger?: boolean }>;
  addTransfer: (
    p: AddTransferParams,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Balance correction: single-account delta, no category, never touches Discipline Debt. Not editable — delete and re-add. */
  addAdjustment: (
    p: AddAdjustmentParams,
  ) => Promise<{ success: boolean; error?: string }>;

  /** Edits replace the transaction: a new one is created via addIncome/addExpense/addTransfer, and only on success is the old one reversed and tombstoned — a failed edit never destroys the original. Type is not editable; delete and re-add for that. */
  updateIncome: (
    id: string,
    p: AddIncomeParams,
  ) => Promise<{ success: boolean; error?: string }>;
  updateExpense: (
    id: string,
    p: AddExpenseParams,
  ) => Promise<{ success: boolean; error?: string; willGoDanger?: boolean }>;
  updateTransfer: (
    id: string,
    p: AddTransferParams,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Reverses the transaction's effect on account balances and discipline state (via getTransactionReversal), then tombstones it. */
  deleteTransaction: (
    id: string,
  ) => Promise<{ success: boolean; error?: string }>;

  /** Loan disbursement: debits sourceAccountId, does not create a Transaction (per PRD §4.5 — not an expense). */
  addLoan: (p: AddLoanParams) => Promise<{ success: boolean; error?: string }>;
  /** Loan repayment: credits destinationAccountId, does not create a Transaction (per PRD §4.5 — not income). */
  recordLoanRepayment: (
    p: RecordLoanRepaymentParams,
  ) => Promise<{ success: boolean; error?: string }>;
  updateLoanExpectedRepaymentDate: (
    id: string,
    expectedRepaymentDate: string | null,
  ) => Promise<void>;
  markLoanSettled: (id: string) => Promise<void>;
  /** Reverses the disbursement and every repayment against sourceAccountId, then tombstones the loan and its payments. */
  deleteLoan: (id: string) => Promise<{ success: boolean; error?: string }>;
  getLoanOutstanding: (loanId: string) => number;

  getSafeToSpendMetrics: () => SafeToSpendMetrics;
  getDisciplineDebt: () => number;
  getSafeToSpendStatus: () => SafeToSpendStatus;
  /** PRD §5.7: editable, defaults to GHS 50/day. */
  updateSafeToSpendWarningThreshold: (threshold: number) => Promise<void>;
  /** Sets the user's own fixed daily spending target; null reverts to the automatic balance/days-remaining calculation. */
  updateCustomDailyBudget: (value: number | null) => Promise<void>;

  /**
   * Pushes any locally dirty records (syncedAt: null) to the server. A
   * best-effort background operation — failures (offline, server down,
   * not configured) are swallowed so they never surface as a UI error;
   * records simply stay dirty and get retried on the next mutation.
   */
  syncNow: () => Promise<void>;
}

const persist = async (data: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  disciplineState: DisciplineState;
  loans: Loan[];
  loanPayments: LoanPayment[];
  budgets: Budget[];
}) => {
  await saveAppData({
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    disciplineState: data.disciplineState,
    loans: data.loans,
    loanPayments: data.loanPayments,
    budgets: data.budgets,
  });
};

export const useStore = create<AppStore>((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  disciplineState: {
    id: "discipline_main",
    totalWithdrawnFromSavings: 0,
    totalExtraSavings: 0,
    safeToSpendWarningThreshold: DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD,
    customDailyBudget: null,
    createdAt: now(),
    updatedAt: now(),
    syncedAt: null,
    deletedAt: null,
  },
  loans: [],
  loanPayments: [],
  budgets: [],
  isLoaded: false,

  loadData: async () => {
    const fresh = await isFirstLaunch();
    const data = await loadAppData();
    set({
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
      disciplineState: data.disciplineState,
      loans: data.loans,
      loanPayments: data.loanPayments,
      budgets: data.budgets,
      isLoaded: true,
    });

    // Fresh install / new device: nothing local yet, so try restoring from
    // the server. If sync isn't configured, unreachable, or the server is
    // genuinely blank (nothing has ever been pushed by any device), the
    // freshly-seeded local defaults are the only starting point either side
    // has — keep them and push them up, so the server has a starting point
    // for the *next* fresh device too, instead of silently wiping the local
    // defaults down to nothing on every reachable-but-empty pull.
    if (fresh) {
      const pulled = await pullFromServer();
      if (pulled && !isEmptyPullResult(pulled)) {
        const restored = applyPullResult(pulled, now(), get().disciplineState);
        set(restored);
        await persist({ ...get(), ...restored });
      } else {
        void get().syncNow();
      }
    } else {
      // Promptly pushes any dirty records already sitting in local storage
      // from this load — in particular the one-time loan-transaction
      // backfill (storage.ts migrate()) — instead of waiting for the next
      // unrelated edit to trigger a sync.
      void get().syncNow();
    }
  },

  addAccount: async (name, type, initialBalance = 0) => {
    const account: Account = {
      id: genId(),
      name,
      type,
      balance: initialBalance,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    // A non-zero starting balance is itself a balance-affecting event —
    // every one of those needs a visible transaction behind it (the whole
    // point of the ledger is to be a true and fair audit of every addition
    // and deduction), so this mirrors it as an adjustment exactly like
    // addAdjustment does, rather than letting the balance just appear with
    // no trace. Dated today at midnight, matching how every other
    // transaction's `date` is normalized (see dateToStr in the screens that
    // collect one) — account creation has no date picker of its own.
    const today = new Date();
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00.000Z`;
    const startingBalanceAdjustment: Transaction | null =
      initialBalance !== 0
        ? {
            id: genId(),
            type: "adjustment",
            amount: Math.abs(initialBalance),
            date: todayDateStr,
            fromAccountId: initialBalance < 0 ? account.id : null,
            toAccountId: initialBalance > 0 ? account.id : null,
            note: "Starting balance",
            createdAt: account.createdAt,
            updatedAt: account.createdAt,
            syncedAt: null,
            deletedAt: null,
          }
        : null;

    const accounts = [...get().accounts, account];
    const transactions = startingBalanceAdjustment
      ? [...get().transactions, startingBalanceAdjustment]
      : get().transactions;
    set({ accounts, transactions });
    await persist({ ...get(), accounts, transactions });
    void get().syncNow();
  },

  updateAccount: async (id, name) => {
    const accounts = get().accounts.map((a) =>
      a.id === id ? { ...a, name, updatedAt: now(), syncedAt: null } : a,
    );
    set({ accounts });
    await persist({ ...get(), accounts });
    void get().syncNow();
  },

  deleteAccount: async (id) => {
    // Soft delete, same pattern as deleteCategory. Callers are responsible for
    // guarding against deleting an account still referenced by transactions,
    // loans, or loan payments — this action does not check that itself.
    const accounts = get().accounts.map((a) =>
      a.id === id
        ? { ...a, deletedAt: now(), updatedAt: now(), syncedAt: null }
        : a,
    );
    set({ accounts });
    await persist({ ...get(), accounts });
    void get().syncNow();
  },

  addCategory: async (name, type) => {
    const category: Category = {
      id: genId(),
      name,
      type,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };
    const categories = [...get().categories, category];
    set({ categories });
    await persist({ ...get(), categories });
    void get().syncNow();
  },

  updateCategory: async (id, name) => {
    const categories = get().categories.map((c) =>
      c.id === id ? { ...c, name, updatedAt: now(), syncedAt: null } : c,
    );
    set({ categories });
    await persist({ ...get(), categories });
    void get().syncNow();
  },

  deleteCategory: async (id) => {
    // Soft delete: the record stays locally (marked deletedAt + dirty) until
    // a successful sync confirms the server has deleted its copy too, at
    // which point it's purged from local storage entirely. UI-facing reads
    // of `categories` must filter out `deletedAt !== null` themselves.
    const categories = get().categories.map((c) =>
      c.id === id
        ? { ...c, deletedAt: now(), updatedAt: now(), syncedAt: null }
        : c,
    );
    set({ categories });
    await persist({ ...get(), categories });
    void get().syncNow();
  },

  addIncome: async (p) => {
    const {
      amount,
      spendableAccountId,
      protectedAccountId,
      selectedSavingsAmount,
      date,
      categoryId,
      note,
    } = p;

    if (amount <= 0)
      return { success: false, error: "Amount must be positive." };
    const minimumSavings = amount * 0.1;
    if (selectedSavingsAmount < minimumSavings) {
      return {
        success: false,
        error: `Minimum savings is 10% of received income (${minimumSavings.toFixed(2)}).`,
      };
    }
    if (selectedSavingsAmount > amount) {
      return { success: false, error: "Savings cannot exceed income amount." };
    }

    const spendableAmount = amount - selectedSavingsAmount;
    const extraSavings = Math.max(0, selectedSavingsAmount - minimumSavings);

    // The full amount is credited to the spendable account, then — same
    // pattern as a loan repayment's onward leg — the forced-savings portion
    // moves on via its own linked transfer transaction, so the savings
    // account gets a real, correctly-labeled transaction of its own instead
    // of a field buried inside the income transaction with no trace in that
    // account's own history. savingsAmount stays on the income transaction
    // (savingsAccountId no longer does) purely to compute the
    // above-the-minimum discipline-debt credit above, on both creation and
    // reversal — see getTransactionReversal.
    const incomeTransaction: Transaction = {
      id: genId(),
      type: "income",
      amount,
      date,
      categoryId: categoryId ?? null,
      toAccountId: spendableAccountId,
      savingsAccountId: null,
      savingsAmount: selectedSavingsAmount,
      note: note ?? null,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    // Validation above guarantees selectedSavingsAmount >= minimumSavings >
    // 0 whenever amount > 0, so this is never actually null in practice —
    // guarded anyway in case that validation is ever relaxed.
    const savingsTransfer: Transaction | null =
      selectedSavingsAmount > 0
        ? {
            id: genId(),
            type: "transfer",
            amount: selectedSavingsAmount,
            date,
            fromAccountId: spendableAccountId,
            toAccountId: protectedAccountId,
            note: note ?? null,
            reason: null,
            countsAsDebtRepayment: false,
            incomeTransactionId: incomeTransaction.id,
            createdAt: now(),
            updatedAt: now(),
            syncedAt: null,
            deletedAt: null,
          }
        : null;

    const accounts = get().accounts.map((a) => {
      if (a.id === spendableAccountId)
        return {
          ...a,
          balance: a.balance + spendableAmount,
          updatedAt: now(),
          syncedAt: null,
        };
      if (a.id === protectedAccountId)
        return {
          ...a,
          balance: a.balance + selectedSavingsAmount,
          updatedAt: now(),
          syncedAt: null,
        };
      return a;
    });

    const disciplineState: DisciplineState = {
      ...get().disciplineState,
      totalExtraSavings: get().disciplineState.totalExtraSavings + extraSavings,
      updatedAt: now(),
      syncedAt: null,
    };

    const transactions = savingsTransfer
      ? [...get().transactions, incomeTransaction, savingsTransfer]
      : [...get().transactions, incomeTransaction];
    set({ accounts, transactions, disciplineState });
    await persist({ ...get(), accounts, transactions, disciplineState });
    void get().syncNow();

    return { success: true };
  },

  addExpense: async (p) => {
    const { amount, accountId, categoryId, date, note } = p;

    if (amount <= 0)
      return { success: false, error: "Amount must be positive." };
    if (!categoryId) return { success: false, error: "Category is required." };

    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return { success: false, error: "Account not found." };
    if (account.type !== "spendable")
      return {
        success: false,
        error: "Expense must come from a spendable account.",
      };

    const newBalance = account.balance - amount;
    // Adding this expense subtracts `amount` from safeToSpendToday 1:1 (the
    // daily budget is fixed as of this morning, unaffected by today's own
    // spending) — no need to simulate the post-expense state.
    const metrics = calculateSafeToSpendToday(
      get().accounts,
      get().transactions,
      get().disciplineState.customDailyBudget,
    );

    const transaction: Transaction = {
      id: genId(),
      type: "expense",
      amount,
      date,
      fromAccountId: accountId,
      categoryId,
      note: note ?? null,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) =>
      a.id === accountId
        ? { ...a, balance: newBalance, updatedAt: now(), syncedAt: null }
        : a,
    );
    const transactions = [...get().transactions, transaction];
    set({ accounts, transactions });
    await persist({ ...get(), accounts, transactions });
    void get().syncNow();

    const willGoDanger = metrics.safeToSpendToday - amount <= 0;
    return { success: true, willGoDanger };
  },

  addAdjustment: async (p) => {
    const { accountId, delta, date, note } = p;

    if (delta === 0)
      return { success: false, error: "Amount must not be zero." };
    if (!note.trim())
      return {
        success: false,
        error: "A note is required for a balance adjustment.",
      };

    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return { success: false, error: "Account not found." };

    // Same shape as expense (fromAccountId, delta removed money) / income
    // (toAccountId, delta added money) — amount is always stored positive.
    const transaction: Transaction = {
      id: genId(),
      type: "adjustment",
      amount: Math.abs(delta),
      date,
      fromAccountId: delta < 0 ? accountId : null,
      toAccountId: delta > 0 ? accountId : null,
      note: note.trim(),
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) =>
      a.id === accountId
        ? { ...a, balance: a.balance + delta, updatedAt: now(), syncedAt: null }
        : a,
    );
    const transactions = [...get().transactions, transaction];
    set({ accounts, transactions });
    await persist({ ...get(), accounts, transactions });
    void get().syncNow();

    return { success: true };
  },

  addTransfer: async (p) => {
    const {
      amount,
      fromAccountId,
      toAccountId,
      date,
      note,
      reason,
      countsAsDebtRepayment,
      loanPaymentId,
    } = p;

    if (amount <= 0)
      return { success: false, error: "Amount must be positive." };
    if (fromAccountId === toAccountId)
      return {
        success: false,
        error: "From and to accounts must be different.",
      };

    const fromAccount = get().accounts.find((a) => a.id === fromAccountId);
    const toAccount = get().accounts.find((a) => a.id === toAccountId);
    if (!fromAccount || !toAccount)
      return { success: false, error: "Account not found." };

    const isProtectedToSpendable =
      fromAccount.type === "protected" && toAccount.type === "spendable";
    if (isProtectedToSpendable && (!reason || reason.trim() === "")) {
      return {
        success: false,
        error: "Reason is required when withdrawing from protected savings.",
      };
    }

    const transaction: Transaction = {
      id: genId(),
      type: "transfer",
      amount,
      date,
      fromAccountId,
      toAccountId,
      note: note ?? null,
      reason: reason ?? null,
      countsAsDebtRepayment: countsAsDebtRepayment ?? false,
      loanPaymentId: loanPaymentId ?? null,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) => {
      if (a.id === fromAccountId)
        return {
          ...a,
          balance: a.balance - amount,
          updatedAt: now(),
          syncedAt: null,
        };
      if (a.id === toAccountId)
        return {
          ...a,
          balance: a.balance + amount,
          updatedAt: now(),
          syncedAt: null,
        };
      return a;
    });

    // Only mark disciplineState dirty when a branch below actually changes
    // it — an untouched copy shouldn't get pushed to the server.
    let disciplineState = get().disciplineState;
    if (isProtectedToSpendable) {
      disciplineState = {
        ...disciplineState,
        totalWithdrawnFromSavings:
          disciplineState.totalWithdrawnFromSavings + amount,
        updatedAt: now(),
        syncedAt: null,
      };
    } else if (
      fromAccount.type === "spendable" &&
      toAccount.type === "protected" &&
      countsAsDebtRepayment
    ) {
      disciplineState = {
        ...disciplineState,
        totalExtraSavings: disciplineState.totalExtraSavings + amount,
        updatedAt: now(),
        syncedAt: null,
      };
    }

    const transactions = [...get().transactions, transaction];
    set({ accounts, transactions, disciplineState });
    await persist({ ...get(), accounts, transactions, disciplineState });
    void get().syncNow();

    return { success: true };
  },

  updateIncome: async (id, p) => {
    const old = get().transactions.find((t) => t.id === id && !t.deletedAt);
    if (!old) return { success: false, error: "Transaction not found." };
    const result = await get().addIncome(p);
    if (result.success) await get().deleteTransaction(id);
    return result;
  },

  updateExpense: async (id, p) => {
    const old = get().transactions.find((t) => t.id === id && !t.deletedAt);
    if (!old) return { success: false, error: "Transaction not found." };
    const result = await get().addExpense(p);
    if (result.success) await get().deleteTransaction(id);
    return result;
  },

  updateTransfer: async (id, p) => {
    const old = get().transactions.find((t) => t.id === id && !t.deletedAt);
    if (!old) return { success: false, error: "Transaction not found." };
    const result = await get().addTransfer(p);
    if (result.success) await get().deleteTransaction(id);
    return result;
  },

  deleteTransaction: async (id) => {
    const transaction = get().transactions.find(
      (t) => t.id === id && !t.deletedAt,
    );
    if (!transaction)
      return { success: false, error: "Transaction not found." };

    // An income's forced-savings transfer leg is linked back via
    // incomeTransactionId (locked from independent delete in
    // transaction-detail.tsx) — deleting the primary income transaction
    // must cascade to reverse that leg too, the same way deleteLoan cascades
    // to every transaction a loan generated.
    const linkedTransactions = get().transactions.filter(
      (t) => !t.deletedAt && t.incomeTransactionId === id,
    );
    const toReverse = [transaction, ...linkedTransactions];

    const accountDeltaMap = new Map<string, number>();
    let totalWithdrawnFromSavings = 0;
    let totalExtraSavings = 0;
    for (const t of toReverse) {
      const reversal = getTransactionReversal(t, get().accounts);
      for (const d of reversal.accountDeltas) {
        accountDeltaMap.set(d.accountId, (accountDeltaMap.get(d.accountId) ?? 0) + d.delta);
      }
      totalWithdrawnFromSavings += reversal.disciplineDelta.totalWithdrawnFromSavings;
      totalExtraSavings += reversal.disciplineDelta.totalExtraSavings;
    }

    const accounts = get().accounts.map((a) =>
      accountDeltaMap.has(a.id)
        ? {
            ...a,
            balance: a.balance + accountDeltaMap.get(a.id)!,
            updatedAt: now(),
            syncedAt: null,
          }
        : a,
    );

    const disciplineState =
      totalWithdrawnFromSavings !== 0 || totalExtraSavings !== 0
        ? {
            ...get().disciplineState,
            totalWithdrawnFromSavings:
              get().disciplineState.totalWithdrawnFromSavings +
              totalWithdrawnFromSavings,
            totalExtraSavings:
              get().disciplineState.totalExtraSavings + totalExtraSavings,
            updatedAt: now(),
            syncedAt: null,
          }
        : get().disciplineState;

    const toReverseIds = new Set(toReverse.map((t) => t.id));
    const transactions = get().transactions.map((t) =>
      toReverseIds.has(t.id)
        ? { ...t, deletedAt: now(), updatedAt: now(), syncedAt: null }
        : t,
    );

    set({ accounts, transactions, disciplineState });
    await persist({ ...get(), accounts, transactions, disciplineState });
    void get().syncNow();

    return { success: true };
  },

  addLoan: async (p) => {
    const {
      borrowerName,
      principal,
      sourceAccountId,
      dateLent,
      expectedRepaymentDate,
      note,
    } = p;

    if (!borrowerName.trim())
      return { success: false, error: "A name is required." };
    if (principal <= 0)
      return { success: false, error: "Amount must be positive." };

    const sourceAccount = get().accounts.find((a) => a.id === sourceAccountId);
    if (!sourceAccount) return { success: false, error: "Account not found." };
    if (sourceAccount.type !== "spendable") {
      return {
        success: false,
        error: "This can only be tracked from a spendable account.",
      };
    }
    if (
      expectedRepaymentDate &&
      new Date(expectedRepaymentDate) <= new Date(dateLent)
    ) {
      return {
        success: false,
        error: "Expected repayment date must be after the date given.",
      };
    }

    const loan: Loan = {
      id: genId(),
      borrowerName: borrowerName.trim(),
      principal,
      dateLent,
      expectedRepaymentDate: expectedRepaymentDate ?? null,
      note: note ?? null,
      sourceAccountId,
      createdAt: now(),
      updatedAt: now(),
      settledAt: null,
      syncedAt: null,
      deletedAt: null,
    };

    // Debits the source account directly (unchanged), but also mirrors the
    // disbursement as a real Transaction now — a loan out still isn't an
    // expense (PRD §4.5, excluded from getMonthSummary), but it needs to
    // show up in that account's own history instead of the balance just
    // silently dropping. Locked from independent edit/delete in
    // transaction-detail.tsx via loanId — only deleting the Loan reverses it.
    const disbursement: Transaction = {
      id: genId(),
      type: "loan_disbursement",
      amount: principal,
      date: dateLent,
      fromAccountId: sourceAccountId,
      toAccountId: null,
      categoryId: null,
      note: note ?? null,
      loanId: loan.id,
      loanPaymentId: null,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) =>
      a.id === sourceAccountId
        ? {
            ...a,
            balance: a.balance - principal,
            updatedAt: now(),
            syncedAt: null,
          }
        : a,
    );
    const loans = [...get().loans, loan];
    const transactions = [...get().transactions, disbursement];
    set({ accounts, loans, transactions });
    await persist({ ...get(), accounts, loans, transactions });
    void get().syncNow();

    return { success: true };
  },

  recordLoanRepayment: async (p) => {
    const { loanId, amount, destinationAccountId, date, note } = p;

    if (amount <= 0)
      return { success: false, error: "Amount must be positive." };

    const loan = get().loans.find((l) => l.id === loanId && !l.deletedAt);
    if (!loan) return { success: false, error: "Loan not found." };

    const destinationAccount = get().accounts.find(
      (a) => a.id === destinationAccountId,
    );
    if (!destinationAccount)
      return { success: false, error: "Account not found." };

    const outstanding = getLoanOutstanding(loan, get().loanPayments);
    if (amount > outstanding) {
      return {
        success: false,
        error: `Repayment cannot exceed the outstanding balance (${outstanding.toFixed(2)}).`,
      };
    }

    // Repayment always credits the loan's source account first (where the
    // principal was disbursed from) — crediting anywhere else would leave
    // its balance permanently understated even after the loan is fully
    // repaid. If the cash actually landed in a different account, that
    // credit is immediately followed by an ordinary transfer moving it on to
    // destinationAccountId (below), so each account's own history stays a
    // complete, self-contained story instead of the credit vanishing into a
    // black box only the Loans tab can explain. Not income (PRD §4.5) —
    // excluded from getMonthSummary the same way loan_disbursement is.
    const payment: LoanPayment = {
      id: genId(),
      loanId,
      amount,
      date,
      destinationAccountId,
      note: note ?? null,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const repaymentCredit: Transaction = {
      id: genId(),
      type: "loan_repayment",
      amount,
      date,
      fromAccountId: null,
      toAccountId: loan.sourceAccountId,
      categoryId: null,
      note: note ?? null,
      loanId: null,
      loanPaymentId: payment.id,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) =>
      a.id === loan.sourceAccountId
        ? {
            ...a,
            balance: a.balance + amount,
            updatedAt: now(),
            syncedAt: null,
          }
        : a,
    );
    const loanPayments = [...get().loanPayments, payment];
    const transactions = [...get().transactions, repaymentCredit];
    set({ accounts, loanPayments, transactions });
    await persist({ ...get(), accounts, loanPayments, transactions });
    void get().syncNow();

    if (destinationAccountId !== loan.sourceAccountId) {
      await get().addTransfer({
        amount,
        fromAccountId: loan.sourceAccountId,
        toAccountId: destinationAccountId,
        date,
        note: note ?? undefined,
        countsAsDebtRepayment: false,
        loanPaymentId: payment.id,
      });
    }

    return { success: true };
  },

  updateLoanExpectedRepaymentDate: async (id, expectedRepaymentDate) => {
    const loans = get().loans.map((l) =>
      l.id === id
        ? { ...l, expectedRepaymentDate, updatedAt: now(), syncedAt: null }
        : l,
    );
    set({ loans });
    await persist({ ...get(), loans });
    void get().syncNow();
  },

  markLoanSettled: async (id) => {
    const loans = get().loans.map((l) =>
      l.id === id
        ? { ...l, settledAt: now(), updatedAt: now(), syncedAt: null }
        : l,
    );
    set({ loans });
    await persist({ ...get(), loans });
    void get().syncNow();
  },

  deleteLoan: async (id) => {
    const loan = get().loans.find((l) => l.id === id && !l.deletedAt);
    if (!loan) return { success: false, error: "Loan not found." };

    const activePayments = get().loanPayments.filter(
      (p) => p.loanId === id && !p.deletedAt,
    );
    const activePaymentIds = new Set(activePayments.map((p) => p.id));

    // Reverses every transaction this loan generated — the disbursement,
    // each repayment's credit, and each repayment's onward transfer leg (if
    // the money didn't land back in sourceAccountId) — through the same
    // getTransactionReversal used everywhere else, rather than a bespoke
    // net-delta shortcut. A shortcut applied only to sourceAccountId would
    // be wrong now: a repayment's money may have moved on to a different
    // account entirely, so sourceAccountId's own net change from that
    // repayment is zero, not +amount.
    const linkedTransactions = get().transactions.filter(
      (t) =>
        !t.deletedAt &&
        (t.loanId === id || (t.loanPaymentId != null && activePaymentIds.has(t.loanPaymentId))),
    );

    const accountDeltaMap = new Map<string, number>();
    let totalWithdrawnFromSavingsDelta = 0;
    let totalExtraSavingsDelta = 0;
    for (const t of linkedTransactions) {
      const reversal = getTransactionReversal(t, get().accounts);
      for (const d of reversal.accountDeltas) {
        accountDeltaMap.set(d.accountId, (accountDeltaMap.get(d.accountId) ?? 0) + d.delta);
      }
      totalWithdrawnFromSavingsDelta += reversal.disciplineDelta.totalWithdrawnFromSavings;
      totalExtraSavingsDelta += reversal.disciplineDelta.totalExtraSavings;
    }

    const accounts = get().accounts.map((a) =>
      accountDeltaMap.has(a.id)
        ? { ...a, balance: a.balance + accountDeltaMap.get(a.id)!, updatedAt: now(), syncedAt: null }
        : a,
    );

    const disciplineState =
      totalWithdrawnFromSavingsDelta !== 0 || totalExtraSavingsDelta !== 0
        ? {
            ...get().disciplineState,
            totalWithdrawnFromSavings: get().disciplineState.totalWithdrawnFromSavings + totalWithdrawnFromSavingsDelta,
            totalExtraSavings: get().disciplineState.totalExtraSavings + totalExtraSavingsDelta,
            updatedAt: now(),
            syncedAt: null,
          }
        : get().disciplineState;

    const loans = get().loans.map((l) =>
      l.id === id
        ? { ...l, deletedAt: now(), updatedAt: now(), syncedAt: null }
        : l,
    );
    const loanPayments = get().loanPayments.map((p) =>
      activePaymentIds.has(p.id)
        ? { ...p, deletedAt: now(), updatedAt: now(), syncedAt: null }
        : p,
    );
    const linkedTransactionIds = new Set(linkedTransactions.map((t) => t.id));
    const transactions = get().transactions.map((t) =>
      linkedTransactionIds.has(t.id)
        ? { ...t, deletedAt: now(), updatedAt: now(), syncedAt: null }
        : t,
    );

    set({ accounts, loans, loanPayments, transactions, disciplineState });
    await persist({ ...get(), accounts, loans, loanPayments, transactions, disciplineState });
    void get().syncNow();

    return { success: true };
  },

  getLoanOutstanding: (loanId) => {
    const loan = get().loans.find((l) => l.id === loanId && !l.deletedAt);
    if (!loan) return 0;
    return getLoanOutstanding(loan, get().loanPayments);
  },

  setBudget: async (categoryId, month, plannedAmount) => {
    const existing = get().budgets.find(
      (b) => b.categoryId === categoryId && b.month === month && !b.deletedAt,
    );

    const budgets = existing
      ? get().budgets.map((b) =>
          b.id === existing.id
            ? { ...b, plannedAmount, updatedAt: now(), syncedAt: null }
            : b,
        )
      : [
          ...get().budgets,
          {
            id: genId(),
            categoryId,
            month,
            plannedAmount,
            createdAt: now(),
            updatedAt: now(),
            syncedAt: null,
            deletedAt: null,
          } satisfies Budget,
        ];

    set({ budgets });
    await persist({ ...get(), budgets });
    void get().syncNow();
  },

  getBudgetPlannedAmount: (categoryId, month) => {
    return getBudgetPlannedAmount(get().budgets, categoryId, month);
  },

  getMonthSummary: (month) => {
    return getMonthSummary(
      month,
      get().transactions,
      get().categories,
      get().budgets,
    );
  },

  getSafeToSpendMetrics: () => {
    return calculateSafeToSpendToday(get().accounts, get().transactions, get().disciplineState.customDailyBudget);
  },

  getDisciplineDebt: () => {
    return calculateDisciplineDebt(get().disciplineState);
  },

  getSafeToSpendStatus: () => {
    const { safeToSpendToday } = calculateSafeToSpendToday(
      get().accounts,
      get().transactions,
      get().disciplineState.customDailyBudget,
    );
    return getSafeToSpendStatus(
      safeToSpendToday,
      get().disciplineState.safeToSpendWarningThreshold,
    );
  },

  updateSafeToSpendWarningThreshold: async (threshold) => {
    const disciplineState: DisciplineState = {
      ...get().disciplineState,
      safeToSpendWarningThreshold: threshold,
      updatedAt: now(),
      syncedAt: null,
    };
    set({ disciplineState });
    await persist({ ...get(), disciplineState });
    void get().syncNow();
  },

  updateCustomDailyBudget: async (value) => {
    const disciplineState: DisciplineState = {
      ...get().disciplineState,
      customDailyBudget: value,
      updatedAt: now(),
      syncedAt: null,
    };
    set({ disciplineState });
    await persist({ ...get(), disciplineState });
    void get().syncNow();
  },

  syncNow: async () => {
    const payload = collectDirtyRecords(get());
    if (!hasDirtyRecords(payload)) return;

    const success = await pushToServer(payload);
    if (!success) return;

    const updated = applyPushResult(get(), payload, now());
    set(updated);
    await persist({ ...get(), ...updated });
  },
}));
