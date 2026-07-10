import type { Transaction, TransactionType } from '@/lib/types';

export interface TransactionFilters {
  /** `YYYY-MM`, or null for all months. */
  month: string | null;
  /** Matches either side of a transfer (fromAccountId or toAccountId), or null for all accounts. */
  accountId: string | null;
  categoryId: string | null;
  type: TransactionType | null;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  month: null,
  accountId: null,
  categoryId: null,
  type: null,
};

export function filterTransactions(transactions: Transaction[], filters: TransactionFilters): Transaction[] {
  return transactions.filter((t) => {
    if (filters.month && !t.date.startsWith(filters.month)) return false;
    if (filters.accountId && t.fromAccountId !== filters.accountId && t.toAccountId !== filters.accountId) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.type && t.type !== filters.type) return false;
    return true;
  });
}

export function hasActiveFilters(filters: TransactionFilters): boolean {
  return filters.month !== null || filters.accountId !== null || filters.categoryId !== null || filters.type !== null;
}

export function activeFilterCount(filters: TransactionFilters): number {
  return [filters.month, filters.accountId, filters.categoryId, filters.type].filter((v) => v !== null).length;
}
