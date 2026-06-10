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
}

export interface Category {
  id: string;
  name: string;
  monthlyBudget?: number | null;
  createdAt: string;
  updatedAt: string;
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
}

export interface DisciplineState {
  id: string;
  totalWithdrawnFromSavings: number;
  totalExtraSavings: number;
  createdAt: string;
  updatedAt: string;
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
