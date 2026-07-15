import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { layout, palette, type } from '@/theme/theme';

interface Props {
  title: string;
  paddingTop: number;
  /** Pushed screens (transaction-detail, loan-detail, budget, categories). */
  onBack?: () => void;
  /** True modals (add-transaction, add-account, add-loan, record-loan-repayment). */
  onClose?: () => void;
  right?: React.ReactNode;
}

/**
 * Shared header for every non-tab screen: back/close on the left, title
 * (type.header, one line), optional right slot (SaveButton or an icon).
 */
export function ScreenHeader({ title, paddingTop, onBack, onClose, right }: Props) {
  return (
    <View style={[styles.header, { paddingTop }]}>
      {(onBack || onClose) && (
        <Pressable onPress={onBack ?? onClose} style={styles.iconBtn} hitSlop={6}>
          <Feather
            name={onBack ? 'chevron-left' : 'x'}
            size={onBack ? 24 : 22}
            color={palette.textPrimary}
          />
        </Pressable>
      )}
      <Text style={[type.header, styles.title]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn} hitSlop={6}>
      <Feather name={icon} size={18} color={palette.link} />
    </Pressable>
  );
}

export function SaveButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.saveBtn, disabled && styles.saveBtnDisabled]}
    >
      <Text style={[styles.saveBtnText, disabled && styles.saveBtnTextDisabled]}>Save</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gapMd,
    paddingBottom: layout.gapMd,
    gap: layout.gapSm,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  iconBtn: {
    width: layout.touchTarget - 12,
    height: layout.touchTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: palette.link,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: layout.radiusPill,
  },
  saveBtnDisabled: {
    backgroundColor: palette.surfaceRaised,
  },
  saveBtnText: {
    fontSize: type.bodyBold.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.canvas,
  },
  saveBtnTextDisabled: {
    color: palette.textMuted,
  },
});
