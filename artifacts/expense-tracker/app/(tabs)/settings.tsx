import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const disciplineState = useStore((s) => s.disciplineState);

  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addCategory(newCatName.trim());
    setNewCatName('');
  };

  const handleEditCategory = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateCategory(editingId, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteCategory(id);
          },
        },
      ]
    );
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

      {/* Categories */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Categories</Text>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.addCatRow}>
          <TextInput
            style={[
              styles.catInput,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder="New category name"
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

        {categories.map((cat, i) => (
          <View key={cat.id}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {editingId === cat.id ? (
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
              <View style={styles.catRow}>
                <Text style={[styles.catName, { color: colors.foreground }]}>{cat.name}</Text>
                <TouchableOpacity
                  onPress={() => handleEditCategory(cat.id, cat.name)}
                  style={styles.catAction}
                >
                  <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory(cat.id, cat.name)}
                  style={styles.catAction}
                >
                  <Feather name="trash-2" size={15} color={colors.danger} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
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
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  settingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
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
  addCatRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  catInput: {
    flex: 1,
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
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  catName: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  catAction: { padding: 6 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  editInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  editAction: { padding: 6 },
});
