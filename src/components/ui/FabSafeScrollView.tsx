import React from 'react';
import { FlatList, ScrollView, type FlatListProps, type ScrollViewProps } from 'react-native';

import { layout } from '@/theme/theme';

/**
 * §2: every scrollable list needs bottom padding ≥ listBottomPad (96 =
 * fabSize + 40) so the FAB never overlaps the last row at max scroll.
 * These wrappers inject it; callers may add more via contentContainerStyle.
 */
export function FabSafeScrollView({ contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      {...props}
      contentContainerStyle={[{ paddingBottom: layout.listBottomPad }, contentContainerStyle]}
    />
  );
}

export function FabSafeFlatList<T>({ contentContainerStyle, ...props }: FlatListProps<T>) {
  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      {...props}
      contentContainerStyle={[{ paddingBottom: layout.listBottomPad }, contentContainerStyle]}
    />
  );
}
