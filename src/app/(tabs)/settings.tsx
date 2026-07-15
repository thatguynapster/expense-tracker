import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AmountText, GroupedList, Overline, Row } from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { useStore } from '@/store/useStore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const allCategories = useStore((s) => s.categories);
  const categories = allCategories.filter((c) => !c.deletedAt);
  const disciplineState = useStore((s) => s.disciplineState);
  const updateSafeToSpendWarningThreshold = useStore((s) => s.updateSafeToSpendWarningThreshold);

  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');

  const expenseCount = categories.filter((c) => c.type === 'expense').length;
  const incomeCount = categories.filter((c) => c.type === 'income').length;

  const startEditThreshold = () => {
    setThresholdInput(String(disciplineState.safeToSpendWarningThreshold));
    setEditingThreshold(true);
  };

  const saveThreshold = async () => {
    const value = parseFloat(thresholdInput);
    if (!Number.isFinite(value) || value < 0) {
      setEditingThreshold(false);
      return;
    }
    await updateSafeToSpendWarningThreshold(value);
    await Haptics.selectionAsync();
    setEditingThreshold(false);
  };

  const goTo = async (path: '/budget' | '/categories') => {
    await Haptics.selectionAsync();
    router.push(path);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: (isWeb ? 67 : insets.top) + layout.gapLg,
          paddingBottom: (isWeb ? 118 : insets.bottom) + layout.listBottomPad,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[type.title, styles.title]}>Settings</Text>

      {/* §4.5.1: Rules cluster. */}
      <Overline style={styles.clusterLabel}>Rules</Overline>
      <GroupedList>
        <Row
          icon="percent"
          title="Minimum Savings Rate"
          subtitle="Every income must save at least this percentage"
          right={<Text style={styles.valueText}>10%</Text>}
        />
        <Row
          icon="alert-circle"
          title="Safe-to-Spend Warning"
          right={
            !editingThreshold ? (
              <Pressable onPress={startEditThreshold} style={styles.valueBtn} hitSlop={10}>
                <Text style={[styles.valueText, { color: palette.link }]}>
                  GH₵{disciplineState.safeToSpendWarningThreshold.toFixed(0)}
                </Text>
                <Feather name="edit-2" size={12} color={palette.link} />
              </Pressable>
            ) : undefined
          }
        />
        {editingThreshold && (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="GH₵ per day"
              placeholderTextColor={palette.textMuted}
              value={thresholdInput}
              onChangeText={setThresholdInput}
              autoFocus
              onSubmitEditing={saveThreshold}
              returnKeyType="done"
            />
            <Pressable onPress={saveThreshold} style={styles.iconAction} hitSlop={6}>
              <Feather name="check" size={layout.iconRow} color={palette.link} />
            </Pressable>
            <Pressable onPress={() => setEditingThreshold(false)} style={styles.iconAction} hitSlop={6}>
              <Feather name="x" size={layout.iconRow} color={palette.textMuted} />
            </Pressable>
          </View>
        )}
      </GroupedList>
      {/* §4.5.3: explanatory copy lives below the container, outside the surface. */}
      <Text style={[type.caption, styles.footnote]}>
        This rate is fixed at 10% to enforce financial discipline. It cannot be reduced.
      </Text>
      <Text style={[type.caption, styles.footnote]}>
        Below this GH₵/day figure, Home shows a warning instead of safe.
      </Text>

      <Overline style={styles.clusterLabel}>Discipline tracking</Overline>
      <GroupedList>
        <Row
          title="Total Withdrawn from Savings"
          right={<AmountText amount={disciplineState.totalWithdrawnFromSavings} />}
        />
        <Row
          title="Total Extra Savings"
          right={
            <AmountText amount={disciplineState.totalExtraSavings} color={palette.positive} />
          }
        />
      </GroupedList>

      <Overline style={styles.clusterLabel}>Budget</Overline>
      <GroupedList>
        <Row
          icon="pie-chart"
          title="Budget"
          subtitle="Set planned spending per category, month by month"
          chevron
          onPress={() => goTo('/budget')}
        />
      </GroupedList>

      {/* §4.5.2: the 20-item editor collapses behind one chevron row. */}
      <Overline style={styles.clusterLabel}>Categories</Overline>
      <GroupedList>
        <Row
          icon="tag"
          title="Categories"
          subtitle={`${expenseCount} expense · ${incomeCount} income`}
          chevron
          onPress={() => goTo('/categories')}
        />
      </GroupedList>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: {
    paddingHorizontal: layout.gutter,
  },
  title: {
    marginBottom: layout.sectionGap,
  },
  clusterLabel: {
    marginTop: layout.sectionGap,
    marginBottom: layout.gapSm,
  },
  valueText: {
    fontSize: type.body.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    fontVariant: ['tabular-nums'],
    color: palette.textSecondary,
  },
  valueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: layout.gapSm,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.canvas,
    paddingHorizontal: layout.gapMd,
    fontSize: type.body.fontSize,
    fontFamily: type.body.fontFamily,
    color: palette.textPrimary,
  },
  iconAction: {
    padding: layout.gapSm,
  },
  footnote: {
    marginTop: layout.gapSm,
    paddingHorizontal: 4,
  },
});
