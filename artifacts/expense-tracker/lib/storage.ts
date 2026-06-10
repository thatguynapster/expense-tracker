import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from './types';

const STORAGE_KEY = '@expense_tracker_v1';

const ts = () => new Date().toISOString();

export const DEFAULT_DATA: AppData = {
  accounts: [
    { id: 'acc_salary', name: 'Salary Account', type: 'spendable', balance: 0, createdAt: ts(), updatedAt: ts() },
    { id: 'acc_savings', name: 'Savings Account', type: 'protected', balance: 0, createdAt: ts(), updatedAt: ts() },
  ],
  categories: [
    { id: 'cat_food', name: 'Food', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_transport', name: 'Transport', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_rent', name: 'Rent', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_utilities', name: 'Utilities', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_health', name: 'Health', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_family', name: 'Family', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_work', name: 'Work', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_entertainment', name: 'Entertainment', createdAt: ts(), updatedAt: ts() },
    { id: 'cat_misc', name: 'Miscellaneous', createdAt: ts(), updatedAt: ts() },
  ],
  transactions: [],
  disciplineState: {
    id: 'discipline_main',
    totalWithdrawnFromSavings: 0,
    totalExtraSavings: 0,
    createdAt: ts(),
    updatedAt: ts(),
  },
};

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as AppData;
    return parsed;
  } catch {
    return DEFAULT_DATA;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
