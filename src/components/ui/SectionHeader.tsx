import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { layout, palette, type } from '@/theme/theme';

interface Props {
  label: string;
  /** Optional right-aligned text action, e.g. "See all" (§3.4). */
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ label, actionLabel, onAction }: Props) {
  return (
    <View style={styles.header}>
      <Text style={type.section}>{label}</Text>
      {actionLabel != null && (
        <Pressable onPress={onAction} hitSlop={14}>
          <Text style={[type.section, styles.action]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Date group headers inside lists (§3.4): overline style, short format
 * ("JUL 9", never the year — that lives in the month selector). Uppercasing
 * happens here so callers pass natural-case dates.
 */
export function Overline({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[type.overline, styles.overline, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.iconHeader + layout.gapSm,
  },
  action: {
    color: palette.link,
  },
  overline: {
    textTransform: 'uppercase',
  },
});
