import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { font, palette, type } from '@/theme/theme';
import { CURRENCY_SYMBOL, formatAmount } from '@/utils/format';

export type AmountKind = 'expense' | 'income' | 'transfer' | 'neutral';

interface Props {
  amount: number;
  /**
   * §3.2 semantics: expense = −, neutral text, never red; income = +, positive;
   * transfer = unsigned, quiet; neutral = unsigned primary (account balances, totals).
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

const KIND: Record<AmountKind, { sign: string; color: string; fontFamily: string }> = {
  expense: { sign: '−', color: palette.textPrimary, fontFamily: font.medium },
  income: { sign: '+', color: palette.positive, fontFamily: font.medium },
  transfer: { sign: '', color: palette.textSecondary, fontFamily: font.regular },
  neutral: { sign: '', color: palette.textPrimary, fontFamily: font.medium },
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
  // expense/income signs are semantic and fixed; neutral carries the value's
  // own sign (account balances can be overdrawn).
  const sign = kind === 'neutral' && amount < 0 ? '−' : k.sign;
  const digitColor = color ?? k.color;
  const symbolColor = kind === 'income' && !color ? palette.positiveDim : palette.textSecondary;

  return (
    <Text
      style={[
        styles.base,
        { color: digitColor, fontFamily: k.fontFamily, fontSize: type[size].fontSize },
        style,
      ]}
      numberOfLines={1}
    >
      {sign}
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
