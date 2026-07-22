import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD, getTransactionReversal } from '@/utils/calculations';
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
    customDailyBudget: null,
    // A brand-new install has nothing to correct — DEFAULT_DATA never has
    // any loans/payments — so this starts already "applied" rather than
    // null, which would otherwise make backfillLoanTransactions do a
    // pointless (harmless, but wasteful) first pass on every fresh install.
    loanRepaymentBalanceCorrectionAppliedAt: ts(),
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
    customDailyBudget: state.customDailyBudget ?? null,
    // Missing (pre-upgrade) means the correction genuinely hasn't run yet —
    // leave it null so backfillLoanTransactions below applies it.
    loanRepaymentBalanceCorrectionAppliedAt: state.loanRepaymentBalanceCorrectionAppliedAt ?? null,
  });

  const normalized: AppData = {
    accounts: data.accounts.map((a: Account) => withSyncFields(a)),
    categories: data.categories.map((c: Category) => withCategoryType(c)),
    transactions: data.transactions.map((t: Transaction) => withSyncFields(t)),
    disciplineState: withWarningThreshold(data.disciplineState as DisciplineState),
    loans: (data.loans ?? []).map((l: Loan) => withSyncFields(l)),
    loanPayments: (data.loanPayments ?? []).map((p: LoanPayment) => withSyncFields(p)),
    budgets: (data.budgets ?? []).map((b: Budget) => withSyncFields(b)),
  };

  // Loan backfill must run first: it can add transactions and correct
  // balances in the same pass, and the account-starting-balance backfill
  // below needs to see that final, settled state to reconstruct each
  // account's true opening balance correctly.
  return backfillAccountStartingBalances(backfillLoanTransactions(normalized));
}

/**
 * One-time backfill for loans/loan payments recorded before disbursement and
 * repayment got their own mirror Transactions (previously they only moved
 * account balances directly, with no ledger trace at all). Generates the
 * same transactions `addLoan`/`recordLoanRepayment` create going forward,
 * skipping any that already exist by id — safe to run on every app load
 * rather than needing a one-time flag, since a loan/payment's id + suffix is
 * a stable, deterministic transaction id.
 *
 * Transaction generation aside, account balances already reflect the
 * disbursement and the repayment-to-sourceAccountId credit from when they
 * were originally recorded under the old code. The one exception: a
 * repayment whose destinationAccountId differed from sourceAccountId — the
 * old code only ever credited sourceAccountId, so its balance is currently
 * overstated by that amount and destinationAccountId's is understated by the
 * same. This corrects both balances by that amount for every such repayment,
 * gated on `disciplineState.loanRepaymentBalanceCorrectionAppliedAt` being
 * null — deliberately synced data, not a local-only flag: a device that
 * pulls already-corrected balances from the server also pulls the fact that
 * they're already corrected, so it never re-applies the correction on top of
 * numbers that don't need it. (An earlier version of this used a local
 * AsyncStorage flag instead, which had exactly that bug — a fresh install
 * pulling corrected data still had no local record the correction had run,
 * and would silently double-apply it on the next local reload.) Not tying
 * this to "is the transfer transaction newly generated" either: a device may
 * already have that transaction from an earlier backfill run that never
 * applied the correction, so transaction existence alone can't be trusted.
 */
