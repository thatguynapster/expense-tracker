import { create } from 'zustand';
import { isFirstLaunch, loadAppData, saveAppData } from '@/lib/storage';
import { pullFromServer, pushToServer } from '@/lib/syncApi';
import type {
  Account,
  Category,
  Transaction,
  DisciplineState,
  SafeToSpendMetrics,
  SafeToSpendStatus,
} from '@/lib/types';
import { calculateSafeToSpendToday, calculateDisciplineDebt, getSafeToSpendStatus } from '@/utils/calculations';
import { applyPullResult, applyPushResult, collectDirtyRecords, hasDirtyRecords } from '@/utils/sync';

const genId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
const now = (): string => new Date().toISOString();

export interface AddIncomeParams {
  amount: number;
  spendableAccountId: string;
  protectedAccountId: string;
  selectedSavingsAmount: number;
  date: string;
  note?: string;
}

export interface AddExpenseParams {
  amount: number;
  accountId: string;
  categoryId?: string;
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

interface AppStore {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  disciplineState: DisciplineState;
  isLoaded: boolean;

  loadData: () => Promise<void>;

  addAccount: (name: string, type: 'spendable' | 'protected', initialBalance?: number) => Promise<void>;
  updateAccount: (id: string, name: string) => Promise<void>;

  addCategory: (name: string, monthlyBudget?: number | null) => Promise<void>;
  updateCategory: (id: string, name: string, monthlyBudget?: number | null) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addIncome: (p: AddIncomeParams) => Promise<{ success: boolean; error?: string }>;
  addExpense: (p: AddExpenseParams) => Promise<{ success: boolean; error?: string; willGoDanger?: boolean }>;
  addTransfer: (p: AddTransferParams) => Promise<{ success: boolean; error?: string }>;

  getSafeToSpendMetrics: () => SafeToSpendMetrics;
  getDisciplineDebt: () => number;
  getSafeToSpendStatus: () => SafeToSpendStatus;

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
}) => {
  await saveAppData({
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    disciplineState: data.disciplineState,
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
    createdAt: now(),
    updatedAt: now(),
    syncedAt: null,
    deletedAt: null,
  },
  isLoaded: false,

  loadData: async () => {
    const fresh = await isFirstLaunch();
    const data = await loadAppData();
    set({
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
      disciplineState: data.disciplineState,
      isLoaded: true,
    });

    // Fresh install / new device: nothing local yet, so try restoring from
    // the server. A no-op if sync isn't configured or the server has
    // nothing either — the freshly-seeded local defaults stand as-is.
    if (fresh) {
      const pulled = await pullFromServer();
      if (pulled) {
        const restored = applyPullResult(pulled, now(), get().disciplineState);
        set(restored);
        await saveAppData(restored);
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

  addCategory: async (name, monthlyBudget) => {
    const category: Category = {
      id: genId(),
      name,
      monthlyBudget: monthlyBudget ?? null,
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

  updateCategory: async (id, name, monthlyBudget) => {
    const categories = get().categories.map((c) =>
      c.id === id ? { ...c, name, monthlyBudget: monthlyBudget ?? null, updatedAt: now(), syncedAt: null } : c
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
    const { amount, spendableAccountId, protectedAccountId, selectedSavingsAmount, date, note } = p;

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
      categoryId: categoryId ?? null,
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

  getSafeToSpendMetrics: () => {
    return calculateSafeToSpendToday(get().accounts);
  },

  getDisciplineDebt: () => {
    return calculateDisciplineDebt(get().disciplineState);
  },

  getSafeToSpendStatus: () => {
    const { safeToSpendToday } = calculateSafeToSpendToday(get().accounts);
    return getSafeToSpendStatus(safeToSpendToday);
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
