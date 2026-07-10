import type { Account, AccountType, Transaction } from '@/lib/types';

export function sortCategoriesAlphabetically<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

const ACCOUNT_TYPE_ORDER: Record<AccountType, number> = { spendable: 0, protected: 1 };

/** Spendable before protected (matches the rest of the app's convention), alphabetical by name within each type. */
export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const typeDiff = ACCOUNT_TYPE_ORDER[a.type] - ACCOUNT_TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Most recent calendar date first; within the same date, most recently
 * entered first (by `createdAt`, since `date` itself carries no time
 * component — every transaction's `date` is stored at midnight).
 */
export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