export function backfillLoanTransactions(data: AppData): AppData {
  const applyLoanBalanceCorrection = data.disciplineState.loanRepaymentBalanceCorrectionAppliedAt == null;
  const existingIds = new Set(data.transactions.map((t) => t.id));
  const generated: Transaction[] = [];
  const accountDeltas = new Map<string, number>();

  for (const loan of data.loans) {
    if (loan.deletedAt) continue;
    const disbursementId = `${loan.id}_disbursement`;
    if (existingIds.has(disbursementId)) continue;
    generated.push({
      id: disbursementId,
      type: 'loan_disbursement',
      amount: loan.principal,
      date: loan.dateLent,
      fromAccountId: loan.sourceAccountId,
      toAccountId: null,
      categoryId: null,
      note: loan.note ?? null,
      loanId: loan.id,
      loanPaymentId: null,
      createdAt: loan.createdAt,
      updatedAt: loan.createdAt,
      syncedAt: null,
      deletedAt: null,
    });
  }

  for (const payment of data.loanPayments) {
    if (payment.deletedAt) continue;
    const loan = data.loans.find((l) => l.id === payment.loanId);
    if (!loan) continue;

    const repaymentId = `${payment.id}_repayment`;
    if (!existingIds.has(repaymentId)) {
      generated.push({
        id: repaymentId,
        type: 'loan_repayment',
        amount: payment.amount,
        date: payment.date,
        fromAccountId: null,
        toAccountId: loan.sourceAccountId,
        categoryId: null,
        note: payment.note ?? null,
        loanId: null,
        loanPaymentId: payment.id,
        createdAt: payment.createdAt,
        updatedAt: payment.createdAt,
        syncedAt: null,
        deletedAt: null,
      });
    }

    if (payment.destinationAccountId !== loan.sourceAccountId) {
      const transferId = `${payment.id}_transfer`;
      if (!existingIds.has(transferId)) {
        generated.push({
          id: transferId,
          type: 'transfer',
          amount: payment.amount,
          date: payment.date,
          fromAccountId: loan.sourceAccountId,
          toAccountId: payment.destinationAccountId,
          categoryId: null,
          note: payment.note ?? null,
          reason: null,
          countsAsDebtRepayment: false,
          loanId: null,
          loanPaymentId: payment.id,
          createdAt: payment.createdAt,
          updatedAt: payment.createdAt,
          syncedAt: null,
          deletedAt: null,
        });
      }
      if (applyLoanBalanceCorrection) {
        accountDeltas.set(loan.sourceAccountId, (accountDeltas.get(loan.sourceAccountId) ?? 0) - payment.amount);
        accountDeltas.set(
          payment.destinationAccountId,
          (accountDeltas.get(payment.destinationAccountId) ?? 0) + payment.amount,
        );
      }
    }
  }

  if (generated.length === 0 && accountDeltas.size === 0 && !applyLoanBalanceCorrection) return data;

  const accounts = accountDeltas.size === 0
    ? data.accounts
    : data.accounts.map((a) =>
        accountDeltas.has(a.id)
          ? { ...a, balance: a.balance + accountDeltas.get(a.id)!, updatedAt: ts(), syncedAt: null }
          : a,
      );

  // Marks the correction as applied whenever this pass considered it
  // (whether or not there was actually anything to correct), so it's a
  // permanent, synced fact rather than something re-derived on every load.
  const disciplineState = applyLoanBalanceCorrection
    ? { ...data.disciplineState, loanRepaymentBalanceCorrectionAppliedAt: ts(), updatedAt: ts(), syncedAt: null }
    : data.disciplineState;

  return {
    ...data,
    accounts,
    disciplineState,
    transactions: generated.length === 0 ? data.transactions : [...data.transactions, ...generated],
  };
}

/**
 * One-time backfill for the other gap in the transaction ledger: an
 * account's "Starting Balance" at creation used to just set `balance`
 * directly with no transaction behind it (addAccount now mirrors it as an
 * adjustment — see there — but that only covers accounts created after that
 * fix). For every account still missing its opening-balance transaction,
 * reconstructs what that starting balance must have been by walking every
 * other transaction that's ever touched the account and subtracting their
 * combined effect back out of the current balance — the same reconstruction
 * approach calculateSafeToSpendToday uses for "balance as of the start of
 * today", just over the account's whole lifetime instead of one day.
 *
 * Purely additive — like the loan disbursement/repayment backfill, it never
 * touches account balances, only adds the transaction that explains the
 * balance already there. Safe to run on every load: once an account has its
 * `${account.id}_opening_balance` transaction, the implied amount is 0 and
 * nothing further is generated.
 */
export function backfillAccountStartingBalances(data: AppData): AppData {
  const existingIds = new Set(data.transactions.map((t) => t.id));
  const activeTransactions = data.transactions.filter((t) => !t.deletedAt);
  const generated: Transaction[] = [];

  for (const account of data.accounts) {
    if (account.deletedAt) continue;
    const openingId = `${account.id}_opening_balance`;
    if (existingIds.has(openingId)) continue;

    const netTransactionEffect = activeTransactions.reduce((sum, t) => {
      // getTransactionReversal gives the delta that UNDOES a transaction, so
      // its negation is the delta the transaction actually APPLIED — sum
      // those to get this account's total movement across its whole history.
      const reversalDelta = getTransactionReversal(t, data.accounts).accountDeltas.find(
        (d) => d.accountId === account.id,
      )?.delta;
      return sum - (reversalDelta ?? 0);
    }, 0);

    const impliedStartingBalance = account.balance - netTransactionEffect;
    if (impliedStartingBalance === 0) continue;

    generated.push({
      id: openingId,
      type: 'adjustment',
      amount: Math.abs(impliedStartingBalance),
      date: account.createdAt,
      fromAccountId: impliedStartingBalance < 0 ? account.id : null,
      toAccountId: impliedStartingBalance > 0 ? account.id : null,
      note: 'Starting balance',
      createdAt: account.createdAt,
      updatedAt: account.createdAt,
      syncedAt: null,
      deletedAt: null,
    });
  }

  if (generated.length === 0) return data;
  return { ...data, transactions: [...data.transactions, ...generated] };
}

export async function loadAppData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as AppData;
    const migrated = migrate(parsed);

    // Saved immediately rather than waiting for the next natural persist()
    // from a user action — otherwise a device that's closed right after
    // this load would never durably record the migration (backfilled
    // transactions, the loan balance correction, or any future migration
    // step), and it would silently never take effect even though the
    // in-memory session looked correct.
    await saveAppData(migrated);

    return migrated;
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
