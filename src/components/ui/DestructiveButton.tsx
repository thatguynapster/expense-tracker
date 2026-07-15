import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { layout, palette, type } from '@/theme/theme';
import { PressFeedback } from './PressFeedback';

/** Full-width destructive action (delete account/transaction) — the one place a solid alert fill is intentional. */
export function DestructiveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressFeedback baseColor={palette.alertBg} pressedColor={palette.alertBorder} onPress={onPress} style={styles.btn}>
      <Feather name="trash-2" size={15} color={palette.alert} style={styles.icon} />
      <Text style={styles.text}>{label}</Text>
    </PressFeedback>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gapMd,
    borderRadius: layout.radiusContainer,
    borderWidth: 1,
    borderColor: palette.alertBorder,
    marginTop: layout.gapMd,
  },
  icon: {
    marginRight: layout.gapSm,
  },
  text: {
    fontSize: type.bodyBold.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.alert,
  },
});
