import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, Receipt, X, Package } from 'lucide-react-native';
import { SelectionModal } from '@/components/common/SelectionModal';
import { usePosSaleContext } from '@/context/PosSaleContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import { formatCurrency } from '@/utils/format';
import { colors, appInputStyle, shadows, typography } from '@/theme';
import type { SaleRecord } from '@/types/sales';

interface ReturnSalePickerProps {
  /** Hide the "Return without bill" option — used in Exchange mode, where a source bill is required. Defaults to true (unchanged Return-mode behavior). */
  allowWithoutBill?: boolean;
}

export const ReturnSalePicker: React.FC<ReturnSalePickerProps> = ({
  allowWithoutBill = true,
}) => {
  const pos = usePosSaleContext();
  const { currency } = usePosSettings();
  const [billQuery, setBillQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saleBills, setSaleBills] = useState<SaleRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const source = pos.returnSourceSale;

  const openAllBills = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await pos.loadSalesBillsForReturn();
      setSaleBills(rows);
      setModalOpen(true);
    } catch {
      setSaleBills([]);
      setModalOpen(true);
    } finally {
      setLoadingList(false);
    }
  }, [pos]);

  const lookupBill = async () => {
    const q = billQuery.trim();
    if (!q) {
      return;
    }
    try {
      await pos.findAndLoadReturnSale(q);
      setBillQuery('');
      return;
    } catch {
      /* No exact bill-number match — fall back to a customer-name search below. */
    }

    setLoadingList(true);
    try {
      const rows = await pos.loadSalesBillsForReturn();
      const nameMatches = rows.filter(s =>
        (s.customer_name ?? '').toLowerCase().includes(q.toLowerCase()),
      );
      if (nameMatches.length === 1) {
        await pos.loadReturnSale(nameMatches[0].id);
        setBillQuery('');
      } else if (nameMatches.length > 1) {
        setSaleBills(nameMatches);
        setModalOpen(true);
        setBillQuery('');
      }
      // No name matches either — leave the "No sale found" error from the bill
      // number lookup above showing, it's still accurate.
    } catch {
      /* pos.error already set by findAndLoadReturnSale above */
    } finally {
      setLoadingList(false);
    }
  };

  if (source) {
    return (
      <View style={[styles.loadedCard, shadows.sm]}>
        <View style={styles.loadedIcon}>
          <Receipt size={20} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={styles.loadedBody}>
          <Text style={styles.loadedTitle}>Original sale</Text>
          <Text style={styles.loadedBill}>{source.sales_id}</Text>
          <Text style={styles.loadedMeta} numberOfLines={1}>
            {source.customer_name ?? 'Walk-in'} ·{' '}
            {formatCurrency(source.net_amount, currency)} · {source.items.length}{' '}
            item{source.items.length === 1 ? '' : 's'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={pos.clearReturnSource}
          style={styles.changeBtn}
          hitSlop={8}>
          <X size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  if (pos.returnWithoutBill) {
    return (
      <View style={[styles.walkInCard, shadows.sm]}>
        <Package size={18} color={colors.warning} />
        <View style={styles.walkInBody}>
          <Text style={styles.walkInTitle}>Return without bill</Text>
          <Text style={styles.walkInHint}>
            Pick products below — stock will be added back when you process the return.
          </Text>
        </View>
        <TouchableOpacity onPress={pos.clearReturnSource} hitSlop={8}>
          <X size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.pickCard, shadows.card]}>
      <Text style={styles.pickTitle}>Return from a sale bill</Text>
      <Text style={styles.pickHint}>
        Choose a completed sale bill with items left to return. Fully returned bills
        are hidden.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={billQuery}
          onChangeText={setBillQuery}
          style={[appInputStyle, styles.billInput]}
          placeholder="Bill no. or customer name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={lookupBill}
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={lookupBill}
          disabled={pos.loadingReturnSale}>
          {pos.loadingReturnSale ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Search size={20} color={colors.textOnPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.recentBtn}
        onPress={openAllBills}
        disabled={loadingList || pos.loadingReturnSale}>
        {loadingList ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.recentBtnText}>All sale bills</Text>
        )}
      </TouchableOpacity>

      {allowWithoutBill ? (
        <TouchableOpacity
          style={styles.walkInBtn}
          onPress={pos.startReturnWithoutBill}
          disabled={pos.loadingReturnSale}>
          <Text style={styles.walkInBtnText}>Return without bill</Text>
        </TouchableOpacity>
      ) : null}

      <SelectionModal
        visible={modalOpen}
        title="All sale bills"
        emptyMessage="No sale bills available to return"
        searchable
        searchPlaceholder="Search bill no. or customer name"
        options={saleBills.map(s => ({
          id: String(s.id),
          label: s.sales_id,
          subtitle: [
            s.sale_date,
            s.customer_name ?? 'Walk-in',
            formatCurrency(s.net_amount, currency),
            `${s.items?.length ?? 0} items`,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
        onSelect={async opt => {
          setModalOpen(false);
          try {
            await pos.loadReturnSale(Number(opt.id));
          } catch {
            /* pos.error */
          }
        }}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  pickCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
    marginBottom: 10,
  },
  pickTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  pickHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  billInput: {
    flex: 1,
    marginBottom: 0,
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recentBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDeep,
  },
  walkInBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  loadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  loadedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadedBody: {
    flex: 1,
    minWidth: 0,
  },
  loadedTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  loadedBill: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primaryDeep,
    marginTop: 2,
  },
  loadedMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeBtn: {
    padding: 8,
  },
  walkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: 12,
    marginBottom: 10,
  },
  walkInBody: {
    flex: 1,
    minWidth: 0,
  },
  walkInTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.warning,
  },
  walkInHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
