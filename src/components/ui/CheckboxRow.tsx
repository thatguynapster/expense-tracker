import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { layout, palette, type } from '@/theme/theme';
import { PressFeedback } from './PressFeedback';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
  /** link for neutral toggles, positive for "counts as debt repayment"-style affirmative actions. */
  accent?: 'link' | 'positive';
}

export function CheckboxRow({ checked, onToggle, label, description, accent = 'link' }: Props) {
  const accentColor = accent === 'positive' ? palette.positive : palette.link;
  return (
    <PressFeedback baseColor={palette.surface} onPress={onToggle} style={styles.row}>
      <View
        style={[
          styles.box,
          { borderColor: checked ? accentColor : palette.textMuted },
          checked && { backgroundColor: accentColor },
        ]}
      >
        {checked && <Feather name="check" size={12} color={palette.canvas} />}
      </View>
      <View style={styles.textCol}>
        <Text style={type.bodyBold}>{label}</Text>
        {description != null && <Text style={[type.caption, styles.desc]}>{description}</Text>}
      </View>
    </PressFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gapMd,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapMd,
    marginBottom: layout.sectionGap,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  desc: {
    marginTop: 2,
  },
});
