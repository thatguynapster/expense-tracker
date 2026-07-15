import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { layout, palette, type } from '@/theme/theme';
import { Overline } from './SectionHeader';

/** Overline label + content, with an optional inline right-aligned action (an edit icon, etc). */
export function Field({
  label,
  right,
  children,
  style,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.group, style]}>
      <View style={styles.labelRow}>
        <Overline>{label}</Overline>
        {right}
      </View>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={palette.textMuted}
      {...props}
      style={[styles.input, props.multiline && styles.textArea, props.style]}
    />
  );
}

interface AmountFieldProps {
  value: string;
  onChangeText: (val: string) => void;
  autoFocus?: boolean;
}

/** GH₵-prefixed large-digit amount entry, shared by every money-entering form. */
export function AmountField({ value, onChangeText, autoFocus }: AmountFieldProps) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.currencyPrefix}>GH₵</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="0.00"
        placeholderTextColor={palette.textMuted}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[^0-9.]/g, ''))}
        autoFocus={autoFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: layout.sectionGap,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.gapSm,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.surface,
    borderRadius: layout.radiusContainer,
    paddingHorizontal: layout.gapMd,
    height: 50,
    fontSize: type.body.fontSize,
    fontFamily: type.body.fontFamily,
    color: palette.textPrimary,
  },
  textArea: {
    height: undefined,
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.surface,
    borderRadius: layout.radiusContainer,
    paddingHorizontal: layout.gapMd,
    height: 56,
  },
  currencyPrefix: {
    fontSize: type.heroUnit.fontSize,
    fontFamily: type.body.fontFamily,
    color: palette.textSecondary,
    marginRight: layout.gapSm,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: type.inputAmount.fontSize,
    fontFamily: type.inputAmount.fontFamily,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
