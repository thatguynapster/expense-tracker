# Folio — UI Restyle Specification v1.0

**Scope:** Visual and interaction polish only. No changes to features, data models, calculations, navigation structure, or business logic. Every screen keeps the same information and the same capabilities — this spec changes how they are rendered.

**Stack assumptions:** React Native + Expo + TypeScript + Zustand (per Folio PRD). Motion via `react-native-reanimated`, haptics via `expo-haptics`. No new heavy dependencies.

**Non-goals (explicitly out of scope for this pass):**
- Safe-to-Spend formula changes
- New alerts, insights, charts, or budget surfacing
- IOU actions (reminders, repayment flows)
- Any schema or state changes

---

## 1. Design principles

1. **Color encodes meaning, never mood.** Red = alert states only (Overdue, errors, destructive actions). Green = income/positive only. Amber = protected/caution. Expenses are neutral text with a minus sign. If everything is colored, nothing is.
2. **One container per group, not one card per row.** Rows that belong together (transactions of a day, list of accounts, IOUs of a person) render inside a single surface with hairline dividers.
3. **Say it once.** No label + sentence pairs that repeat each other. No date in a row when the section header already states it.
4. **Badges mark exceptions, not defaults.** "Spendable" (the majority state) is never badged. "Protected" and "Overdue" are.
5. **Numbers are first-class.** All amounts use tabular numerals, right-aligned, currency symbol de-emphasized relative to digits.
6. **Every touch has feedback.** Press states, count-ups, layout animation, haptics — subtle, fast, consistent.

---

## 2. Token file

Create `src/theme/theme.ts` and refactor all screens to consume it. **No screen may contain a raw hex value or raw font size after this migration.**

```ts
// src/theme/theme.ts

export const palette = {
  // Surfaces (dark theme — lifted off pure black so elevation reads)
  canvas: '#0E1116',        // screen background (was #000)
  surface: '#151A22',       // grouped list containers, cards
  surfaceRaised: '#1B2130', // pressed/hover state, modals
  hairline: '#262D3A',      // container borders
  divider: '#20262F',       // row dividers inside containers

  // Text
  textPrimary: '#F0F3F8',
  textSecondary: '#8A93A6',
  textMuted: '#6B7484',
  textDimmed: '#A9B2C2',    // de-emphasized rows (internal transfers)

  // Semantic — use ONLY for their stated meaning
  positive: '#4ADE95',      // income amounts, safe-to-spend
  positiveDim: '#7FC9A6',   // labels/metadata inside green surfaces
  positiveBg: '#112119',    // hero card fill
  positiveBorder: '#1E4030',

  alert: '#F08A8A',         // overdue, errors, destructive
  alertBg: '#2A1418',
  alertBorder: '#57222A',

  caution: '#E8B36A',       // protected accounts, warnings
  cautionBg: '#2A2113',
  cautionBorder: '#4A3A1C',

  link: '#6B93E8',          // "See all", month chevrons, text buttons

  // Category tints — icon color only, never amounts or backgrounds
  category: {
    bills: '#C9A0E8',
    food: '#7FC9A6',
    transport: '#7FB3E8',
    work: '#E8B36A',
    entertainment: '#E890B8',
    family: '#8FD0C9',
    health: '#F08A8A',      // permitted: health maps naturally to red family
    default: '#8A93A6',
    transfer: '#5A6478',    // deliberately the dullest tint in the app
    income: '#4ADE95',
  },
} as const;

export const type = {
  overline: { fontSize: 11, fontWeight: '500', letterSpacing: 0.6, color: palette.textMuted },
  caption:  { fontSize: 12, fontWeight: '400', color: palette.textSecondary },
  body:     { fontSize: 14, fontWeight: '400', color: palette.textPrimary },
  bodyBold: { fontSize: 14, fontWeight: '500', color: palette.textPrimary },
  rowTitle: { fontSize: 14, fontWeight: '500', color: palette.textPrimary },
  section:  { fontSize: 13, fontWeight: '500', letterSpacing: 0.3, color: palette.textSecondary },
  title:    { fontSize: 20, fontWeight: '500', color: palette.textPrimary },
  hero:     { fontSize: 36, fontWeight: '500' },
  heroUnit: { fontSize: 18, fontWeight: '400' },
} as const;
// Rule: exactly two weights exist in the app — 400 and 500. Never 600/700.

export const layout = {
  gutter: 20,          // horizontal screen padding
  gapSm: 8,
  gapMd: 12,
  gapLg: 16,
  sectionGap: 20,      // vertical space between sections
  rowHeight: 48,       // min row height = min touch target
  rowPaddingV: 11,
  radiusContainer: 14,
  radiusHero: 16,
  radiusPill: 999,
  fabSize: 56,
  listBottomPad: 96,   // fabSize + 40; REQUIRED on every scrollable list
} as const;

export const motion = {
  pressScale: 0.98,
  fast: 100,           // ms — press feedback
  base: 200,           // ms — layout transitions
  countUp: 600,        // ms — hero number on screen focus
} as const;
```

