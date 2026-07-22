import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/lib/types';
import { activeFilterCount, EMPTY_TRANSACTION_FILTERS, filterTransactions, hasActiveFilters } from './filtering';

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx_1',
  type: 'expense',
  amount: 20,
  date: '2026-01-05T00:00:00.000Z',
  categoryId: 'cat_food',
  fromAccountId: 'acc_main',
  toAccountId: null,
  note: null,
  reason: null,
  savingsAccountId: null,
  savingsAmount: null,
  countsAsDebtRepayment: false,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

describe('filterTransactions', () => {
  it('returns everything unchanged when no filters are set', () => {
    const transactions = [transaction({ id: 't1' }), transaction({ id: 't2' })];
    expect(filterTransactions(transactions, EMPTY_TRANSACTION_FILTERS)).toEqual(transactions);
  });

  it('filters by month', () => {
    const transactions = [
      transaction({ id: 't1', date: '2026-01-05T00:00:00.000Z' }),
      transaction({ id: 't2', date: '2026-02-05T00:00:00.000Z' }),
    ];
    const result = filterTransactions(transactions, { ...EMPTY_TRANSACTION_FILTERS, month: '2026-01' });
    expect(result.map((t) => t.id)).toEqual(['t1']);
  });

  it('filters by account, matching either side of a transfer', () => {
    const transactions = [
      transaction({ id: 't1', fromAccountId: 'acc_a', toAccountId: null }),
      transaction({ id: 't2', fromAccountId: 'acc_b', toAccountId: 'acc_a' }),
      transaction({ id: 't3', fromAccountId: 'acc_b', toAccountId: 'acc_c' }),
    ];
    const result = filterTransactions(transactions, { ...EMPTY_TRANSACTION_FILTERS, accountId: 'acc_a' });
    expect(result.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it("filters by account, also matching an income's forced-savings destination", () => {
    // An income transaction touches up to three accounts: toAccountId (the
    // spendable portion), and savingsAccountId (the forced-savings split).
    // Filtering by the savings account must surface it too, or that
    // account's history silently omits every income that funded it.
    const transactions = [
      transaction({
        id: 't1',
        type: 'income',
        fromAccountId: null,
        toAccountId: 'acc_spendable',
        savingsAccountId: 'acc_savings',
        savingsAmount: 50,
      }),
      transaction({ id: 't2', fromAccountId: 'acc_unrelated' }),
    ];
    const result = filterTransactions(transactions, { ...EMPTY_TRANSACTION_FILTERS, accountId: 'acc_savings' });
    expect(result.map((t) => t.id)).toEqual(['t1']);
  });

  it('filters by category', () => {
    const transactions = [
      transaction({ id: 't1', categoryId: 'cat_food' }),
      transaction({ id: 't2', categoryId: 'cat_rent' }),
    ];
    const result = filterTransactions(transactions, { ...EMPTY_TRANSACTION_FILTERS, categoryId: 'cat_food' });
    expect(result.map((t) => t.id)).toEqual(['t1']);
  });

  it('filters by type', () => {
    const transactions = [
      transaction({ id: 't1', type: 'expense' }),
      transaction({ id: 't2', type: 'income' }),
      transaction({ id: 't3', type: 'transfer' }),
    ];
    const result = filterTransactions(transactions, { ...EMPTY_TRANSACTION_FILTERS, type: 'income' });
    expect(result.map((t) => t.id)).toEqual(['t2']);
  });

  it('combines multiple filters with AND semantics', () => {
    const transactions = [
      transaction({ id: 't1', date: '2026-01-05T00:00:00.000Z', categoryId: 'cat_food', type: 'expense' }),
      transaction({ id: 't2', date: '2026-01-05T00:00:00.000Z', categoryId: 'cat_rent', type: 'expense' }),
      transaction({ id: 't3', date: '2026-02-05T00:00:00.000Z', categoryId: 'cat_food', type: 'expense' }),
    ];
    const result = filterTransactions(transactions, {
      ...EMPTY_TRANSACTION_FILTERS,
      month: '2026-01',
      categoryId: 'cat_food',
    });
    expect(result.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('hasActiveFilters', () => {
  it('is false when everything is null', () => {
    expect(hasActiveFilters(EMPTY_TRANSACTION_FILTERS)).toBe(false);
  });

  it('is true when any single filter is set', () => {
    expect(hasActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, type: 'income' })).toBe(true);
  });
});

describe('activeFilterCount', () => {
  it('is 0 when nothing is set', () => {
    expect(activeFilterCount(EMPTY_TRANSACTION_FILTERS)).toBe(0);
  });

  it('counts each independently set filter', () => {
    expect(activeFilterCount({ month: '2026-01', accountId: 'acc_1', categoryId: null, type: null })).toBe(2);
  });

  it('counts all four when fully set', () => {
    expect(activeFilterCount({ month: '2026-01', accountId: 'acc_1', categoryId: 'cat_1', type: 'expense' })).toBe(4);
  });
});
