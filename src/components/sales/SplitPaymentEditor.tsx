import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { HStack, Text } from '@gluestack-ui/themed';
import { X } from 'lucide-react-native';
import { formatCurrency } from '@/utils/format';
import { colors, appInputStyle, appInputPlaceholderColor, typography } from '@/theme';

export interface SplitPaymentRow {
  /** Local-only key for list rendering/editing — never sent to the backend. */
  key: string;
  paymentMethod: string;
  amount: string;
  chequeNumber: string;
  bankName: string;
}

interface SplitPaymentEditorProps {
  methods: string[];
  rows: SplitPaymentRow[];
  onChange: (rows: SplitPaymentRow[]) => void;
  total: number;
  currency?: string;
}

const isCredit = (method: string): boolean => /^credit$/i.test(method);
const isChequeLike = (method: string): boolean => /cheque|bank transfer/i.test(method);

const makeKey = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** One row per payment method used on a single sale — e.g. part cash, part
 * cheque, part credit. Used instead of PaymentMethodDetails when the
 * cashier splits a sale's payment across more than one method. */
export const SplitPaymentEditor: React.FC<SplitPaymentEditorProps> = ({
  methods,
  rows,
  onChange,
  total,
  currency,
}) => {
  const splitTotal = rows.reduce((sum, r) => sum + (parseFloat(r.amount.replace(/,/g, '')) || 0), 0);
  const remaining = Math.round((total - splitTotal) * 100) / 100;

  const updateRow = (key: string, patch: Partial<SplitPaymentRow>) => {
    onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    onChange(rows.filter(r => r.key !== key));
  };

  const addRow = () => {
    // Default to whichever method isn't already used, and prefill the
    // remaining amount so a two-way split needs no typing on the second row.
    const unused = methods.find(m => !rows.some(r => r.paymentMethod === m)) ?? methods[0] ?? 'Cash';
    onChange([
      ...rows,
      {
        key: makeKey(),
        paymentMethod: unused,
        amount: remaining > 0 ? String(remaining) : '',
        chequeNumber: '',
        bankName: '',
      },
    ]);
  };

  return (
    <View>
      {rows.map((row, idx) => (
        <View key={row.key} style={styles.row}>
          <HStack justifyContent="space-between" alignItems="center" mb="$1.5">
            <Text style={typography.label} color={colors.textSecondary}>
              Method {idx + 1}
            </Text>
            {rows.length > 1 ? (
              <TouchableOpacity
                onPress={() => removeRow(row.key)}
                accessibilityRole="button"
                accessibilityLabel="Remove this payment method"
                hitSlop={8}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </HStack>

          <HStack gap="$2" flexWrap="wrap" mb="$2">
            {methods.map(m => {
              const active = row.paymentMethod === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => updateRow(row.key, { paymentMethod: m })}
                  accessibilityRole="button">
                  <Text
                    size="xs"
                    fontWeight="$bold"
                    color={active ? colors.textOnPrimary : colors.textSecondary}>
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </HStack>

          <TextInput
            value={row.amount}
            onChangeText={t => updateRow(row.key, { amount: t })}
            keyboardType="decimal-pad"
            style={appInputStyle}
            placeholder="0.00"
            placeholderTextColor={appInputPlaceholderColor}
          />

          {isChequeLike(row.paymentMethod) ? (
            <>
              <TextInput
                value={row.bankName}
                onChangeText={t => updateRow(row.key, { bankName: t })}
                style={[appInputStyle, styles.subField]}
                placeholder="Bank name"
                placeholderTextColor={appInputPlaceholderColor}
              />
              <TextInput
                value={row.chequeNumber}
                onChangeText={t => updateRow(row.key, { chequeNumber: t })}
                style={[appInputStyle, styles.subField]}
                placeholder="Cheque number (optional)"
                placeholderTextColor={appInputPlaceholderColor}
              />
            </>
          ) : null}

          {isCredit(row.paymentMethod) ? (
            <Text size="2xs" color={colors.textMuted} mt="$1">
              This portion is charged to the customer&apos;s account.
            </Text>
          ) : null}
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addRow} accessibilityRole="button">
        <Text size="sm" fontWeight="$semibold" color={colors.primary}>
          + Add payment method
        </Text>
      </TouchableOpacity>

      <HStack justifyContent="space-between" mt="$2">
        <Text size="sm" color={colors.textSecondary}>
          Split total
        </Text>
        <Text
          size="sm"
          fontWeight="$bold"
          color={Math.abs(remaining) < 0.01 ? colors.success : colors.error}>
          {formatCurrency(splitTotal, currency)}
          {Math.abs(remaining) >= 0.01
            ? `  (${remaining > 0 ? 'short' : 'over'} ${formatCurrency(Math.abs(remaining), currency)})`
            : ''}
        </Text>
      </HStack>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderWidth: 0,
    backgroundColor: colors.primary,
  },
  subField: {
    marginTop: 8,
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
});
