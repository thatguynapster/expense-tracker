# Folio / Expense Tracker — PRD Review Findings

Reviewed: 2026-07-01
Source PRD: `Folio_PRD_v1.0_1.pdf` (v1.0, June 2026)
Codebase reviewed: `artifacts/expense-tracker` (Expo mobile app) and `artifacts/api-server` (Express backend)

This document compares what the PRD specifies against what is actually implemented today. It's organized by severity so you can triage. Nothing here has been changed yet — this is purely observational.

---

## 1. Missing entire features (high impact)

### 1.1 Loans — not built at all
The PRD dedicates a full data model (`Loan`, `LoanPayment`), a business rule section (4.5), a whole navigation tab, a Loans screen with Active/Settled sections and a per-borrower detail/timeline view, a Home screen "Loans Summary" card, and 8 of the 28 MVP completion criteria (12–19) to loan tracking ("who owes me money" is literally half of the app's core question in section 1). None of this exists in the code:
- No `Loan` or `LoanPayment` type in `lib/types.ts`.
- No Loans tab in `app/(tabs)/_layout.tsx` (only Home, Transactions, Accounts, Settings — 4 tabs instead of the specified 5).
- No loans summary card, no overdue badge, no borrower tracking anywhere.

This is the single biggest gap versus the PRD — the app currently only answers "am I financially safe," not "who owes me money."

### 1.2 Budget tracking — not built (field exists but is dead)
The PRD's `Budget` model is per-category-per-month (`categoryId`, `month`, `plannedAmount`), with actuals always derived from transactions and a `getMonthSummary()` helper returning planned-vs-actual per category. MVP criteria 24–25 require this.

What exists instead: `Category` has an optional `monthlyBudget` field, but it's:
- Never read or written anywhere in the UI (not in Settings, not in the add-transaction flow, not on Home).
- Not month-scoped — a single static number per category, not per calendar month, so it can't represent "planned for July vs planned for August" as the PRD requires.
- There is no `getMonthSummary`, no planned-vs-actual view anywhere.

Effectively this is an orphaned field with no feature behind it.

### 1.3 Cloud backup / sync — not built
The PRD's stated rationale (section 2, "Sync Rationale") is explicit: *"MongoDB provides cloud backup so a lost or replaced phone does not destroy financial history."* The specified architecture is `expo-sqlite` as a local write-through cache, syncing to MongoDB via Next.js API routes.

Actual implementation:
- Storage is `AsyncStorage` only (`lib/storage.ts`), a single JSON blob under one key, with **zero backup or sync**.
- The `api-server` package exists (Express 5 + Postgres/Drizzle, per `replit.md`) but only implements a health-check route — no transactions/accounts/sync endpoints, and the mobile app has no API client wired to it at all.
- Practically: if this phone is lost, reset, or the app is uninstalled, **all financial history is gone**. Given this is meant to be your real personal finance tracker, this is the gap most worth prioritizing.

Note the backend stack itself also diverges from the PRD (Next.js + MongoDB specified vs. Express + PostgreSQL/Drizzle built) — not wrong per se, but worth knowing if you ever want to follow PRD-written setup guides literally.

---

## 2. Implemented but diverging from spec (medium impact)

### 2.1 Expense category is optional, PRD requires it
PRD section 8 (Validation Rules): *"Category on expense — Required — cannot save without selecting one."* In `add-transaction.tsx`, the expense category selector is explicitly labeled "Category (optional)" and `addExpense` in the store accepts `categoryId?: string` with no enforcement. You can currently save an expense with no category, which will silently break any future budget/reporting feature that groups by category.

### 2.2 Categories have no `type` (income vs expense)
The PRD's `Category` interface has `type: 'income' | 'expense'`, and budget rules explicitly depend on this (4.6: "Budget carries no meaning for income categories"). The actual `Category` type has no `type` field — there is one flat list of categories shared across income and expense, and income transactions don't even use `categoryId` (missing from `AddIncomeParams`, contradicting the PRD's `addIncome` signature in 7.1 which includes `categoryId`). Practically this means a user could pick "Salary" as an expense category, or "Rent" as an income category, with nothing to stop them.

### 2.3 Protected → Spendable withdrawal doesn't have a true confirmation modal
PRD MVP criterion #10 requires transfers from protected to spendable accounts to "require a reason and confirmation modal" before the debt-increasing transfer is committed. Today, a native `Alert.alert` fires once, as an FYI, at the moment you *pick* the destination account — not as a final confirm-before-save gate. If you change the amount afterward and hit Save, there is no second confirmation; the reason field is required, but the "are you sure" step is a one-time toast rather than a blocking dialog at submission time.

### 2.4 Safe-to-Spend low threshold is hardcoded, PRD says it should be a configurable Setting
PRD section 5.7 lists "Safe-to-Spend low threshold — Default GHS 50/day. Editable." as a Settings item. In code, `WARNING_THRESHOLD = 50` is a hardcoded constant in `utils/calculations.ts` with no corresponding UI in `settings.tsx` to change it.

### 2.5 No transaction filtering
PRD 5.4: Transactions screen should be "Filterable by: month, account, category, type." The current `transactions.tsx` only groups the full unfiltered list by date — there's no filter UI of any kind. As transaction volume grows this screen will become a long unfiltered scroll.

### 2.6 Account deletion doesn't exist (PRD implies it should, just gated)
PRD 5.5: "Actions: Create account, Edit name/type. **Delete** is disabled if transactions exist against the account" — implying delete exists but is guarded. Today there is no delete action anywhere for accounts (not even a disabled one). Minor, but if you create a duplicate/misnamed account by mistake there's currently no way to remove it, ever.

### 2.7 Account type is immutable after creation, but per PRD editing "type" should be allowed
PRD 5.5 lists "Edit name/**type**" as an available action. The current `add-account.tsx` explicitly disables changing type after creation ("Account type cannot be changed after creation"). This is arguably a *reasonable* deliberate safety choice (changing protected↔spendable after transactions exist would corrupt Safe-to-Spend history), but it's a silent deviation from the written spec worth being aware of, not necessarily one to "fix."

---

## 3. Smaller gaps / polish items (low impact)

- **No month boundary / month browsing.** PRD's `Month` entity and MVP criterion #26 ("month-to-month history is preserved and browsable") aren't reflected in any screen — Transactions just shows an infinite chronological list, no per-month view/rollup.
- **`getMonthSummary` and other calculation helpers from PRD §7.6 don't exist** (`getLoanOutstanding` — N/A without loans; `getMonthSummary` — missing entirely). Only `calculateSafeToSpendToday`, `calculateDisciplineDebt`, and `getSafeToSpendStatus` are implemented.
- **Persistence writes the entire dataset on every mutation** (`saveAppData` re-serializes and re-writes the whole JSON blob to AsyncStorage on every single transaction). Fine at current scale, but worth knowing this doesn't scale indefinitely — a natural motivator to move to SQLite sooner rather than later, which also happens to close gap 1.3 above.
- **Out-of-scope items correctly excluded**: Charts, PDF/Excel export, push notifications, recurring transactions, multi-currency, auth, web dashboard, AI categorization, bank integrations — none of these are built, matching the PRD's explicit V1 exclusions. No issue here, just confirming scope was respected where the PRD asked for restraint.

---

## 4. What *is* solid

To be clear about what's working well and matches the PRD closely:
- Safe-to-Spend calculation (`usableBalance / daysRemaining`) matches the spec exactly, including the correct "full balance on the last day" edge case.
- Mandatory 10%-minimum savings split on income, with extra-savings-reduces-debt logic, matches PRD 4.2 precisely.
- Discipline Debt accumulation/derivation (`max(0, withdrawn - extraSavings)`) matches PRD 3.7 exactly.
- Transfer rules (spendable↔spendable neutral, spendable→protected decreases Safe-to-Spend, protected→spendable increases debt + requires reason) all match PRD 4.4.
- Expense-goes-negative behavior (warn, don't block) matches PRD 4.3 exactly.
- Color-coded status states (green/yellow/red) and copy strings largely match PRD §10 UX copy reference.
- Default seed accounts/categories are close to the PRD's seed data (a few category names differ slightly — e.g. no separate "Bills," "Insurance," "Communications" as their own entries — but this is trivial to adjust in `lib/storage.ts`).

---

## Suggested priority order (for discussion, not yet actioned)

1. **Cloud backup** (§1.3) — highest real-world risk; a single lost phone currently means total data loss.
2. **Loans feature** (§1.1) — biggest missing feature relative to PRD scope; half the app's stated purpose.
3. **Expense category required + income/expense category typing** (§2.1, §2.2) — small fix, prevents data-quality issues that will be annoying to clean up later.
4. **Budget feature** (§1.2) — lower urgency since nothing currently depends on it, but the dead `monthlyBudget` field should either be built out or removed.
5. Everything in §2.3–§2.7 and §3 — polish, tackle opportunistically.
