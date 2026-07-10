import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import type { Category, CategoryType } from '@/lib/types';
import { sortCategoriesAlphabetically } from '@/utils/sorting';

export default function SettingsScreen() {
  const colors = useColors();
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
  const disciplineState = useStore((s) => s.disciplineState);
  const updateSafeToSpendWarningThreshold = useStore((s) => s.updateSafeToSpendWarningThreshold);

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<CategoryType>('expense');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');

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
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteCategory(id);
    setConfirmDeleteId(null);
  };

  const topPad = isWeb ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: isWeb ? 84 + 34 : insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

      {/* Savings Rate */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionRow}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.muted }]}>
            <Feather name="percent" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Minimum Savings Rate</Text>
            <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
              Every income must save at least this percentage
            </Text>
          </View>
          <View style={[styles.rateBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.rateText, { color: colors.primary }]}>10%</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.rateNote, { color: colors.mutedForeground }]}>
          This rate is fixed at 10% to enforce financial discipline. It cannot be reduced.
        </Text>
      </View>

      {/* Safe-to-Spend Warning Threshold */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionRow}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.muted }]}>
            <Feather name="alert-circle" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Safe-to-Spend Warning</Text>
            <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
              Below this GH₵/day figure, Home shows a warning instead of safe
            </Text>
          </View>
          {!editingThreshold && (
            <TouchableOpacity
              style={[styles.rateBadge, { backgroundColor: colors.muted, flexDirection: 'row', alignItems: 'center' }]}
              onPress={startEditThreshold}
            >
              <Text style={[styles.rateText, { color: colors.primary }]}>
                GH₵{disciplineState.safeToSpendWarningThreshold.toFixed(0)}
              </Text>
              <Feather name="edit-2" size={12} color={colors.primary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </View>
        {editingThreshold && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.background, borderColor: colors.primary, color: colors.foreground }]}
                keyboardType="decimal-pad"
                placeholder="GH₵ per day"
                placeholderTextColor={colors.mutedForeground}
                value={thresholdInput}
                onChangeText={setThresholdInput}
                autoFocus
                onSubmitEditing={saveThreshold}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={saveThreshold} style={styles.editAction}>
                <Feather name="check" size={18} color={colors.success} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingThreshold(false)} style={styles.editAction}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Discipline State Info */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Discipline Tracking</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.disciplineRow}>
          <Text style={[styles.disciplineLabel, { color: colors.mutedForeground }]}>
            Total Withdrawn from Savings
          </Text>
          <Text style={[styles.disciplineValue, { color: colors.danger }]}>
            GH₵{disciplineState.totalWithdrawnFromSavings.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.disciplineRow}>
          <Text style={[styles.disciplineLabel, { color: colors.mutedForeground }]}>
            Total Extra Savings
          </Text>
          <Text style={[styles.disciplineValue, { color: colors.success }]}>
            GH₵{disciplineState.totalExtraSavings.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Budget */}
      <TouchableOpacity
        style={[styles.section, styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={async () => {
          await Haptics.selectionAsync();
          router.push('/budget');
        }}
        activeOpacity={0.8}
      >
        <View style={[styles.sectionIcon, { backgroundColor: colors.muted }]}>
          <Feather name="pie-chart" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: colors.foreground }]}>Budget</Text>
          <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>
            Set planned spending per category, month by month
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Categories */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Categories</Text>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.typeToggle}>
          {(['expense', 'income'] as CategoryType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeToggleBtn,
                { backgroundColor: newCatType === t ? colors.primary : colors.background, borderColor: colors.border },
              ]}
              onPress={() => setNewCatType(t)}
            >
              <Text style={[
                styles.typeToggleText,
                { color: newCatType === t ? colors.primaryForeground : colors.foreground },
              ]}>
                {t === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.addCatRow}>
          <TextInput
            style={[
              styles.catInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={`New ${newCatType} category name`}
            placeholderTextColor={colors.mutedForeground}
            value={newCatName}
            onChangeText={setNewCatName}
            onSubmitEditing={handleAddCategory}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addCatBtn, { backgroundColor: colors.primary }]}
            onPress={handleAddCategory}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.catGroupLabel, { color: colors.mutedForeground }]}>EXPENSE</Text>
        {expenseCategories.map((cat, i) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            isFirst={i === 0}
            editingId={editingId}
            editingName={editingName}
            confirmDeleteId={confirmDeleteId}
            blockedId={blockedId}
            colors={colors}
            setEditingName={setEditingName}
            handleSaveEdit={handleSaveEdit}
            setEditingId={setEditingId}
            handleEditCategory={handleEditCategory}
            handleDeleteTap={handleDeleteTap}
            setBlockedId={setBlockedId}
            setConfirmDeleteId={setConfirmDeleteId}
            handleConfirmDelete={handleConfirmDelete}
          />
        ))}
        {expenseCategories.length === 0 && (
          <Text style={[styles.emptyGroupText, { color: colors.mutedForeground }]}>No expense categories yet.</Text>
        )}

        <Text style={[styles.catGroupLabel, { color: colors.mutedForeground, marginTop: 16 }]}>INCOME</Text>
        {incomeCategories.map((cat, i) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            isFirst={i === 0}
            editingId={editingId}
            editingName={editingName}
            confirmDeleteId={confirmDeleteId}
            blockedId={blockedId}
            colors={colors}
            setEditingName={setEditingName}
            handleSaveEdit={handleSaveEdit}
            setEditingId={setEditingId}
            handleEditCategory={handleEditCategory}
            handleDeleteTap={handleDeleteTap}
            setBlockedId={setBlockedId}
            setConfirmDeleteId={setConfirmDeleteId}
            handleConfirmDelete={handleConfirmDelete}
          />
        ))}
        {incomeCategories.length === 0 && (
          <Text style={[styles.emptyGroupText, { color: colors.mutedForeground }]}>No income categories yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

type ColorTokens = ReturnType<typeof useColors>;

function CategoryRow({
  cat,
  isFirst,
  editingId,
  editingName,
  confirmDeleteId,
  blockedId,
  colors,
  setEditingName,
  handleSaveEdit,
  setEditingId,
  handleEditCategory,
  handleDeleteTap,
  setBlockedId,
  setConfirmDeleteId,
  handleConfirmDelete,
}: {
  cat: Category;
  isFirst: boolean;
  editingId: string | null;
  editingName: string;
  confirmDeleteId: string | null;
  blockedId: string | null;
  colors: ColorTokens;
  setEditingName: (name: string) => void;
  handleSaveEdit: () => void;
  setEditingId: (id: string | null) => void;
  handleEditCategory: (id: string, name: string) => void;
  handleDeleteTap: (id: string) => void;
  setBlockedId: (id: string | null) => void;
  setConfirmDeleteId: (id: string | null) => void;
  handleConfirmDelete: (id: string) => void;
}) {
  return (
    <View>
      {!isFirst && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

      {editingId === cat.id ? (
        /* ── Edit mode ── */
        <View style={styles.editRow}>
          <TextInput
            style={[
              styles.editInput,
              { backgroundColor: colors.background, borderColor: colors.primary, color: colors.foreground },
            ]}
            value={editingName}
            onChangeText={setEditingName}
            autoFocus
            onSubmitEditing={handleSaveEdit}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={handleSaveEdit} style={styles.editAction}>
            <Feather name="check" size={18} color={colors.success} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditingId(null)} style={styles.editAction}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Normal row ── */
        <View style={styles.catRow}>
          <Text style={[styles.catName, { color: colors.foreground }]}>{cat.name}</Text>
          <TouchableOpacity
            onPress={() => handleEditCategory(cat.id, cat.name)}
            style={styles.catAction}
          >
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteTap(cat.id)}
            style={styles.catAction}
          >
            <Feather
              name="trash-2"
              size={15}
              color={confirmDeleteId === cat.id ? colors.danger : colors.danger + '99'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Blocked banner (used in transactions) ── */}
      {blockedId === cat.id && (
        <View style={[styles.inlineBanner, { backgroundColor: colors.warningBg, borderColor: colors.warning + '50' }]}>
          <Feather name="info" size={13} color={colors.warning} style={{ marginRight: 6, marginTop: 1 }} />
          <Text style={[styles.inlineBannerText, { color: colors.warning }]}>
            <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{cat.name}</Text>
            {' '}is used in existing transactions and cannot be deleted.
          </Text>
          <TouchableOpacity onPress={() => setBlockedId(null)} style={{ padding: 4 }}>
            <Feather name="x" size={13} color={colors.warning} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Confirm-delete inline panel ── */}
      {confirmDeleteId === cat.id && (
        <View style={[styles.confirmPanel, { backgroundColor: colors.dangerBg, borderColor: colors.danger + '40' }]}>
          <Text style={[styles.confirmText, { color: colors.danger }]}>
            Delete <Text style={{ fontFamily: 'Inter_700Bold' }}>{cat.name}</Text>? This action is permanent and cannot be undone.
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.muted }]}
              onPress={() => setConfirmDeleteId(null)}
            >
              <Text style={[styles.confirmBtnText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.danger }]}
              onPress={() => handleConfirmDelete(cat.id)}
            >
              <Text style={[styles.confirmBtnText, { color: '#fff' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginBottom: 10, marginTop: 4 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  settingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rateBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  rateText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  divider: { height: 1, marginVertical: 12 },
  rateNote: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  disciplineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  disciplineLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  disciplineValue: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeToggleText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  catGroupLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyGroupText: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 4 },
  addCatRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  catInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  addCatBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  catName: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  catAction: { padding: 8 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  editInput: {
    flex: 1,
    minWidth: 0,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  editAction: { padding: 6 },
  inlineBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 4,
  },
  inlineBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  confirmPanel: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 4,
  },
  confirmText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
