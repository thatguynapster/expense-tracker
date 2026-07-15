import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, palette, type FeatherIconName } from '@/theme/theme';
import { PressFeedback } from './PressFeedback';

/**
 * The tab bar is absolutely positioned (translucent on iOS), so the FAB floats
 * above it. Screens use this same offset to compute scroll bottom padding:
 * `useFabBottomOffset() + layout.listBottomPad` guarantees the FAB never
 * overlaps the last row at max scroll (§8).
 */
export function useFabBottomOffset(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return 92;
  return insets.bottom + 88;
}

interface Props {
  onPress: () => void;
  icon?: FeatherIconName;
}

export function Fab({ onPress, icon = 'plus' }: Props) {
  const bottom = useFabBottomOffset();
  return (
    <PressFeedback
      baseColor={palette.link}
      pressedColor={palette.link}
      onPress={onPress}
      style={[styles.fab, { bottom }]}
      accessibilityRole="button"
    >
      <Feather name={icon} size={24} color={palette.canvas} />
    </PressFeedback>
  );
}

// §9: no shadows outside modals — the FAB floats by contrast alone.
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: layout.gutter,
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
