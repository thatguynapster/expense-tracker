import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { font, palette, type } from '@/theme/theme';
import { CURRENCY_SYMBOL, formatAmount } from '@/utils/format';

export type AmountKind = 'expense' | 'income' | 'transfer' | 'neutral';

interface Props {
  amount: number;
  /**
   * expense = red; income = green; transfer = unsigned, quiet, neutral color;
   * neutral = primary (account balances, totals), turning red if the value
   * itself goes negative. No kind renders a +/− sign — color alone carries
   * direction, and the currency symbol always matches the digit color family.
   */
  kind?: AmountKind;
  /** Global decision: rows keep GH₵ at caption size, de-emphasized. */
  showCurrency?: boolean;
  /** Token-based size bump for metric tiles (§4.3); 'body' everywhere else. */
  size?: 'body' | 'title';
  /** Overrides digit color for tokenized exceptions (e.g. caution tile, textMuted zero rows). */
  color?: string;
  style?: StyleProp<TextStyle>;
}

const KIND: Record<AmountKind, { color: string; symbolColor: string; fontFamily: string }> = {
  expense: { color: palette.alert, symbolColor: palette.alert, fontFamily: font.medium },
  income: { color: palette.positive, symbolColor: palette.positiveDim, fontFamily: font.medium },
  transfer: { color: palette.textSecondary, symbolColor: palette.textSecondary, fontFamily: font.regular },
  neutral: { color: palette.textPrimary, symbolColor: palette.textSecondary, fontFamily: font.medium },
};

export function AmountText({
  amount,
  kind = 'neutral',
  showCurrency = true,
  size = 'body',
  color,
  style,
}: Props) {
  const k = KIND[kind];
  // Neutral amounts (account balances, totals) turn red if they go negative —
  // that should never happen, so it doubles as a correctness flag. An explicit
  // `color` override always wins for both the digits and the symbol, so the
  // two never drift out of sync.
  const isNegativeNeutral = kind === 'neutral' && amount < 0;
  const digitColor = color ?? (isNegativeNeutral ? palette.alert : k.color);
  const symbolColor = color ?? (isNegativeNeutral ? palette.alert : k.symbolColor);

  return (
    <Text
      style={[
        styles.base,
        { color: digitColor, fontFamily: k.fontFamily, fontSize: type[size].fontSize },
        style,
      ]}
      numberOfLines={1}
    >
      {showCurrency && (
        <Text style={[styles.symbol, { color: symbolColor }]}>{CURRENCY_SYMBOL}</Text>
      )}
      {formatAmount(amount)}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  symbol: {
    fontSize: type.caption.fontSize,
    fontFamily: font.regular,
  },
});
