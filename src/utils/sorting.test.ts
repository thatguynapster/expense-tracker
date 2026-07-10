import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '@/lib/types';
import { sortAccounts, sortCategoriesAlphabetically, sortTransactions } from './sorting';

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc_1',
  name: 'Zebra',
  type: 'spendable',
  balance: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx_1',
  type: 'expense',
  amount: 20,
  date: '2026-01-02T00:00:00.000Z',
  categoryId: 'cat_1',
  fromAccountId: 'acc_1',
  toAccountId: null,
  note: null,
  reason: null,
  savingsAccountId: null,
  savingsAmount: null,
  countsAsDebtRepayment: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

describe('sortCategoriesAlphabetically', () => {
  it('sorts by name, case-insensitively', () => {
    const result = sortCategoriesAlphabetically([
      { name: 'Utilities' },
      { name: 'food' },
      { name: 'Bonus' },
    ]);
    expect(result.map((c) => c.name)).toEqual(['Bonus', 'food', 'Utilities']);
  });

  it('does not mutate the original array', () => {
    const original = [{ name: 'Z' }, { name: 'A' }];
    sortCategoriesAlphabetically(original);
    expect(original).toEqual([{ name: 'Z' }, { name: 'A' }]);
  });
});

describe('sortAccounts', () => {
  it('puts spendable accounts before protected ones', () => {
    const result = sortAccounts([
      account({ id: 'p1', name: 'Alpha', type: 'protected' }),
      account({ id: 's1', name: 'Zulu', type: 'spendable' }),
    ]);
    expect(result.map((a) => a.id)).toEqual(['s1', 'p1']);
  });

  it('sorts alphabetically by name within the same type', () => {
    const result = sortAccounts([
      account({ id: 's_z', name: 'Zulu', type: 'spendable' }),
      account({ id: 's_a', name: 'Alpha', type: 'spendable' }),
    ]);
    expect(result.map((a) => a.id)).toEqual(['s_a', 's_z']);
  });

  it('groups by type first, then alphabetizes within each group', () => {
    const result = sortAccounts([
      account({ id: 'p_z', name: 'Zulu', type: 'protected' }),
      account({ id: 's_z', name: 'Zulu', type: 'spendable' }),
      account({ id: 'p_a', name: 'Alpha', type: 'protected' }),
      account({ id: 's_a', name: 'Alpha', type: 'spendable' }),
    ]);
    expect(result.map((a) => a.id)).toEqual(['s_a', 's_z', 'p_a', 'p_z']);
  });
});

describe('sortTransactions', () => {
  it('puts the most recent calendar date first', () => {
    const older = transaction({ id: 'tx_old', date: '2026-01-01T00:00:00.000Z' });
    const newer = transaction({ id: 'tx_new', date: '2026-01-05T00:00:00.000Z' });

    const result = sortTransactions([older, newer]);

    expect(result.map((t) => t.id)).toEqual(['tx_new', 'tx_old']);
  });

  it('within the same date, sorts by createdAt (time of entry), most recent first', () => {
    const enteredFirst = transaction({ id: 'tx_a', date: '2026-01-05T00:00:00.000Z', createdAt: '2026-01-05T09:00:00.000Z' });
    const enteredLater = transaction({ id: 'tx_b', date: '2026-01-05T00:00:00.000Z', createdAt: '2026-01-05T17:00:00.000Z' });

    const result = sortTransactions([enteredFirst, enteredLater]);

    expect(result.map((t) => t.id)).toEqual(['tx_b', 'tx_a']);
  });

  it('date takes priority over createdAt even if createdAt would suggest otherwise (e.g. a backdated entry)', () => {
    // Entered today but backdated to an earlier date than a transaction
    // entered yesterday for a more recent date.
    const backdated = transaction({ id: 'tx_backdated', date: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-10T00:00:00.000Z' });
    const recentDate = transaction({ id: 'tx_recent', date: '2026-01-05T00:00:00.000Z', createdAt: '2026-01-05T00:00:00.000Z' });

    const result = sortTransactions([backdated, recentDate]);

    expect(result.map((t) => t.id)).toEqual(['tx_recent', 'tx_backdated']);
  });
});
