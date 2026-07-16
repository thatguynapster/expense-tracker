import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { layout, motion, palette, type, type FeatherIconName } from '@/theme/theme';
import { PressFeedback } from './PressFeedback';

interface GroupedListProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Fades rows in/out on add/remove (§5: transaction added/deleted). Off by
   * default — most groups (settings clusters, category lists) don't gain
   * anything from an entrance fade on every mount; opt in for lists whose
   * membership actually changes while visible.
   */
  animateItems?: boolean;
}

/**
 * Restyle spec §3.1: one container per group, not one card per row.
 * Children render inside a single `surface` with hairline dividers between
 * them (none after the last). Children can be `<Row>`s or any custom row.
 * Row position always smooths via layout transition (§5, reduce-motion aware).
 */
export function GroupedList({ children, style, animateItems }: GroupedListProps) {
  const reduceMotion = useReducedMotion();
  const items = React.Children.toArray(children);
  return (
    <View style={[styles.container, style]}>
      {items.map((child, i) => {
        const key = React.isValidElement(child) && child.key != null ? child.key : i;
        return (
          <Animated.View
            key={key}
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.base)}
            entering={animateItems && !reduceMotion ? FadeIn.duration(motion.base) : undefined}
            exiting={animateItems && !reduceMotion ? FadeOut.duration(motion.base) : undefined}
            style={i < items.length - 1 ? styles.dividerBelow : undefined}
          >
            {child}
          </Animated.View>
        );
      })}
    </View>
  );
}

interface RowProps {
  /** Bare Feather glyph at 18px, tinted by category — no circular background (§3.1). */
  icon?: FeatherIconName;
  iconTint?: string;
  title: string;
  subtitle?: string;
  /** Right slot: typically an <AmountText>, a <Badge>, or nothing. */
  right?: React.ReactNode;
  chevron?: boolean;
  /** De-emphasized treatment for internal transfers (§3.2). */
  dimmed?: boolean;
  onPress?: () => void;
}

export function Row({ icon, iconTint, title, subtitle, right, chevron, dimmed, onPress }: RowProps) {
  const content = (
    <>
      {icon && (
        <Feather name={icon} size={layout.iconRow} color={iconTint ?? palette.textSecondary} />
      )}
      <View style={styles.rowBody}>
        <Text
          style={[type.rowTitle, dimmed && { color: palette.textDimmed, fontFamily: type.body.fontFamily }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle != null && subtitle !== '' && (
          <Text style={[type.caption, styles.subtitle]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {chevron && <Feather name="chevron-right" size={layout.iconRow} color={palette.textMuted} />}
    </>
  );

  if (onPress) {
    return (
      <PressFeedback onPress={onPress} style={styles.row}>
        {content}
      </PressFeedback>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    paddingHorizontal: 14,
  },
  dividerBelow: {
    borderBottomWidth: 1,
    borderBottomColor: palette.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gapMd,
    minHeight: layout.rowHeight,
    paddingVertical: layout.rowPaddingV,
  },
  rowBody: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
});
