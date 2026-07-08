# Expense & Discipline Tracker

A mobile-first expense tracking app that answers one question every time you open it: **Am I financially safe for the rest of this month?**

## Run & Operate

- `pnpm --filter @workspace/expense-tracker run dev` — run the Expo app (mobile)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo + React Native (Expo Router v6)
- State: Zustand (in-memory) + AsyncStorage (persistence)
- Validation: Zod (`zod/v4`)
- Cloud sync backend (`folio-server/`, Next.js + MongoDB via Prisma) lives outside this repo — see `docs/PRD_REVIEW_TASKS.md` Priority 1 for details. It's a separate, gitignored project, not a pnpm workspace member.

## Where things live

- `artifacts/expense-tracker/` — Expo mobile app
  - `lib/types.ts` — all TypeScript interfaces (Account, Transaction, Category, DisciplineState)
  - `lib/storage.ts` — AsyncStorage persistence layer
  - `store/useStore.ts` — Zustand store with all business logic (addIncome, addExpense, addTransfer)
  - `utils/calculations.ts` — pure functions: calculateSafeToSpendToday, calculateDisciplineDebt
  - `utils/month.ts` — month helpers: getDaysRemainingInMonth
  - `utils/format.ts` — currency formatting (GHS)
  - `utils/sync.ts` — pure delta-sync diffing logic (collectDirtyRecords, applyPushResult, applyPullResult)
  - `lib/syncApi.ts` — network client for folio-server's `/api/sync` endpoint

## Architecture decisions

- **AsyncStorage over SQLite**: First build uses AsyncStorage (simpler, Expo Go compatible). Business logic is identical regardless of storage layer — can be migrated to SQLite later without changing store logic.
- **Zustand as single source of truth**: All state lives in the Zustand store. Persistence is manual (load on mount, save after each mutation). No middleware.
- **Balances are cached on accounts**: Each account stores a `balance` field updated atomically with each transaction. This avoids expensive recalculations on every render while keeping transactions as an audit trail.
- **Discipline Debt carries forward**: `totalWithdrawnFromSavings` and `totalExtraSavings` accumulate over time and never reset. Debt = `max(0, withdrawn - extraSavings)`.
- **10% minimum savings is hardcoded**: The savings rate is not configurable in V1 — enforced at `addIncome` validation level.

## Product

- **Home screen**: Large Safe-to-Spend Today card with green/yellow/red color states, days remaining, discipline debt, recent transactions, FAB.
- **Add Income**: Enforces mandatory 10% savings split between spendable and protected accounts. Extra savings auto-reduces Discipline Debt.
- **Add Expense**: Validates spendable account, warns if expense will make safe-to-spend negative.
- **Add Transfer**: 3 cases — spendable↔spendable (neutral), spendable→protected (optional debt repayment), protected→spendable (warning + required reason + increases Discipline Debt).
- **Accounts**: Shows all accounts with balance, spendable vs protected split.
- **Settings**: Savings rate display, discipline tracking stats, category CRUD.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/expense-tracker` commands from the workspace root
- Use `restart_workflow` tool to restart the Expo workflow — never run `npx expo start` directly
- `getSafeToSpendMetrics()` divides by daysRemaining — if called at month end on the last day it returns the full balance (correct)
- When adding income, `savingsAmount` must be >= `amount * 0.1` — validated in store before saving

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for mobile development patterns
