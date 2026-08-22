import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Text, VStack } from '@gluestack-ui/themed';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import {
  ActivityDataTable,
  ActivityTableRow,
  type ActivityTableColumn,
} from '@/components/common/ActivityDataTable';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { usePosSettings } from '@/context/PosSettingsContext';
import { customerService } from '@/services/api/customerService';
import { salesService } from '@/services/api/salesService';
import { formatCurrency, resolveCurrencyCode } from '@/utils/format';
import type { HomeStackParamList } from '@/navigation/types';
import type { CustomerSummary, SaleRecord } from '@/types/sales';
import { colors, TAB_BAR_SCROLL_PADDING } from '@/theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'CustomerHistory'>;
type Route = RouteProp<HomeStackParamList, 'CustomerHistory'>;

/* ── Table columns (removed Type, Direction, Branch) ── */
const COLUMNS: ActivityTableColumn[] = [
  { key: 'date', label: 'Date', flex: 1.2 },
  { key: 'ref', label: 'Ref#', flex: 1 },
  { key: 'method', label: 'Method', flex: 0.9 },
  { key: 'amount', label: 'Amount', flex: 0.9, align: 'right' },
];

export const CustomerHistoryScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { showErrorFromUnknown, showError } = useErrorDialog();
  const { settings } = usePosSettings();
  const currency = resolveCurrencyCode(settings?.company?.currency);

  const [loading, setLoading] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const [customerData, salesResult] = await Promise.all([
          customerService.get(params.customerId),
          salesService.listSales({ customer_id: params.customerId }),
        ]);
        setCustomer(customerData);
        setSales(salesResult.sales);
      } catch (e) {
        if (!silent) {
          showErrorFromUnknown(e, 'Customer history');
          navigation.goBack();
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [navigation, params.customerId, showErrorFromUnknown],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useAutoRefresh({
    onRefresh: silent => load(silent),
    scopes: ['customers', 'sales'],
  });

  /* ── Tap a sale row → fetch receipt and navigate to reprint screen ── */
  const handleRowPress = useCallback(
    async (sale: SaleRecord) => {
      setReceiptLoading(true);
      try {
        const receipt = await salesService.getReceipt(sale.id);
        navigation.navigate('CustomerSaleReceipt', {
          receipt,
          customerId: params.customerId,
        });
      } catch (e) {
        showError({
          title: 'Receipt unavailable',
          message:
            e instanceof Error
              ? e.message
              : 'Could not load receipt for this sale.',
          variant: 'warning',
        });
      } finally {
        setReceiptLoading(false);
      }
    },
    [navigation, showError],
  );

  return (
    <ScreenContainer>
      <AppHeader
        title="Customer history"
        subtitle={customer?.customer_name}
        showBack
      />

      {(loading && !customer) || receiptLoading ? (
        <LoadingOverlay
          message={receiptLoading ? 'Loading receipt…' : 'Loading history…'}
        />
      ) : null}

      <SmoothScrollView
        style={{ flex: 1, backgroundColor: colors.backgroundAlt }}
        contentPaddingBottom={TAB_BAR_SCROLL_PADDING}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(false)} />}>
        <VStack px="$4" py="$4">
          {customer ? (
            <Text size="sm" color={colors.textSecondary} px="$1" mb="$3">
              Outstanding balance:{' '}
              {formatCurrency(Math.max(0, customer.net_balance ?? 0), currency)}
            </Text>
          ) : null}

          <VStack space="sm" mb="$4">
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
              Sales history
            </Text>
            <ActivityDataTable columns={COLUMNS} emptyMessage="No sales found for this customer.">
              {sales.map((sale, idx) => (
                <TouchableOpacity
                  key={sale.id}
                  activeOpacity={0.65}
                  onPress={() => handleRowPress(sale)}>
                  <ActivityTableRow
                    columns={COLUMNS}
                    isLast={idx === sales.length - 1}
                    cells={[
                      <Text key="date" style={{ fontSize: 11, color: colors.text }} numberOfLines={1}>
                        {sale.sale_date}
                      </Text>,
                      <Text key="ref" style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }} numberOfLines={1}>
                        {sale.sales_id}
                      </Text>,
                      <Text key="method" style={{ fontSize: 11, color: colors.text }} numberOfLines={1}>
                        {sale.payment_method ?? '—'}
                      </Text>,
                      <Text key="amount" style={{ fontSize: 11, color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                        {formatCurrency(sale.net_amount, currency)}
                      </Text>,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </ActivityDataTable>
          </VStack>

          {!loading && sales.length === 0 ? (
            <Text color={colors.textMuted} textAlign="center" py="$10">
              No sales history found for this customer.
            </Text>
          ) : null}
        </VStack>
      </SmoothScrollView>
    </ScreenContainer>
  );
};
