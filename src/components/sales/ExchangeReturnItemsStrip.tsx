import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Minus, Plus, RotateCcw } from 'lucide-react-native';
import { formatCurrency } from '@/utils/format';
import { colors, radius, shadows, typography } from '@/theme';
import type { InventoryItem } from '@/types/sales';

interface ExchangeReturnItemsStripProps {
  /** Remaining-returnable items from the picked original bill (usePosSale's returnDisplayItems). */
  items: InventoryItem[];
  currency: string;
  /** Current return-cart qty for this item/batch. */
  getQty: (itemId: number, itemBatchId?: number | null) => number;
  /** Add one unit as a return line (also used for the first tap on a fresh card). */
  onIncrement: (item: InventoryItem) => void;
  /** Step a return line down by 1 (removes it at 0). */
  onDecrement: (itemId: number, itemBatchId?: number | null) => void;
  /** Set a return line to an exact qty (manual entry), clamped to what's left on the bill. */
  onSetQty: (itemId: number, itemBatchId: number | null | undefined, qty: number) => void;
}

/**
 * Exchange mode only — a horizontal strip of the picked original bill's
 * remaining-returnable items, separate from the main product grid below it.
 * Each card has a stepper (tap +/− to adjust by 1, or type a number directly)
 * so returning many units doesn't mean tapping once per unit.
 */
export const ExchangeReturnItemsStrip: React.FC<ExchangeReturnItemsStripProps> = ({
  items,
  currency,
  getQty,
  onIncrement,
  onDecrement,
  onSetQty,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          Everything on this bill has already been returned.
        </Text>
      </View>
    );
  }

  const commitDraft = (item: InventoryItem, key: string) => {
    const raw = drafts[key];
    if (raw === undefined) {
      return;
    }
    const parsed = parseFloat(raw.trim().replace(/,/g, ''));
    setDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (Number.isNaN(parsed)) {
      return;
    }
    onSetQty(item.id, item.sale_line_batch_id ?? null, parsed);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <RotateCcw size={14} color={colors.error} strokeWidth={2.4} />
        <Text style={styles.headerText}>Tap + or type a qty to return</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {items.map(item => {
          const key = item.return_line_key ?? String(item.id);
          const qty = getQty(item.id, item.sale_line_batch_id ?? null);
          const inCart = qty > 0;
          return (
            <View key={key} style={[styles.card, shadows.sm, inCart && styles.cardSelected]}>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.cardMeta}>
                {item.qty} left · {formatCurrency(item.selling_price, currency)}
              </Text>

              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() =>
                    inCart
                      ? onDecrement(item.id, item.sale_line_batch_id ?? null)
                      : undefined
                  }
                  disabled={!inCart}
                  style={[styles.stepperBtn, !inCart && styles.stepperBtnDisabled]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Minus size={13} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>

                <TextInput
                  value={drafts[key] ?? (qty > 0 ? String(qty) : '0')}
                  onChangeText={text =>
                    setDrafts(prev => ({ ...prev, [key]: text.replace(/[^0-9.]/g, '') }))
                  }
                  onFocus={() => setDrafts(prev => ({ ...prev, [key]: qty > 0 ? String(qty) : '' }))}
                  onBlur={() => commitDraft(item, key)}
                  onSubmitEditing={() => commitDraft(item, key)}
                  keyboardType="decimal-pad"
                  style={styles.stepperInput}
                  selectTextOnFocus
                />

                <TouchableOpacity
                  onPress={() => onIncrement(item)}
                  style={[styles.stepperBtn, styles.stepperBtnPlus]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Plus size={15} color={colors.textOnPrimary} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingLeft: 2,
  },
  headerText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '700',
  },
  scrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  card: {
    width: 152,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    padding: 10,
  },
  cardSelected: {
    borderWidth: 1.5,
    ...shadows.md,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    minHeight: 32,
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnPlus: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
  },
  emptyWrap: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
