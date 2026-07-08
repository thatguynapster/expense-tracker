export type AccountType = 'spendable' | 'protected';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type SafeToSpendStatus = 'safe' | 'warning' | 'danger';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). */
  deletedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  monthlyBudget?: number | null;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). */
  deletedAt: string | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  note?: string | null;
  reason?: string | null;
  savingsAccountId?: string | null;
  savingsAmount?: number | null;
  countsAsDebtRepayment?: boolean;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). */
  deletedAt: string | null;
}

export interface DisciplineState {
  id: string;
  totalWithdrawnFromSavings: number;
  totalExtraSavings: number;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). Not expected to ever be set in practice — no feature deletes discipline state. */
  deletedAt: string | null;
}

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  disciplineState: DisciplineState;
}

export interface SafeToSpendMetrics {
  usableBalance: number;
  daysRemaining: number;
  safeToSpendToday: number;
}
