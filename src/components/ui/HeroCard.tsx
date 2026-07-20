import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { layout, motion, palette, type } from '@/theme/theme';
import { CURRENCY_SYMBOL, formatAmount } from '@/utils/format';

/**
 * §3.5: the color family swap IS the warning UI — same layout for safe,
 * warning, and negative states, different semantic family.
 */
export type HeroFamily = 'positive' | 'caution' | 'alert';

const FAMILY: Record<HeroFamily, { bg: string; border: string; main: string; sub: string }> = {
  positive: {
    bg: palette.positiveBg,
    border: palette.positiveBorder,
    main: palette.positive,
    sub: palette.positiveDim,
  },
  caution: {
    bg: palette.cautionBg,
    border: palette.cautionBorder,
    main: palette.caution,
    sub: palette.caution,
  },
  alert: {
    bg: palette.alertBg,
    border: palette.alertBorder,
    main: palette.alert,
    sub: palette.alert,
  },
};

interface Props {
  /** Sentence case, e.g. "Safe to spend today" — no all-caps, no status sentence (§3.5). */
  label: string;
  amount: number;
  family: HeroFamily;
  /** One metadata line, e.g. "17 days left  ·  GH₵2,730.99 usable". */
  meta: string;
  /** Optional second line, e.g. "GH₵91.03 budget  ·  GH₵32.00 spent today". */
  secondaryMeta?: string;
  /** Optional third line, always rendered in caution amber regardless of `family` — a signal distinct from the safe/warning/danger state. */
  warningNote?: string;
}

export function HeroCard({ label, amount, family, meta, secondaryMeta, warningNote }: Props) {
  const c = FAMILY[family];
  const reduceMotion = useReducedMotion();
  const animated = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  // Count up from 0 over motion.countUp on each screen focus; with
  // reduce-motion on, skip straight to the final value (§3.5, §5).
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        setDisplay(amount);
        return;
      }
      // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue: .value assignment is the documented API, not a React state mutation.
      animated.value = 0;
      animated.value = withTiming(amount, {
        duration: motion.countUp,
        easing: Easing.out(Easing.cubic),
      });
    }, [amount, reduceMotion, animated]),
  );

  useAnimatedReaction(
    () => animated.value,
    (value) => {
      runOnJS(setDisplay)(value);
    },
  );

  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.sub }]}>{label}</Text>
      {/* Negative values rely on the alert family swap for meaning, not a minus sign. */}
      <View style={styles.amountRow}>
        <Text style={[styles.symbol, { color: c.sub }]}>{CURRENCY_SYMBOL}</Text>
        <Text style={[styles.digits, { color: c.main }]}>{formatAmount(display)}</Text>
      </View>
      <Text style={[styles.meta, { color: c.sub }]}>{meta}</Text>
      {secondaryMeta != null && secondaryMeta !== '' && (
        <Text style={[styles.meta, styles.secondaryMeta, { color: c.sub }]}>{secondaryMeta}</Text>
      )}
      {warningNote != null && warningNote !== '' && (
        <Text style={[styles.meta, styles.warningNote]}>{warningNote}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: layout.radiusHero,
    borderWidth: 1,
    padding: 18,
  },
  label: {
    fontSize: type.caption.fontSize,
    fontFamily: type.caption.fontFamily,
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  symbol: {
    fontSize: type.heroUnit.fontSize,
    fontFamily: type.heroUnit.fontFamily,
    marginTop: 5, // superscript alignment against the hero digits (§2)
  },
  digits: {
    fontSize: type.hero.fontSize,
    fontFamily: type.hero.fontFamily,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontSize: type.caption.fontSize,
    fontFamily: type.caption.fontFamily,
    fontVariant: ['tabular-nums'],
    marginTop: 8,
  },
  secondaryMeta: {
    marginTop: 2,
    opacity: 0.8,
  },
  warningNote: {
    marginTop: 6,
    color: palette.caution,
  },
});