**Amount rendering rule (applies everywhere):**

```tsx
<Text style={{ fontVariant: ['tabular-nums'], textAlign: 'right' }}>
```

Currency symbol on hero numbers renders at `type.heroUnit` size and `positiveDim`/`textSecondary` color, superscript-aligned; digits at `type.hero`. In list rows, drop the `GH¢` prefix entirely — the sign and context carry it — or keep it at caption size if you prefer explicitness. Pick one and apply globally.

---

## 3. Shared components

Build these five components first; every screen refactor consumes them.

### 3.1 `<GroupedList>` / `<Row>`
- Container: `surface` background, `hairline` 1px border, `radiusContainer`, horizontal padding 14.
- Rows: `rowPaddingV` vertical padding, `divider` 1px bottom border (none on last row), min height `rowHeight`.
- Row layout: `[icon 18px] — 12px — [title 14/500 + subtitle 12/400 caption, ellipsized] — [right slot: amount or chevron]`.
- Icon: bare glyph tinted by category — **no circular background container.** This alone reclaims ~24px of row width and removes the current "wall of colored coins" effect.
- Press state: background animates to `surfaceRaised` over `motion.fast`; scale to `motion.pressScale`. Applies to every tappable row.

### 3.2 `<AmountText>`
- Tabular numerals, right-aligned.
- Expense: `−295.41` in `textPrimary` (weight 500). **Never red.**
- Income: `+3,800.00` in `positive` (weight 500).
- Internal transfer: unsigned, `textSecondary`, weight 400 — visually quieter than real money movement.

### 3.3 `<Badge>`
- Pill: 11px text, 2×8 padding, `radiusPill`, tinted bg + border + text from one semantic family (e.g. Protected = `caution*` set, Overdue = `alert*` set).
- Optional 10px leading icon (shield, alert-circle).
- **Only ever rendered for exception states.** Delete every "Spendable" badge in the codebase.

### 3.4 `<SectionHeader>`
- Left: `type.section` label ("Recent", "Accounts"). Right: optional `link`-colored text action ("See all").
- Date group headers inside lists use `type.overline`, short format: `JUL 9` — never `JUL 9, 2026` (year lives in the month selector). Rows under a date header do not repeat the date.

### 3.5 `<HeroCard>` (Safe-to-Spend)
- `positiveBg` fill, `positiveBorder` border, `radiusHero`, padding 18.
- Content top-to-bottom: label `Safe to spend today` (12px, `positiveDim`, sentence case — **remove the all-caps treatment and delete the "You are financially safe for today" sentence**), amount (symbol at `heroUnit`, digits at `hero`, `positive`), then one metadata line: `17 days left  ·  GH¢2,730.99 usable` (12px, tabular).
- When today's number falls below the warning threshold, the entire semantic family swaps to `caution*` (bg, border, text). Below zero: `alert*`. Same layout, different family — the color change *is* the warning UI.
- On screen focus, the amount counts up from 0 over `motion.countUp` with ease-out. Respect reduced-motion settings: skip the animation, render final value.

---

## 4. Screen-by-screen changes

### 4.1 Home (Overview)
1. Replace `Overview` + pill layout: title left (`type.title`), `July 2026` pill right (`surface` bg, `hairline` border, caption text).
2. HeroCard per §3.5. Fold "17 Days Left" into the hero metadata line and **delete the Days Left stat card.**
3. Discipline Debt card: keep the feature, change the rendering — when value is 0, collapse to a single quiet row (`GroupedList` row: "Discipline debt · GH¢0.00" in caption colors). It only earns card treatment when non-zero (then `caution` family).
4. Usable Balance card: delete — the figure now lives in the hero metadata line. (Rendering change only; same data, one fewer surface.)
5. Recent: `SectionHeader` + date-grouped `GroupedList` rows per §3.1. Internal transfers use the dimmed treatment (§3.2, `textDimmed` title, `category.transfer` icon).
6. FAB: keep, add `listBottomPad` to the scroll content so it never overlaps a row.

### 4.2 Transactions
1. Month selector: delete the full-width card. Render inline in the header row: `‹  July 2026  ›` — chevrons are 44×44 touch targets, `link` color, month label `bodyBold`.
2. Filter button: keep position; active-filter count renders as a 16px `link`-colored dot badge on the icon, not a separate pill.
3. List: identical `GroupedList` treatment as Home Recent. One container per date, `JUL 9` overline headers, no per-row dates.
4. Transfers dimmed, expenses neutral, income green (§3.2). Category icon tints per token map.
5. `listBottomPad` on the scroll view.

### 4.3 Accounts
1. Keep the Spendable / Protected summary pair, restyle as two metric tiles: `surface` bg, no border, caption label over 20px/500 tabular amount (`positive` for spendable, `caution` for protected).
2. Account list: single `GroupedList` (or two, split by Spendable/Protected with overline headers). Remove per-account cards, remove icon circles, remove all "Spendable" badges; keep `Protected` badge with shield icon.
3. Zero-balance accounts render with `textMuted` name and amount — present, scannable, quiet. (No hiding/collapsing — that would be functional.)

