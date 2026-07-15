import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { layout, palette, type, type FeatherIconName } from '@/theme/theme';

type Family = 'neutral' | 'caution' | 'alert';

const FAMILY: Record<Family, { bg: string; border: string; fg: string }> = {
  neutral: { bg: palette.surface, border: palette.hairline, fg: palette.textSecondary },
  caution: { bg: palette.cautionBg, border: palette.cautionBorder, fg: palette.caution },
  alert: { bg: palette.alertBg, border: palette.alertBorder, fg: palette.alert },
};

interface Props {
  family?: Family;
  icon?: FeatherIconName;
  children: React.ReactNode;
}

/** Inline explanatory or warning copy — plain notes are neutral, never colored (§1: color encodes meaning). */
export function InfoBanner({ family = 'neutral', icon = 'info', children }: Props) {
  const c = FAMILY[family];
  return (
    <View style={[styles.box, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Feather name={icon} size={14} color={c.fg} style={styles.icon} />
      <Text style={[type.caption, styles.text, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: layout.gapMd,
    borderRadius: layout.radiusContainer,
    borderWidth: 1,
    marginBottom: layout.sectionGap,
  },
  icon: {
    marginRight: layout.gapSm,
    marginTop: 1,
  },
  text: {
    flex: 1,
    lineHeight: 18,
  },
});
