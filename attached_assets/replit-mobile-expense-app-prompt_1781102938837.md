# Replit Build Prompt: Mobile Expense & Discipline Tracker App

Build a **mobile-first expense tracking app** that helps the user instantly know whether they are overspending for the current month.

This is not a generic budgeting dashboard. The app’s core purpose is to show one clear answer every time the user opens it:

> Am I financially safe for the rest of the month?

The app should be built as a **mobile app**, preferably using **React Native with Expo**, because it is intended to be used on a phone. Do not build this as a desktop web dashboard.

---

## 1. Core Product Goal

The app must help the user:

> Instantly know if they are overspending.

The primary metric is:

## Safe-to-Spend Today

This is the maximum amount the user can spend today while still having enough money left to handle the rest of the month.

The app should make this number extremely visible on the home screen.

If Safe-to-Spend Today is:

- Positive: the user is financially safe for now
- Near zero: the user is close to danger
- Negative: the user is already financially off-track

The app should not require the user to inspect charts or tables to understand this.

---

## 2. Platform Requirements

Build a mobile-first app with:

- React Native
- Expo
- TypeScript
- Local-first persistence
- SQLite storage, preferably using `expo-sqlite`

The app does not need:

- Authentication
- Cloud sync
- Backend server
- Web dashboard
- AI features
- Charts
- Reports
- Notifications

Keep the build focused and functional.

---

## 3. Core Concepts

The app is based on five main concepts:

1. Accounts
2. Transactions
3. Categories
4. Month
5. Discipline Debt

---

# 4. Data Models

## 4.1 Account

An account represents where money is stored.

```ts
type AccountType = 'spendable' | 'protected';

interface Account {
  id: string;
  name: string;
  type: AccountType;
  createdAt: string;
  updatedAt: string;
}
```

### Account Types

#### Spendable Account

Money in this account is available for spending and affects Safe-to-Spend Today.

Examples:

- Salary Account
- Mobile Money
- Cash
- Current Account

#### Protected Account

Money in this account is treated as savings. It is excluded from Safe-to-Spend Today.

Examples:

- Savings Account
- Emergency Fund

Protected money is not casually spendable.

---

## 4.2 Transaction

Every movement of money must be recorded as a transaction.

```ts
type TransactionType = 'income' | 'expense' | 'transfer';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  note?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Transaction Types

#### Income

Money received by the user.

Income must automatically enforce the savings rule.

#### Expense

Money spent from a spendable account.

Expenses reduce Safe-to-Spend Today.

#### Transfer

Movement of money between accounts.

Transfers can be neutral or affect Safe-to-Spend depending on account types.

---

## 4.3 Category

Categories are used for expense grouping.

```ts
interface Category {
  id: string;
  name: string;
  monthlyBudget?: number | null;
  createdAt: string;
  updatedAt: string;
}
```

Categories should be simple in V1.

Default categories can include:

- Food
- Transport
- Rent
- Utilities
- Health
- Family
- Work
- Entertainment
- Miscellaneous

Monthly budgets are optional.

---

## 4.4 Month

Month defines the current financial boundary.

```ts
interface Month {
  id: string; // format: YYYY-MM
  startDate: string;
  createdAt: string;
}
```

The Month model exists to:

- Define the current budget period
- Determine days remaining in the current month
- Reset monthly calculations
- Anchor Safe-to-Spend Today to time

Do not store calculated totals in the Month model. Totals should always be derived from transactions and accounts.

---

## 4.5 Discipline State

Discipline Debt tracks how much money the user has borrowed from protected savings and has not repaid.

```ts
interface DisciplineState {
  id: string;
  totalWithdrawnFromSavings: number;
  totalExtraSavings: number;
  createdAt: string;
  updatedAt: string;
}
```

Discipline Debt is calculated as:

```ts
disciplineDebt = Math.max(0, totalWithdrawnFromSavings - totalExtraSavings);
```

Rules:

- Discipline Debt does not reset monthly
- It carries forward until repaid
- It increases when money is moved from protected savings into a spendable account
- It decreases only when the user saves more than the mandatory 10% minimum

---

# 5. Business Rules

## 5.1 Safe-to-Spend Today

Safe-to-Spend Today is calculated as:

```ts
usableBalance = sum(balance of all spendable accounts)

daysRemaining = number of days left in current month, including today