### 4.4 IOUs
1. Person card becomes a `GroupedList` container: header row (avatar initial circle 34px in `surface` + name `bodyBold` + total right-aligned + chevron), then one row per IOU.
2. Each IOU row: `GH¢1,000.00 · Overdue` badge line, caption metadata (`Last activity Jun 16 · Due Jul 1`), and a 4px repayment progress bar (`divider` track, `positive` fill at repaid%). At 0% repaid the empty track itself communicates state — no extra copy.
3. Empty-space fix: content is top-aligned with normal section spacing; when the list is short the screen simply ends — do not stretch cards to fill. If zero IOUs exist, render an empty state: `ti-users` glyph 24px `textMuted`, "No active IOUs" `body`, "Track money you've lent or borrowed" `caption`.

### 4.5 Settings
1. Wrap each logical cluster in a `GroupedList` with an overline header: **Rules** (Minimum savings rate, Safe-to-spend warning), **Discipline tracking** (two rows), **Budget** (chevron row), **Categories**, **About/Misc** if present.
2. Categories: collapse the inline 20-item editor behind one chevron row — `Categories` / caption `15 expense · 5 income` — pushing to a dedicated sub-screen containing the exact same editor UI. (Navigation presentation change; zero feature change.)
3. Explanatory copy ("This rate is fixed at 10%…") renders as caption text *below* its container, outside the surface — matches iOS grouped-settings convention and reduces card height.

---

## 5. Motion & haptics

| Interaction | Behavior | Spec |
|---|---|---|
| Row/button press | Scale + background | `pressScale` 0.98, bg → `surfaceRaised`, `fast` 100ms |
| Screen focus (Home) | Hero count-up | 0 → value, 600ms ease-out, once per focus |
| Transaction added | List insertion | Reanimated Layout transitions, `base` 200ms |
| Transaction deleted | Row collapse | Height + opacity out, 200ms |
| Add / save success | Haptic | `Haptics.notificationAsync(Success)` |
| Delete confirm | Haptic | `Haptics.impactAsync(Medium)` |
| Tab switch | None | Instant — tabs must feel free |
| Month prev/next | Horizontal 12px slide + fade of list | 200ms |

Global: wrap all animation triggers in a reduced-motion check (`AccessibilityInfo.isReduceMotionEnabled`); when true, skip animations, keep haptics.

---

## 6. Iconography

- Single outline icon set at 18px in rows, 20px in headers, `strokeWidth` consistent (2 if using lucide-react-native, which pairs well with this spec).
- No filled variants, no icon background circles anywhere except person avatars (initial in 34px circle, `surface` bg, `textSecondary` letter).
- Category → icon map lives beside the category → tint map in `theme.ts` so both stay in sync.

---

## 7. Implementation order (for Claude Code)

1. `src/theme/theme.ts` — tokens exactly as §2. Add an ESLint rule or grep check: no hex literals outside `theme.ts`.
2. Shared components (§3) in `src/components/ui/`: `GroupedList`, `Row`, `AmountText`, `Badge`, `SectionHeader`, `HeroCard`, plus `FabSafeScrollView` (a ScrollView/FlatList wrapper that injects `listBottomPad`).
3. Migrate screens in this order: **Transactions → Home → Accounts → IOUs → Settings.** (Transactions first: it exercises GroupedList, AmountText, date grouping, and the month selector — every primitive gets validated on the hardest screen.)
4. Motion pass (§5) after all screens compile against the new components.
5. Icon audit (§6) last.

Each step is a separate commit. Do not begin a screen migration until step 1 and 2 are merged.

---

## 8. Acceptance checklist

- [ ] Zero raw hex values or raw font sizes outside `theme.ts`
- [ ] Zero red-colored expense amounts; red appears only on Overdue badges, errors, and destructive actions
- [ ] Zero "Spendable" badges anywhere
- [ ] All amounts tabular-nums and right-aligned; column of amounts on Transactions aligns perfectly
- [ ] Only two font weights (400/500) present in the bundle
- [ ] No text repeats information already stated in its section header or hero label
- [ ] Every scrollable list has bottom padding ≥ 96px; FAB never overlaps a row at max scroll
- [ ] Every tappable row shows a visible press state within 100ms
- [ ] Hero, warning, and negative states render via semantic family swap, not ad-hoc colors
- [ ] All touch targets ≥ 44×44
- [ ] Reduced-motion setting disables count-up and layout animations
- [ ] Screens render identically in data terms to the pre-restyle build (same numbers, same rows, same actions)

---

## 9. Explicit do-nots

- Do not add gradients, glows, or shadows beyond a single subtle elevation on modals.
- Do not introduce a third font weight or a second font family.
- Do not add new information to any screen (charts, insights, alerts) — that is a separate future spec.
- Do not change any calculation, threshold, or stored value.
- Do not "improve" copy beyond the deletions specified in §3.5, §4.1, and §4.4.
