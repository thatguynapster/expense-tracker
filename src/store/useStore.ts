import { create } from 'zustand';
import { isFirstLaunch, loadAppData, saveAppData } from '@/lib/storage';
import { pullFromServer, pushToServer } from '@/lib/syncApi';
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
} from '@/lib/types';
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
} from '@/utils/calculations';
import { applyPullResult, applyPushResult, collectDirtyRecords, hasDirtyRecords, isEmptyPullResult } from '@/utils/sync';

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

  addAccount: (name: string, type: 'spendable' | 'protected', initialBalance?: number) => Promise<void>;
  updateAccount: (id: string, name: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  addCategory: (name: string, type: CategoryType) => Promise<void>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  /** Upsert-by-(categoryId, month): sets or replaces that month's planned amount without touching any other month's Budget record. */
  setBudget: (categoryId: string, month: string, plannedAmount: number) => Promise<void>;
  /** 0 when no Budget record exists for that category+month — the PRD-specified default, not an error case. */
  getBudgetPlannedAmount: (categoryId: string, month: string) => number;
  /** `month` in `YYYY-MM`. Actuals are always derived from transactions, never entered manually. */
  getMonthSummary: (month: string) => MonthSummary;

  addIncome: (p: AddIncomeParams) => Promise<{ success: boolean; error?: string }>;
  addExpense: (p: AddExpenseParams) => Promise<{ success: boolean; error?: string; willGoDanger?: boolean }>;
  addTransfer: (p: AddTransferParams) => Promise<{ success: boolean; error?: string }>;

  /** Edits replace the transaction: a new one is created via addIncome/addExpense/addTransfer, and only on success is the old one reversed and tombstoned — a failed edit never destroys the original. Type is not editable; delete and re-add for that. */
  updateIncome: (id: string, p: AddIncomeParams) => Promise<{ success: boolean; error?: string }>;
  updateExpense: (id: string, p: AddExpenseParams) => Promise<{ success: boolean; error?: string; willGoDanger?: boolean }>;
  updateTransfer: (id: string, p: AddTransferParams) => Promise<{ success: boolean; error?: string }>;
  /** Reverses the transaction's effect on account balances and discipline state (via getTransactionReversal), then tombstones it. */
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;

  /** Loan disbursement: debits sourceAccountId, does not create a Transaction (per PRD §4.5 — not an expense). */
  addLoan: (p: AddLoanParams) => Promise<{ success: boolean; error?: string }>;
  /** Loan repayment: credits destinationAccountId, does not create a Transaction (per PRD §4.5 — not income). */
  recordLoanRepayment: (p: RecordLoanRepaymentParams) => Promise<{ success: boolean; error?: string }>;
  updateLoanExpectedRepaymentDate: (id: string, expectedRepaymentDate: string | null) => Promise<void>;
  markLoanSettled: (id: string) => Promise<void>;
  getLoanOutstanding: (loanId: string) => number;

  getSafeToSpendMetrics: () => SafeToSpendMetrics;
  getDisciplineDebt: () => number;
  getSafeToSpendStatus: () => SafeToSpendStatus;
  /** PRD §5.7: editable, defaults to GHS 50/day. */
  updateSafeToSpendWarningThreshold: (threshold: number) => Promise<void>;

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
    id: 'discipline_main',
    totalWithdrawnFromSavings: 0,
    totalExtraSavings: 0,
    safeToSpendWarningThreshold: DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD,
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
    const accounts = [...get().accounts, account];
    set({ accounts });
    await persist({ ...get(), accounts });
    void get().syncNow();
  },

  updateAccount: async (id, name) => {
    const accounts = get().accounts.map((a) =>
      a.id === id ? { ...a, name, updatedAt: now(), syncedAt: null } : a
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
      a.id === id ? { ...a, deletedAt: now(), updatedAt: now(), syncedAt: null } : a
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
      c.id === id ? { ...c, name, updatedAt: now(), syncedAt: null } : c
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
      c.id === id ? { ...c, deletedAt: now(), updatedAt: now(), syncedAt: null } : c
    );
    set({ categories });
    await persist({ ...get(), categories });
    void get().syncNow();
  },

  addIncome: async (p) => {
    const { amount, spendableAccountId, protectedAccountId, selectedSavingsAmount, date, categoryId, note } = p;

    if (amount <= 0) return { success: false, error: 'Amount must be positive.' };
    const minimumSavings = amount * 0.1;
    if (selectedSavingsAmount < minimumSavings) {
      return { success: false, error: `Minimum savings is 10% of received income (${minimumSavings.toFixed(2)}).` };
    }
    if (selectedSavingsAmount > amount) {
      return { success: false, error: 'Savings cannot exceed income amount.' };
    }

    const spendableAmount = amount - selectedSavingsAmount;
    const extraSavings = Math.max(0, selectedSavingsAmount - minimumSavings);

    const transaction: Transaction = {
      id: genId(),
      type: 'income',
      amount,
      date,
      categoryId: categoryId ?? null,
      toAccountId: spendableAccountId,
      savingsAccountId: protectedAccountId,
      savingsAmount: selectedSavingsAmount,
      note: note ?? null,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) => {
      if (a.id === spendableAccountId) return { ...a, balance: a.balance + spendableAmount, updatedAt: now(), syncedAt: null };
      if (a.id === protectedAccountId) return { ...a, balance: a.balance + selectedSavingsAmount, updatedAt: now(), syncedAt: null };
      return a;
    });

    const disciplineState: DisciplineState = {
      ...get().disciplineState,
      totalExtraSavings: get().disciplineState.totalExtraSavings + extraSavings,
      updatedAt: now(),
      syncedAt: null,
    };

    const transactions = [...get().transactions, transaction];
    set({ accounts, transactions, disciplineState });
    await persist({ ...get(), accounts, transactions, disciplineState });
    void get().syncNow();

    return { success: true };
  },

  addExpense: async (p) => {
    const { amount, accountId, categoryId, date, note } = p;

    if (amount <= 0) return { success: false, error: 'Amount must be positive.' };
    if (!categoryId) return { success: false, error: 'Category is required.' };

    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return { success: false, error: 'Account not found.' };
    if (account.type !== 'spendable') return { success: false, error: 'Expense must come from a spendable account.' };

    const newBalance = account.balance - amount;
    const otherSpendable = get().accounts
      .filter((a) => a.type === 'spendable' && a.id !== accountId)
      .reduce((sum, a) => sum + a.balance, 0);
    const metrics = calculateSafeToSpendToday(
      get().accounts.map((a) => (a.id === accountId ? { ...a, balance: newBalance } : a))
    );

    const transaction: Transaction = {
      id: genId(),
      type: 'expense',
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
      a.id === accountId ? { ...a, balance: newBalance, updatedAt: now(), syncedAt: null } : a
    );
    const transactions = [...get().transactions, transaction];
    set({ accounts, transactions });
    await persist({ ...get(), accounts, transactions });
    void get().syncNow();

    const willGoDanger = metrics.safeToSpendToday <= 0;
    return { success: true, willGoDanger };
  },

  addTransfer: async (p) => {
    const { amount, fromAccountId, toAccountId, date, note, reason, countsAsDebtRepayment } = p;

    if (amount <= 0) return { success: false, error: 'Amount must be positive.' };
    if (fromAccountId === toAccountId) return { success: false, error: 'From and to accounts must be different.' };

    const fromAccount = get().accounts.find((a) => a.id === fromAccountId);
    const toAccount = get().accounts.find((a) => a.id === toAccountId);
    if (!fromAccount || !toAccount) return { success: false, error: 'Account not found.' };

    const isProtectedToSpendable = fromAccount.type === 'protected' && toAccount.type === 'spendable';
    if (isProtectedToSpendable && (!reason || reason.trim() === '')) {
      return { success: false, error: 'Reason is required when withdrawing from protected savings.' };
    }

    const transaction: Transaction = {
      id: genId(),
      type: 'transfer',
      amount,
      date,
      fromAccountId,
      toAccountId,
      note: note ?? null,
      reason: reason ?? null,
      countsAsDebtRepayment: countsAsDebtRepayment ?? false,
      createdAt: now(),
      updatedAt: now(),
      syncedAt: null,
      deletedAt: null,
    };

    const accounts = get().accounts.map((a) => {
      if (a.id === fromAccountId) return { ...a, balance: a.balance - amount, updatedAt: now(), syncedAt: null };
      if (a.id === toAccountId) return { ...a, balance: a.balance + amount, updatedAt: now(), syncedAt: null };
      return a;
    });

    // Only mark disciplineState dirty when a branch below actually changes
    // it — an untouched copy shouldn't get pushed to the server.
    let disciplineState = get().disciplineState;
    if (isProtectedToSpendable) {
      disciplineState = {
        ...disciplineState,
        totalWithdrawnFromSavings: disciplineState.totalWithdrawnFromSavings + amount,
        updatedAt: now(),
        syncedAt: null,
      };
    } else if (fromAccount.type === 'spendable' && toAccount.type === 'protected' && countsAsDebtRepayment) {
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
    if (!old) return { success: false, error: 'Transaction not found.' };
    const result = await get().addIncome(p);
    if (result.success) await get().deleteTransaction(id);
    return result;
  },

  updateExpense: async (id, p) => {
    const old = get().transactions.find((t) => t.id === id && !t.deletedAt);
    if (!old) return { success: false, error: 'Transaction not found.' };
    const result = await get().addExpense(p);
    if (result.success) await get().deleteTransaction(id);
    return result;
  },

  updateTransfer: async (id, p) => {
    const old = get().transactions.find((t) => t.id === id && !t.deletedAt);
    if (!old) return { success: false, error: 'Transaction not found.' };
    const result = await get().addTransfer(p);
    if (result.success) await get().deleteTransaction(id);
    return result;
  },

  deleteTransaction: async (id) => {
    const transaction = get().transactions.find((t) => t.id === id && !t.deletedAt);
    if (!transaction) return { success: false, error: 'Transaction not found.' };

    const reversal = getTransactionReversal(transaction, get().accounts);
    const deltaMap = new Map(reversal.accountDeltas.map((d) => [d.accountId, d.delta]));
    const accounts = get().accounts.map((a) =>
      deltaMap.has(a.id) ? { ...a, balance: a.balance + deltaMap.get(a.id)!, updatedAt: now(), syncedAt: null } : a
    );

    const { totalWithdrawnFromSavings, totalExtraSavings } = reversal.disciplineDelta;
    const disciplineState =
      totalWithdrawnFromSavings !== 0 || totalExtraSavings !== 0
        ? {
            ...get().disciplineState,
            totalWithdrawnFromSavings: get().disciplineState.totalWithdrawnFromSavings + totalWithdrawnFromSavings,
            totalExtraSavings: get().disciplineState.totalExtraSavings + totalExtraSavings,
            updatedAt: now(),
            syncedAt: null,
          }
        : get().disciplineState;

    const transactions = get().transactions.map((t) =>
      t.id === id ? { ...t, deletedAt: now(), updatedAt: now(), syncedAt: null } : t
    );

    set({ accounts, transactions, disciplineState });
    await persist({ ...get(), accounts, transactions, disciplineState });
    void get().syncNow();

    return { success: true };
  },

  addLoan: async (p) => {
    const { borrowerName, principal, sourceAccountId, dateLent, expectedRepaymentDate, note } = p;

    if (!borrowerName.trim()) return { success: false, error: 'A name is required.' };
    if (principal <= 0) return { success: false, error: 'Amount must be positive.' };

    const sourceAccount = get().accounts.find((a) => a.id === sourceAccountId);
    if (!sourceAccount) return { success: false, error: 'Account not found.' };
    if (sourceAccount.type !== 'spendable') {
      return { success: false, error: 'This can only be tracked from a spendable account.' };
    }
    if (expectedRepaymentDate && new Date(expectedRepaymentDate) <= new Date(dateLent)) {
      return { success: false, error: 'Expected repayment date must be after the date given.' };
    }

    // Disbursement debits the source account directly — it deliberately does
    // NOT create a Transaction, since a loan out isn't an expense (PRD §4.5).
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

    const accounts = get().accounts.map((a) =>
      a.id === sourceAccountId ? { ...a, balance: a.balance - principal, updatedAt: now(), syncedAt: null } : a
    );
    const loans = [...get().loans, loan];
    set({ accounts, loans });
    await persist({ ...get(), accounts, loans });
    void get().syncNow();

    return { success: true };
  },

  recordLoanRepayment: async (p) => {
    const { loanId, amount, destinationAccountId, date, note } = p;

    if (amount <= 0) return { success: false, error: 'Amount must be positive.' };

    const loan = get().loans.find((l) => l.id === loanId);
    if (!loan) return { success: false, error: 'Loan not found.' };

    const destinationAccount = get().accounts.find((a) => a.id === destinationAccountId);
    if (!destinationAccount) return { success: false, error: 'Account not found.' };

    const outstanding = getLoanOutstanding(loan, get().loanPayments);
    if (amount > outstanding) {
      return { success: false, error: `Repayment cannot exceed the outstanding balance (${outstanding.toFixed(2)}).` };
    }

    // Repayment always credits the loan's source account (where the
    // principal was disbursed from), not necessarily destinationAccountId —
    // that field is kept purely as a record of where the cash physically
    // landed. Crediting anywhere else would leave the source account's
    // balance permanently understated even after the loan is fully repaid.
    // Deliberately does NOT create a Transaction, since loan repayment isn't
    // income (PRD §4.5).
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

    const accounts = get().accounts.map((a) =>
      a.id === loan.sourceAccountId ? { ...a, balance: a.balance + amount, updatedAt: now(), syncedAt: null } : a
    );
    const loanPayments = [...get().loanPayments, payment];
    set({ accounts, loanPayments });
    await persist({ ...get(), accounts, loanPayments });
    void get().syncNow();

    return { success: true };
  },

  updateLoanExpectedRepaymentDate: async (id, expectedRepaymentDate) => {
    const loans = get().loans.map((l) =>
      l.id === id ? { ...l, expectedRepaymentDate, updatedAt: now(), syncedAt: null } : l
    );
    set({ loans });
    await persist({ ...get(), loans });
    void get().syncNow();
  },

  markLoanSettled: async (id) => {
    const loans = get().loans.map((l) =>
      l.id === id ? { ...l, settledAt: now(), updatedAt: now(), syncedAt: null } : l
    );
    set({ loans });
    await persist({ ...get(), loans });
    void get().syncNow();
  },

  getLoanOutstanding: (loanId) => {
    const loan = get().loans.find((l) => l.id === loanId);
    if (!loan) return 0;
    return getLoanOutstanding(loan, get().loanPayments);
  },

  setBudget: async (categoryId, month, plannedAmount) => {
    const existing = get().budgets.find((b) => b.categoryId === categoryId && b.month === month && !b.deletedAt);

    const budgets = existing
      ? get().budgets.map((b) =>
          b.id === existing.id ? { ...b, plannedAmount, updatedAt: now(), syncedAt: null } : b
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
    return getMonthSummary(month, get().transactions, get().categories, get().budgets);
  },

  getSafeToSpendMetrics: () => {
    return calculateSafeToSpendToday(get().accounts);
  },

  getDisciplineDebt: () => {
    return calculateDisciplineDebt(get().disciplineState);
  },

  getSafeToSpendStatus: () => {
    const { safeToSpendToday } = calculateSafeToSpendToday(get().accounts);
    return getSafeToSpendStatus(safeToSpendToday, get().disciplineState.safeToSpendWarningThreshold);
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
