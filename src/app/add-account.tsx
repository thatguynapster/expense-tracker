import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function AddAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { id } = useLocalSearchParams<{ id?: string }>();

  const accounts = useStore((s) => s.accounts);
  const addAccount = useStore((s) => s.addAccount);
  const updateAccount = useStore((s) => s.updateAccount);

  const isEditing = !!id;
  const existing = accounts.find((a) => a.id === id);

  const [name, setName] = useState('');
  const [type, setType] = useState<'spendable' | 'protected'>('spendable');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setType(existing.type);
    }
  }, [existing?.id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter an account name.');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && id) {
        await updateAccount(id, name.trim());
      } else {
        await addAccount(name.trim(), type);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          paddingTop: isWeb ? 67 : insets.top + 10,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEditing ? 'Edit Account' : 'Add Account'}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.formContent,
          { paddingBottom: isWeb ? 34 + 24 : insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Account Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Salary Account, Mobile Money"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
          />
        </View>

        {/* Type */}
        {!isEditing && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Account Type</Text>
            <View style={styles.typeOptions}>
              <TouchableOpacity
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: type === 'spendable' ? colors.card : colors.background,
                    borderColor: type === 'spendable' ? colors.primary : colors.border,
                    borderWidth: type === 'spendable' ? 2 : 1,
                  },
                ]}
                onPress={() => setType('spendable')}
              >
                <View style={[styles.typeIcon, { backgroundColor: type === 'spendable' ? colors.muted : colors.muted }]}>
                  <Feather name="briefcase" size={20} color={type === 'spendable' ? colors.primary : colors.mutedForeground} />
                </View>
                <Text style={[styles.typeName, { color: type === 'spendable' ? colors.primary : colors.foreground }]}>
                  Spendable
                </Text>
                <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
                  Salary, cash, mobile money. Counts toward Safe-to-Spend.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: type === 'protected' ? colors.card : colors.background,
                    borderColor: type === 'protected' ? colors.warning : colors.border,
                    borderWidth: type === 'protected' ? 2 : 1,
                  },
                ]}
                onPress={() => setType('protected')}
              >
                <View style={[styles.typeIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="shield" size={20} color={type === 'protected' ? colors.warning : colors.mutedForeground} />
                </View>
                <Text style={[styles.typeName, { color: type === 'protected' ? colors.warning : colors.foreground }]}>
                  Protected
                </Text>
                <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
                  Savings, emergency fund. Excluded from Safe-to-Spend.
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isEditing && (
          <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Account type cannot be changed after creation. Only the name can be edited.
            </Text>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  formContent: { paddingHorizontal: 16, paddingTop: 24 },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
  typeOptions: { gap: 12 },
  typeCard: {
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typeName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  typeDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
