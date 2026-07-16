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

import { GroupedList, Overline, PressFeedback } from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { useStore } from '@/store/useStore';
import { sortCategoriesAlphabetically } from '@/utils/sorting';
import type { Category, CategoryType } from '@/lib/types';

/**
 * §4.5.2: the category editor from Settings, unchanged in behavior, on its own
 * screen. Settings links here via a single chevron row.
 */
export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const allCategories = useStore((s) => s.categories);
  // Soft-deleted categories stay in local storage until a sync confirms the
  // server has deleted its copy too — filter them out of what's displayed.
  const categories = allCategories.filter((c) => !c.deletedAt);
  const transactions = useStore((s) => s.transactions);
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<CategoryType>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);

  const expenseCategories = sortCategoriesAlphabetically(categories.filter((c) => c.type === 'expense'));
  const incomeCategories = sortCategoriesAlphabetically(categories.filter((c) => c.type === 'income'));

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addCategory(newCatName.trim(), newCatType);
    setNewCatName('');
  };

  const handleEditCategory = (id: string, name: string) => {
    setConfirmDeleteId(null);
    setBlockedId(null);
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateCategory(editingId, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  const handleDeleteTap = (id: string) => {
    const isUsed = transactions.some((tx) => tx.categoryId === id);
    if (isUsed) {
      setBlockedId((prev) => (prev === id ? null : id));
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId((prev) => (prev === id ? null : id));
      setBlockedId(null);
    }
    setEditingId(null);
  };

  const handleConfirmDelete = async (id: string) => {
    // §5: delete confirm gets a Medium impact haptic at the tap itself.
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteCategory(id);
    setConfirmDeleteId(null);
  };

  const CategoryRow = ({ cat }: { cat: Category }) => (
    <View>
      {editingId === cat.id ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={editingName}
            onChangeText={setEditingName}
            autoFocus
            onSubmitEditing={handleSaveEdit}
            returnKeyType="done"
          />
          <Pressable onPress={handleSaveEdit} style={styles.iconAction} hitSlop={6}>
            <Feather name="check" size={layout.iconRow} color={palette.link} />
          </Pressable>
          <Pressable onPress={() => setEditingId(null)} style={styles.iconAction} hitSlop={6}>
            <Feather name="x" size={layout.iconRow} color={palette.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.catRow}>
          <Text style={[type.body, styles.catName]} numberOfLines={1}>
            {cat.name}
          </Text>
          <Pressable
            onPress={() => handleEditCategory(cat.id, cat.name)}
            style={styles.iconAction}
            hitSlop={6}
          >
            <Feather name="edit-2" size={16} color={palette.textSecondary} />
          </Pressable>
          <Pressable onPress={() => handleDeleteTap(cat.id)} style={styles.iconAction} hitSlop={6}>
            <Feather name="trash-2" size={16} color={palette.alert} />
          </Pressable>
        </View>
      )}

      {blockedId === cat.id && (
        <View style={styles.blockedBanner}>
          <Feather name="info" size={13} color={palette.caution} style={styles.bannerIcon} />
          <Text style={[type.caption, styles.blockedText]}>
            <Text style={{ fontFamily: type.bodyBold.fontFamily }}>{cat.name}</Text>
            {' '}is used in existing transactions and cannot be deleted.
          </Text>
          <Pressable onPress={() => setBlockedId(null)} hitSlop={8}>
            <Feather name="x" size={13} color={palette.caution} />
          </Pressable>
        </View>
      )}

      {confirmDeleteId === cat.id && (
        <View style={styles.confirmPanel}>
          <Text style={[type.caption, styles.confirmText]}>
            Delete <Text style={{ fontFamily: type.bodyBold.fontFamily }}>{cat.name}</Text>? This
            action is permanent and cannot be undone.
          </Text>
          <View style={styles.confirmActions}>
            <PressFeedback
              baseColor={palette.surfaceRaised}
              onPress={() => setConfirmDeleteId(null)}
              style={styles.confirmBtn}
            >
              <Text style={[type.section, { color: palette.textPrimary }]}>Cancel</Text>
            </PressFeedback>
            <PressFeedback
              baseColor={palette.alert}
              pressedColor={palette.alert}
              onPress={() => handleConfirmDelete(cat.id)}
              style={styles.confirmBtn}
            >
              <Text style={[type.section, { color: palette.canvas }]}>Delete</Text>
            </PressFeedback>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: isWeb ? 67 : insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={palette.textPrimary} />
        </Pressable>
        <Text style={type.title}>Categories</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.listBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.typeToggle}>
          {(['expense', 'income'] as CategoryType[]).map((t) => {
            const selected = newCatType === t;
            return (
              <Pressable
                key={t}
                style={[styles.typeToggleBtn, selected && styles.typeToggleBtnSelected]}
                onPress={() => setNewCatType(t)}
              >
                <Text style={[styles.typeToggleText, selected && styles.typeToggleTextSelected]}>
                  {t === 'expense' ? 'Expense' : 'Income'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.addCatRow}>
          <TextInput
            style={styles.input}
            placeholder={`New ${newCatType} category name`}
            placeholderTextColor={palette.textMuted}
            value={newCatName}
            onChangeText={setNewCatName}
            onSubmitEditing={handleAddCategory}
            returnKeyType="done"
          />
          <PressFeedback
            baseColor={palette.link}
            pressedColor={palette.link}
            onPress={handleAddCategory}
            style={styles.addCatBtn}
          >
            <Feather name="plus" size={layout.iconRow} color={palette.canvas} />
          </PressFeedback>
        </View>

        <Overline style={styles.groupLabel}>Expense</Overline>
        {expenseCategories.length > 0 ? (
          <GroupedList>
            {expenseCategories.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </GroupedList>
        ) : (
          <Text style={[type.caption, styles.emptyGroupText]}>No expense categories yet.</Text>
        )}

        <Overline style={[styles.groupLabel, styles.incomeLabel]}>Income</Overline>
        {incomeCategories.length > 0 ? (
          <GroupedList>
            {incomeCategories.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </GroupedList>
        ) : (
          <Text style={[type.caption, styles.emptyGroupText]}>No income categories yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gapMd,
    paddingBottom: layout.gapMd,
    gap: layout.gapSm,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: layout.gapLg,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: layout.gapSm,
    marginBottom: layout.gapMd,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: layout.gapSm,
    borderRadius: layout.radiusPill,
    borderWidth: 1,
    borderColor: palette.hairline,
    alignItems: 'center',
  },
  typeToggleBtnSelected: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.link,
  },
  typeToggleText: {
    fontSize: type.section.fontSize,
    fontFamily: type.caption.fontFamily,
    color: palette.textSecondary,
  },
  typeToggleTextSelected: {
    fontFamily: type.bodyBold.fontFamily,
    color: palette.link,
  },
  addCatRow: {
    flexDirection: 'row',
    gap: layout.gapSm,
    marginBottom: layout.sectionGap,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.surface,
    paddingHorizontal: layout.gapMd,
    fontSize: type.body.fontSize,
    fontFamily: type.body.fontFamily,
    color: palette.textPrimary,
  },
  addCatBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    marginBottom: layout.gapSm,
  },
  incomeLabel: {
    marginTop: layout.sectionGap,
  },
  emptyGroupText: {
    paddingVertical: 4,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.rowHeight,
    paddingVertical: layout.rowPaddingV,
  },
  catName: {
    flex: 1,
  },
  iconAction: {
    padding: layout.gapSm,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: layout.gapSm,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.cautionBg,
    borderColor: palette.cautionBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: layout.gapSm,
  },
  bannerIcon: {
    marginRight: 6,
    marginTop: 1,
  },
  blockedText: {
    flex: 1,
    color: palette.caution,
  },
  confirmPanel: {
    backgroundColor: palette.alertBg,
    borderColor: palette.alertBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: layout.gapMd,
    marginBottom: layout.gapSm,
  },
  confirmText: {
    color: palette.alert,
    marginBottom: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: layout.gapSm,
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    paddingHorizontal: layout.gapLg,
    paddingVertical: 7,
    borderRadius: layout.radiusPill,
  },
});
