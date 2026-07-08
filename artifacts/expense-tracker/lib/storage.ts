import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Account, AppData, Category, DisciplineState, Transaction } from './types';

const STORAGE_KEY = '@expense_tracker_v1';

const ts = () => new Date().toISOString();

export const DEFAULT_DATA: AppData = {
  accounts: [
    { id: 'acc_salary', name: 'Salary Account', type: 'spendable', balance: 0, createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'acc_savings', name: 'Savings Account', type: 'protected', balance: 0, createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
  ],
  categories: [
    { id: 'cat_food', name: 'Food', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_transport', name: 'Transport', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_rent', name: 'Rent', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_utilities', name: 'Utilities', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_health', name: 'Health', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_family', name: 'Family', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_work', name: 'Work', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_entertainment', name: 'Entertainment', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
    { id: 'cat_misc', name: 'Miscellaneous', createdAt: ts(), updatedAt: ts(), syncedAt: null, deletedAt: null },
  ],
  transactions: [],
  disciplineState: {
    id: 'discipline_main',
    totalWithdrawnFromSavings: 0,
    totalExtraSavings: 0,
    createdAt: ts(),
    updatedAt: ts(),
    syncedAt: null,
    deletedAt: null,
  },
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

  return {
    accounts: data.accounts.map((a: Account) => withSyncFields(a)),
    categories: data.categories.map((c: Category) => withSyncFields(c)),
    transactions: data.transactions.map((t: Transaction) => withSyncFields(t)),
    disciplineState: withSyncFields(data.disciplineState as DisciplineState),
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
