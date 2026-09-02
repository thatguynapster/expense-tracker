/**
 * One-off manual verification script — exercises the real sync module
 * (collectDirtyRecords, pushToServer, pullFromServer, applyPullResult,
 * applyPushResult) against the live folio-server deployment, not just
 * curl/HTTP-contract checks. Run with a real .env configured:
 *
 *   npx tsx scripts/verify-sync.ts
 *
 * Not part of the automated test suite (hits a real server with real side
 * effects) — this is a manual troubleshooting tool. Cleans up after itself.
 */
process.loadEnvFile('.env');

import { applyPullResult, applyPushResult, collectDirtyRecords, hasDirtyRecords, type SyncedAppData } from '../src/utils/sync';
import { pullFromServer, pushToServer } from '../src/lib/syncApi';
import type { Account, Budget, Category, Loan, LoanPayment } from '../src/lib/types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  ok — ${message}`);
}

const now = () => new Date().toISOString();

async function main() {
  console.log('1. Simulating a fresh-install AppData with dirty seed data...');
  const testData: SyncedAppData = {
    accounts: [
      { id: 'acc_verify_1', name: 'Verify Salary', type: 'spendable', balance: 500, createdAt: now(), updatedAt: now(), syncedAt: null, deletedAt: null },
    ],
    categories: [
      { id: 'cat_verify_1', name: 'Verify Food', type: 'expense', createdAt: now(), updatedAt: now(), syncedAt: null, deletedAt: null },
    ],
    transactions: [],
    disciplineState: { id: 'discipline_verify_test', totalWithdrawnFromSavings: 0, totalExtraSavings: 0, safeToSpendWarningThreshold: 50, customDailyBudget: null, createdAt: now(), updatedAt: now(), syncedAt: null, deletedAt: null },
    loans: [
      { id: 'loan_verify_1', borrowerName: 'Verify Borrower', principal: 200, dateLent: now(), expectedRepaymentDate: null, note: null, sourceAccountId: 'acc_verify_1', settledAt: null, createdAt: now(), updatedAt: now(), syncedAt: null, deletedAt: null },
    ],
    loanPayments: [
      { id: 'pay_verify_1', loanId: 'loan_verify_1', amount: 50, date: now(), destinationAccountId: 'acc_verify_1', note: null, createdAt: now(), updatedAt: now(), syncedAt: null, deletedAt: null },
    ],
    budgets: [
      { id: 'budget_verify_1', categoryId: 'cat_verify_1', month: '2026-01', plannedAmount: 150, createdAt: now(), updatedAt: now(), syncedAt: null, deletedAt: null },
    ],
  };

  console.log('2. collectDirtyRecords()...');
  const dirty = collectDirtyRecords(testData);
  assert(hasDirtyRecords(dirty), 'dirty payload is non-empty');
  assert(
    dirty.accounts.length === 1 && dirty.categories.length === 1 && dirty.loans.length === 1 && dirty.loanPayments.length === 1 && dirty.budgets.length === 1,
    'exactly the seeded records are dirty (including the loan, its payment, and the budget)',
  );

  console.log('3. pushToServer() — real network call...');
  const pushed = await pushToServer(dirty);
  assert(pushed === true, 'push succeeded (200 from the real server)');

  console.log('4. pullFromServer() — real network call...');
  const pulled = await pullFromServer();
  assert(pulled !== null, 'pull returned data (not null)');
  assert(pulled!.accounts.some((a: Account) => a.id === 'acc_verify_1'), 'pushed account is visible via pull');
  assert(pulled!.categories.some((c: Category) => c.id === 'cat_verify_1'), 'pushed category is visible via pull');
  assert(pulled!.loans.some((l: Loan) => l.id === 'loan_verify_1'), 'pushed loan is visible via pull');
  assert(pulled!.loanPayments.some((p: LoanPayment) => p.id === 'pay_verify_1'), 'pushed loan payment is visible via pull');
  assert(pulled!.budgets.some((b: Budget) => b.id === 'budget_verify_1'), 'pushed budget is visible via pull');

  console.log('5. applyPullResult() — reconstructing local AppData from the pull...');
  const restored = applyPullResult(pulled!, now(), testData.disciplineState);
  assert(restored.accounts.every((a: Account) => a.syncedAt !== null), 'every restored account is marked synced');
  assert(restored.accounts.find((a: Account) => a.id === 'acc_verify_1') !== undefined, 'restored AppData contains the test account');
  assert(restored.loans.find((l: Loan) => l.id === 'loan_verify_1') !== undefined, 'restored AppData contains the test loan — this is the exact fresh-install path that previously lost loans');
  assert(restored.loanPayments.find((p: LoanPayment) => p.id === 'pay_verify_1') !== undefined, 'restored AppData contains the test loan payment');
  assert(restored.budgets.find((b: Budget) => b.id === 'budget_verify_1') !== undefined, 'restored AppData contains the test budget');

  console.log('6. applyPushResult() — simulating the local reconciliation step after a push...');
  const reconciled = applyPushResult(testData, dirty, now());
  assert(reconciled.accounts.find((a: Account) => a.id === 'acc_verify_1')?.syncedAt !== null, 'pushed account marked synced locally');
  assert(reconciled.loans.find((l: Loan) => l.id === 'loan_verify_1')?.syncedAt !== null, 'pushed loan marked synced locally');
  assert(reconciled.budgets.find((b: Budget) => b.id === 'budget_verify_1')?.syncedAt !== null, 'pushed budget marked synced locally');

  console.log('7. Cleaning up — soft-deleting test records and pushing the tombstones...');
  const tombstoneAccount = { ...testData.accounts[0]!, deletedAt: now(), syncedAt: null };
  const tombstoneCategory = { ...testData.categories[0]!, deletedAt: now(), syncedAt: null };
  const tombstoneDisciplineState = { ...testData.disciplineState, deletedAt: now(), syncedAt: null };
  const tombstoneLoan = { ...testData.loans[0]!, deletedAt: now(), syncedAt: null };
  const tombstoneLoanPayment = { ...testData.loanPayments[0]!, deletedAt: now(), syncedAt: null };
  const tombstoneBudget = { ...testData.budgets[0]!, deletedAt: now(), syncedAt: null };
  const cleanupPush = await pushToServer({
    accounts: [tombstoneAccount],
    categories: [tombstoneCategory],
    transactions: [],
    disciplineState: tombstoneDisciplineState,
    loans: [tombstoneLoan],
    loanPayments: [tombstoneLoanPayment],
    budgets: [tombstoneBudget],
  });
  assert(cleanupPush === true, 'cleanup push (tombstones) succeeded');

  console.log('8. Final pull — confirming the server no longer has the test records...');
  const finalPull = await pullFromServer();
  assert(finalPull !== null, 'final pull returned data');
  assert(!finalPull!.accounts.some((a: Account) => a.id === 'acc_verify_1'), 'test account is gone from the server');
  assert(finalPull!.disciplineState === null, 'test disciplineState is gone from the server');
  assert(!finalPull!.categories.some((c: Category) => c.id === 'cat_verify_1'), 'test category is gone from the server');
  assert(!finalPull!.loans.some((l: Loan) => l.id === 'loan_verify_1'), 'test loan is gone from the server');
  assert(!finalPull!.loanPayments.some((p: LoanPayment) => p.id === 'pay_verify_1'), 'test loan payment is gone from the server');
  assert(!finalPull!.budgets.some((b: Budget) => b.id === 'budget_verify_1'), 'test budget is gone from the server');

  console.log('\nAll sync module functions verified against the live server. Cleaned up successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
