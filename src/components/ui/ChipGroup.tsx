import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, palette, type } from '@/theme/theme';

interface ChipOption {
  id: string;
  name: string;
}

interface Props {
  options: ChipOption[];
  value: string | null;
  onSelect: (id: string) => void;
  /** Tapping the already-selected chip clears it (used for optional single-pick fields). */
  allowDeselect?: boolean;
  emptyText?: string;
}

/** Wrapped pill selector — spendable/protected accounts, categories, etc. */
export function ChipGroup({ options, value, onSelect, allowDeselect, emptyText }: Props) {
  if (options.length === 0) {
    return emptyText ? <Text style={[type.caption, styles.empty]}>{emptyText}</Text> : null;
  }
  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onSelect(allowDeselect && selected ? '' : opt.id)}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{opt.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.gapSm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: layout.radiusPill,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  chipSelected: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.link,
  },
  text: {
    fontSize: type.caption.fontSize,
    fontFamily: type.caption.fontFamily,
    color: palette.textSecondary,
  },
  textSelected: {
    fontFamily: type.bodyBold.fontFamily,
    color: palette.link,
  },
  empty: {
    paddingVertical: 4,
  },
});
