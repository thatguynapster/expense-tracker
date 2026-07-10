import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD } from '@/utils/calculations';
import type { Account, AppData, Budget, Category, DisciplineState, Loan, LoanPayment, Transaction } from './types';

const STORAGE_KEY = '@expense_tracker_v1';

const ts = () => new Date().toISOString();

export const DEFAULT_DATA: AppData = {
  accounts: [
    { id: 'acc_salary', name: 'Salary Account', type: 'spendable', balance: 0, createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'acc_savings', name: 'Savings Account', type: 'protected', balance: 0, createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
  ],
  categories: [
    { id: 'cat_food', name: 'Food', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_transport', name: 'Transport', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_rent', name: 'Rent', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_utilities', name: 'Utilities', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_health', name: 'Health', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_family', name: 'Family', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_work', name: 'Work', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_misc', name: 'Miscellaneous', type: 'expense', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_salary', name: 'Salary', type: 'income', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_side_gigs', name: 'Side Gigs', type: 'income', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_bonus', name: 'Bonus', type: 'income', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_deposits', name: 'Deposits', type: 'income', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
  ],
  transactions: [],
  disciplineState: {
    id: 'discipline_main',
    totalWithdrawnFromSavings: 0,
    totalExtraSavings: 0,
    safeToSpendWarningThreshold: DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD,
    createdAt: ts(),
    updatedAt: ts(),
    syncedAt: null,
    deletedAt: null,
  },
  loans: [],
  loanPayments: [],
  budgets: [],
};

/**
 * Backfills `syncedAt`/`deletedAt` on data persisted before those fields
 * existed, so upgrading the app doesn't crash on records missing them.
 * Existing (pre-upgrade) records are treated as dirty (`syncedAt: null`)
 * so they get pushed to the server on the next sync.
 */
function migrate(data: AppData): AppData {
  const withSyncFields = <T extends { syncedAt?: string | null; deletedAt?: string | null }>(
    record: T,
  ): T => ({
    ...record,
    syncedAt: record.syncedAt ?? null,
    deletedAt: record.deletedAt ?? null,
  });

  // Categories predating the income/expense split default to 'expense' —
  // the category picker only ever appeared on the expense form before this
  // field existed, so every pre-existing category was necessarily created
  // for expense use.
  const withCategoryType = (category: Category): Category => ({
    ...withSyncFields(category),
    type: category.type ?? 'expense',
  });

  const withWarningThreshold = (state: DisciplineState): DisciplineState => ({
    ...withSyncFields(state),
    safeToSpendWarningThreshold: state.safeToSpendWarningThreshold ?? DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD,
  });

  return {
    accounts: data.accounts.map((a: Account) => withSyncFields(a)),
    categories: data.categories.map((c: Category) => withCategoryType(c)),
    transactions: data.transactions.map((t: Transaction) => withSyncFields(t)),
    disciplineState: withWarningThreshold(data.disciplineState as DisciplineState),
    loans: (data.loans ?? []).map((l: Loan) => withSyncFields(l)),
    loanPayments: (data.loanPayments ?? []).map((p: LoanPayment) => withSyncFields(p)),
    budgets: (data.budgets ?? []).map((b: Budget) => withSyncFields(b)),
  };
}

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as AppData;
    return migrate(parsed);
  } catch {
    return DEFAULT_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * True only when nothing has ever been saved locally — used to decide
 * whether to attempt a restore-from-server pull on app load, instead of
 * seeding fresh local defaults over data that might exist on the server.
 */
export async function isFirstLaunch(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === null;
}