safeToSpendToday = usableBalance / daysRemaining
```

Important:

- Only spendable accounts count toward usable balance
- Protected accounts must be excluded
- The value must be recalculated after every transaction
- The value must also update daily because daysRemaining changes

### Safe-to-Spend Meaning

If the number is negative, it means the user is financially off-track and does not have enough usable money to safely cover the rest of the month.

---

## 5.2 Income Rule: Mandatory Savings

Every income transaction must enforce mandatory savings.

Savings rule:

- Minimum savings = 10% of actual received income
- This is based on actual income received, not planned income
- The user can increase the savings amount
- The user cannot reduce savings below 10%

Example:

If income received = GHS 4,000:

- Minimum savings = GHS 400
- User may save GHS 400, GHS 500, GHS 800, etc.
- User may not save GHS 399 or lower

On save:

- Protected savings account receives selected savings amount
- Selected spendable account receives remaining amount

Example:

Income = GHS 4,000  
Savings selected = GHS 600  
Spendable amount = GHS 3,400

System effects:

- Protected account +600
- Spendable account +3,400

### Extra Savings and Discipline Debt

If selected savings is greater than the mandatory 10%, the extra portion reduces Discipline Debt.

```ts
minimumSavings = incomeAmount * 0.1;
extraSavings = selectedSavings - minimumSavings;
```

If extraSavings > 0:

```ts
totalExtraSavings += extraSavings;
```

Discipline Debt cannot go below 0.

---

## 5.3 Expense Rule

An expense:

- Must be linked to a spendable account
- Must reduce that account’s balance
- Must optionally be linked to a category
- Must update Safe-to-Spend Today immediately

If Safe-to-Spend Today becomes negative after an expense, the app should show a clear warning state.

---

## 5.4 Transfer Rules

Transfers move money between accounts.

There are three cases.

---

### Case 1: Spendable → Spendable

Example:

Salary Account → Mobile Money

Rules:

- No effect on Safe-to-Spend Today
- No Discipline Debt impact
- Simply move money between spendable accounts

---

### Case 2: Spendable → Protected

Example:

Salary Account → Savings Account

Rules:

- Reduces Safe-to-Spend Today
- Does not increase Discipline Debt
- Treated as voluntary savings

If this transfer is intended to repay Discipline Debt, allow it to reduce Discipline Debt.

Recommended implementation:

- For spendable → protected transfers, ask whether this should count as “extra savings repayment” if Discipline Debt exists.
- If yes, increase totalExtraSavings by transfer amount.
- If no, only move money without changing Discipline Debt.

Keep the UI simple.

---

### Case 3: Protected → Spendable

Example:

Savings Account → Salary Account

Rules:

- Increases Safe-to-Spend Today
- Increases Discipline Debt
- Requires a warning
- Requires a reason
- Requires confirmation

The user should not be able to withdraw from savings casually.

System effect:

```ts
totalWithdrawnFromSavings += transferAmount;
```

The transaction must store the reason.

Example warning text:

> You are withdrawing from protected savings. This will increase your Discipline Debt and should only be done intentionally.

---

# 6. App Screens

## 6.1 Home Screen

This is the most important screen.

It should be simple and mobile-first.

Show only the most important information:

1. Safe-to-Spend Today
2. Days Remaining in Month
3. Discipline Debt
4. Quick Add Transaction button

### Home Screen Layout

Suggested layout:

- Large card at top: Safe-to-Spend Today
- Smaller row/card: Days Remaining
- Smaller row/card: Discipline Debt
- Large floating or fixed “+ Add” button

### Color States

Use simple visual states:

#### Green

Safe-to-Spend Today is comfortably positive.

#### Yellow

Safe-to-Spend Today is close to zero.

Suggested threshold:

- Greater than 0 but less than a configurable low threshold

#### Red

Safe-to-Spend Today is negative.

Show blunt warning text, for example:

> You are financially off-track for this month.

No charts. No tables. No dashboard clutter.

---

## 6.2 Add Transaction Screen

The user should tap one button and choose transaction type.

Options:

1. Expense
2. Income
3. Transfer

Use a mobile-friendly segmented control or tab selector.

---

## 6.3 Add Income Flow

Fields:

- Income amount
- Spendable account to receive usable portion
- Protected account for savings
- Savings amount field
- Optional note
- Date

Behavior:

- When income amount is entered, auto-calculate 10% savings
- Pre-fill savings amount with 10%
- Allow editing upward only
- Prevent user from entering less than 10%
- Show preview:
  - Minimum savings
  - Selected savings
  - Spendable amount

Example UI text:

```txt
Income received: GHS 4,000
Minimum savings: GHS 400
Savings amount: [GHS 400]
Spendable amount: GHS 3,600
```

If user enters below minimum:

> Minimum savings is 10% of received income.

On save:

- Create income transaction
- Update spendable account balance
- Update protected account balance
- Update Discipline Debt if savings is greater than 10%
- Recalculate Safe-to-Spend Today

---

## 6.4 Add Expense Flow

Fields:

- Amount
- Spendable account
- Category
- Date
- Optional note

Behavior:

- Deduct amount from selected spendable account
- Recalculate Safe-to-Spend Today
- If Safe-to-Spend becomes negative, warn user clearly

Optional warning before save:

> This expense will make you financially off-track for the rest of the month.

The app may still allow the expense, but it must show the warning.

---

## 6.5 Add Transfer Flow

Fields:

- From account
- To account
- Amount
- Date
- Optional note

Behavior depends on account types.

### Spendable → Spendable

- Save normally
- No warning

### Spendable → Protected

- Save normally
- Recalculate Safe-to-Spend
- If Discipline Debt exists, optionally ask whether this transfer should reduce Discipline Debt

### Protected → Spendable

Require:

- Warning modal
- Reason field
- Confirmation button

The reason field must not be empty.

After confirmation:

- Move money
- Increase Discipline Debt
- Recalculate Safe-to-Spend

---

## 6.6 Accounts Screen

Show all accounts with:

- Account name
- Account type
- Current derived balance

Protected accounts should be visually marked.

Allow user to:

- Create account
- Edit account name
- Choose account type

For V1, deleting accounts is optional and should be handled carefully if transactions exist.

---

## 6.7 Categories Screen

Show expense categories.

Allow user to:

- Create category
- Edit category
- Set optional monthly budget

Keep this simple.

---

## 6.8 Transactions List Screen

Show recent transactions.

Each transaction item should display:

- Type
- Amount
- Date
- Account movement
- Category if expense
- Note/reason if provided

This is useful for traceability.

---

# 7. Calculation Requirements

## 7.1 Derived Account Balances

Account balances should be derived from transactions, not manually edited.

However, for app simplicity, it is acceptable to maintain cached balances if they are always updated through transaction operations.

Preferred approach:

- Store transactions as source of truth
- Derive balances from transactions
- Use helper functions to calculate current balances

Do not allow random manual balance edits after setup.

---

## 7.2 Safe-to-Spend Helper

Create a dedicated utility function:

```ts
function calculateSafeToSpendToday(accounts, transactions, currentDate): {
  usableBalance: number;
  daysRemaining: number;
  safeToSpendToday: number;
}
```

Rules:

- Sum only spendable account balances
- Determine days remaining in current month including today
- Divide usableBalance by daysRemaining

---

## 7.3 Discipline Debt Helper

Create a dedicated utility function:

```ts
function calculateDisciplineDebt(state): number {
  return Math.max(0, state.totalWithdrawnFromSavings - state.totalExtraSavings);
}
```

---

## 7.4 Month Helper

Create helper functions to:

- Get current month id in YYYY-MM format
- Get days remaining in the current month, including today
- Detect month boundary

Do not reset Discipline Debt at month boundary.

---

# 8. Database Requirements

Use SQLite.

Create tables for:

- accounts
- categories
- transactions
- discipline_state
- months

Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('spendable', 'protected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_budget REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  category_id TEXT,
  from_account_id TEXT,
  to_account_id TEXT,
  note TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(category_id) REFERENCES categories(id),
  FOREIGN KEY(from_account_id) REFERENCES accounts(id),
  FOREIGN KEY(to_account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS discipline_state (
  id TEXT PRIMARY KEY,
  total_withdrawn_from_savings REAL NOT NULL DEFAULT 0,
  total_extra_savings REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS months (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

Seed data:

- Create one spendable account: Salary Account
- Create one protected account: Savings Account
- Create default categories
- Create one discipline_state row

---

# 9. State Management

Use a simple state management setup.

Recommended:

- Zustand

Store should manage:

- accounts
- categories
- transactions
- discipline state
- derived home metrics

Important:

- Business logic should not live inside UI components
- Put calculation logic in separate utility/service files
- UI components should call clean functions like `addIncome`, `addExpense`, `addTransfer`

---

# 10. Required Services / Functions

Implement these functions clearly.

## addIncome

```ts
addIncome({
  amount,
  spendableAccountId,
  protectedAccountId,
  selectedSavingsAmount,
  date,
  note,
})
```

Validation:

- amount > 0
- selectedSavingsAmount >= amount * 0.1
- selectedSavingsAmount <= amount
- spendableAccountId must refer to spendable account
- protectedAccountId must refer to protected account

Effects:

- Record income transaction
- Allocate savings to protected account
- Allocate remainder to spendable account
- If selectedSavingsAmount > minimumSavings, increase totalExtraSavings by difference

Implementation may record this as one income transaction with metadata or as generated internal movements. Keep the UI simple.

---

## addExpense

```ts
addExpense({
  amount,
  accountId,
  categoryId,
  date,
  note,
})
```

Validation:

- amount > 0
- accountId must be spendable

Effects:

- Record expense transaction
- Reduce spendable account balance through derived transaction logic
- Recalculate Safe-to-Spend Today

---

## addTransfer

```ts
addTransfer({
  amount,
  fromAccountId,
  toAccountId,
  date,
  note,
  reason,
  countsAsDebtRepayment,
})
```

Validation:

- amount > 0
- fromAccountId and toAccountId must be different
- if fromAccount is protected and toAccount is spendable, reason is required

Effects:

- Record transfer transaction
- If protected → spendable:
  - increase totalWithdrawnFromSavings by amount
- If spendable → protected and countsAsDebtRepayment is true:
  - increase totalExtraSavings by amount
- Recalculate Safe-to-Spend Today

---

# 11. UI Requirements

## Design Style

Use a clean, simple, modern mobile UI.

Avoid spreadsheet-like tables on the home screen.

Use:

- Large readable text
- Cards
- Clear spacing
- Obvious buttons
- Clear color states

Do not overload the home screen.

---

## Navigation

Use simple bottom tab navigation or stack navigation.

Recommended tabs:

1. Home
2. Transactions
3. Accounts
4. Settings

The Add Transaction action should be very accessible, either as:

- Floating action button
- Big button on Home

---

# 12. Settings Screen

Include basic settings:

- Minimum savings rate: default 10%

For V1, this can be visible but locked or editable with caution.

If editable, ensure it cannot be set below 10% unless intentionally supported later. For now, keep 10% fixed.

---

# 13. Validation Rules

Implement strong validation.

- Amounts must be positive numbers
- Income savings must be at least 10%
- Expense account must be spendable
- Protected → spendable transfer must require reason
- Transfer accounts cannot be the same
- Required fields must be enforced

---

# 14. Important UX Copy

Use clear, direct language.

Examples:

### Negative Safe-to-Spend

> You are financially off-track for this month.

### Income Below Savings Minimum

> Minimum savings is 10% of received income.

### Savings Withdrawal Warning

> You are withdrawing from protected savings. This will increase your Discipline Debt.

### Discipline Debt Label

> Discipline Debt

Description:

> Money withdrawn from savings that has not yet been repaid through extra savings.

---

# 15. Out of Scope for V1

Do not build these yet:

- Charts
- Advanced reports
- Budget analytics
- AI categorization
- Bank integrations
- Cloud sync
- Authentication
- Multi-currency
- Recurring transactions
- Push notifications
- Web dashboard

These are distractions for V1.

---

# 16. MVP Completion Criteria

The app is complete when all of these work:

1. User can create spendable and protected accounts
2. User can add income
3. Income automatically enforces minimum 10% savings
4. User cannot save less than 10% of received income
5. User can save more than 10%
6. Extra savings reduce Discipline Debt
7. User can add expenses from spendable accounts
8. Expenses update Safe-to-Spend Today immediately
9. User can transfer money between accounts
10. Spendable → spendable transfers are neutral
11. Spendable → protected transfers reduce Safe-to-Spend Today
12. Protected → spendable transfers require reason and warning
13. Protected → spendable transfers increase Discipline Debt
14. Safe-to-Spend Today appears prominently on Home
15. Discipline Debt appears prominently on Home
16. Days remaining in month appears on Home
17. Safe-to-Spend recalculates after every transaction
18. Discipline Debt carries forward and does not reset monthly
19. App works locally without backend or login
20. App is mobile-first and usable on a phone

---

# 17. Final Instruction

Build the app as a focused mobile prototype.

Prioritize correct business logic over decorative UI.

The most important screen is the Home screen.

The most important calculation is Safe-to-Spend Today.

The most important behavior rule is protected savings plus Discipline Debt.

Do not expand the scope beyond this specification.
