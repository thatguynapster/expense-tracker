import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { layout, palette, type, type FeatherIconName } from '@/theme/theme';

/**
 * §3.3: badges mark exceptions, not defaults — only Protected (caution) and
 * Overdue (alert) exist. There is deliberately no positive/neutral family:
 * the majority state is never badged.
 */
type BadgeFamily = 'caution' | 'alert';

const FAMILY: Record<BadgeFamily, { bg: string; border: string; fg: string }> = {
  caution: { bg: palette.cautionBg, border: palette.cautionBorder, fg: palette.caution },
  alert: { bg: palette.alertBg, border: palette.alertBorder, fg: palette.alert },
};

interface Props {
  label: string;
  family: BadgeFamily;
  /** Optional 10px leading glyph (shield, alert-circle). */
  icon?: FeatherIconName;
}

export function Badge({ label, family, icon }: Props) {
  const c = FAMILY[family];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
      {icon && <Feather name={icon} size={10} color={c.fg} />}
      <Text style={[type.badge, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: layout.radiusPill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
