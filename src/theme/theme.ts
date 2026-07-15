import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

import type { Category } from '@/lib/types';

// Restyle spec §2 (docs/restyle-spec.md). This file is the only place in src/
// where a hex color or a font size may appear — `npm run check:theme` enforces it.

export const palette = {
  // Surfaces (dark theme — lifted off pure black so elevation reads)
  canvas: '#0E1116', // screen background
  surface: '#151A22', // grouped list containers, cards
  surfaceRaised: '#1B2130', // pressed/hover state, modals
  hairline: '#262D3A', // container borders
  divider: '#20262F', // row dividers inside containers

  // Text
  textPrimary: '#F0F3F8',
  textSecondary: '#8A93A6',
  textMuted: '#6B7484',
  textDimmed: '#A9B2C2', // de-emphasized rows (internal transfers)

  // Semantic — use ONLY for their stated meaning
  positive: '#4ADE95', // income amounts, safe-to-spend
  positiveDim: '#7FC9A6', // labels/metadata inside green surfaces
  positiveBg: '#112119', // hero card fill
  positiveBorder: '#1E4030',

  alert: '#F08A8A', // overdue, errors, destructive
  alertBg: '#2A1418',
  alertBorder: '#57222A',

  caution: '#E8B36A', // protected accounts, warnings
  cautionBg: '#2A2113',
  cautionBorder: '#4A3A1C',

  link: '#6B93E8', // "See all", month chevrons, text buttons

  // Category tints — icon color only, never amounts or backgrounds
  category: {
    bills: '#C9A0E8',
    food: '#7FC9A6',
    transport: '#7FB3E8',
    work: '#E8B36A',
    entertainment: '#E890B8',
    family: '#8FD0C9',
    health: '#F08A8A', // permitted: health maps naturally to red family
    default: '#8A93A6',
    transfer: '#5A6478', // deliberately the dullest tint in the app
    income: '#4ADE95',
  },
} as const;

// Weight is selected through the Inter font file, not numeric fontWeight —
// exactly two weights exist in the app. Never load or reference SemiBold/Bold.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
} as const;

export const type = {
  overline: { fontSize: 11, fontFamily: font.medium, letterSpacing: 0.6, color: palette.textMuted },
  caption: { fontSize: 12, fontFamily: font.regular, color: palette.textSecondary },
  body: { fontSize: 14, fontFamily: font.regular, color: palette.textPrimary },
  bodyBold: { fontSize: 14, fontFamily: font.medium, color: palette.textPrimary },
  rowTitle: { fontSize: 14, fontFamily: font.medium, color: palette.textPrimary },
  section: { fontSize: 13, fontFamily: font.medium, letterSpacing: 0.3, color: palette.textSecondary },
  title: { fontSize: 20, fontFamily: font.medium, color: palette.textPrimary },
  hero: { fontSize: 36, fontFamily: font.medium },
  heroUnit: { fontSize: 18, fontFamily: font.regular },
  badge: { fontSize: 11, fontFamily: font.medium },
} as const;

export const layout = {
  gutter: 20, // horizontal screen padding
  gapSm: 8,
  gapMd: 12,
  gapLg: 16,
  sectionGap: 20, // vertical space between sections
  rowHeight: 48, // min row height = min touch target
  rowPaddingV: 11,
  radiusContainer: 14,
  radiusHero: 16,
  radiusPill: 999,
  fabSize: 56,
  listBottomPad: 96, // fabSize + 40; REQUIRED on every scrollable list
  iconRow: 18, // row glyphs (§6)
  iconHeader: 20, // header glyphs (§6)
  touchTarget: 44, // min tappable dimension
  avatar: 34, // person initial circle (the only icon circle allowed)
} as const;

export const motion = {
  pressScale: 0.98,
  fast: 100, // ms — press feedback
  base: 200, // ms — layout transitions
  countUp: 600, // ms — hero number on screen focus
} as const;

/**
 * Single entry point for screens. The app ships dark-only for now
 * (`userInterfaceStyle: "dark"` in app.json); when a light palette lands,
 * this hook is where it swaps in — no screen should import `palette` directly.
 */
export function useTheme() {
  return { palette, type, layout, motion } as const;
}

// --- Category visuals (§6: icon map lives beside the tint map) ---------------

export type CategoryKey = keyof typeof palette.category;

type FeatherIconName = ComponentProps<typeof Feather>['name'];

export const categoryIcons: Record<CategoryKey, FeatherIconName> = {
  bills: 'file-text',
  food: 'coffee',
  transport: 'truck',
  work: 'briefcase',
  entertainment: 'film',
  family: 'users',
  health: 'heart',
  default: 'tag',
  transfer: 'repeat',
  income: 'arrow-down-circle',
};

// Categories are user-editable free-text records, so tint/icon resolve by
// normalized name. Rent and Utilities share the spec's "bills" family; every
// income-type category collapses to the single income family.
const categoryKeyByName: Record<string, CategoryKey> = {
  rent: 'bills',
  utilities: 'bills',
  food: 'food',
  transport: 'transport',
  work: 'work',
  entertainment: 'entertainment',
  family: 'family',
  health: 'health',
};

export function categoryKey(category?: Pick<Category, 'name' | 'type'> | null): CategoryKey {
  if (!category) return 'default';
  if (category.type === 'income') return 'income';
  return categoryKeyByName[category.name.trim().toLowerCase()] ?? 'default';
}

export function categoryVisual(category?: Pick<Category, 'name' | 'type'> | null): {
  tint: string;
  icon: FeatherIconName;
} {
  const key = categoryKey(category);
  return { tint: palette.category[key], icon: categoryIcons[key] };
}
