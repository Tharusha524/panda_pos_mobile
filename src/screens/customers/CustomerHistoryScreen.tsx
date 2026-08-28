import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { HStack, Text, VStack } from '@gluestack-ui/themed';
import { Landmark } from 'lucide-react-native';
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
import type { CustomerPaymentRecord } from '@/types/customers';
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
  const { showErrorFromUnknown, showError, showConfirm } = useErrorDialog();
  const { settings } = usePosSettings();
  const currency = resolveCurrencyCode(settings?.company?.currency);

  const [loading, setLoading] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [returningPaymentId, setReturningPaymentId] = useState<number | null>(null);
  const [returningSaleId, setReturningSaleId] = useState<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const [customerData, salesResult, paymentsResult] = await Promise.all([
          customerService.get(params.customerId),
          salesService.listSales({ customer_id: params.customerId }),
          customerService.payments(params.customerId).catch(() => []),
        ]);
        setCustomer(customerData);
        setSales(salesResult.sales);
        setPayments(paymentsResult);
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

  /* ── Tap a payment row → reprint that payment's receipt. No pendingConfirm
   * — this is a reprint of something already recorded, not a new payment. */
  const handlePaymentPress = useCallback(
    (payment: CustomerPaymentRecord) => {
      if (!customer) {
        return;
      }
      // Older payments recorded before balance snapshots were tracked have
      // no previous/new balance of their own — fall back to the customer's
      // current balance rather than showing nothing.
      const fallbackBalance = Math.max(0, customer.net_balance ?? 0);
      navigation.navigate('PaymentReceipt', {
        receipt: {
          result: {
            customer,
            payment_received: payment.amount,
            previous_balance: payment.previous_balance ?? fallbackBalance,
            new_balance: payment.new_balance ?? fallbackBalance,
            payment_method: payment.payment_method ?? 'Cash',
            cheque_number: payment.cheque_number,
            bank_name: payment.bank_name,
            bill_number: payment.bill_number,
          },
          notes: payment.notes,
        },
      });
    },
    [customer, navigation],
  );

  /* ── Long-press a cheque payment → mark it as returned (bounced). Only
   * offered for Cheque payments that haven't already been returned. On
   * success, opens the image receipt documenting the return. */
  const handlePaymentLongPress = useCallback(
    (payment: CustomerPaymentRecord) => {
      if (payment.payment_method !== 'Cheque' || payment.is_returned) {
        return;
      }
      showConfirm({
        title: 'Mark cheque as returned?',
        message: `${formatCurrency(payment.amount, currency)} will be added back to this customer's outstanding balance, and the bill it settled (if any) will be outstanding again. This can't be undone.`,
        confirmLabel: 'Mark returned',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          setReturningPaymentId(payment.id);
          try {
            const result = await customerService.returnPayment(params.customerId, payment.id);
            await load(true);
            navigation.navigate('ChequeReturnReceipt', { receipt: { result } });
          } catch (e) {
            showErrorFromUnknown(e, 'Mark cheque returned');
          } finally {
            setReturningPaymentId(null);
          }
        },
      });
    },
    [currency, load, navigation, params.customerId, showConfirm, showErrorFromUnknown],
  );

  /* ── Long-press a cheque-paid sale → mark that cheque as returned. The
   * sale itself (items, inventory) is untouched — only its payment status
   * flips, adding its amount back to the customer's balance as credit. */
  const handleSaleLongPress = useCallback(
    (sale: SaleRecord) => {
      if (sale.payment_method !== 'Cheque' || sale.cheque_returned) {
        return;
      }
      showConfirm({
        title: 'Mark cheque as returned?',
        message: `${formatCurrency(sale.net_amount, currency)} will be added to this customer's outstanding balance as credit owed, and this bill will become pickable in Receive Payment. This can't be undone.`,
        confirmLabel: 'Mark returned',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          setReturningSaleId(sale.id);
          try {
            const result = await customerService.returnSaleCheque(params.customerId, sale.id);
            await load(true);
            navigation.navigate('ChequeReturnReceipt', { receipt: { result } });
          } catch (e) {
            showErrorFromUnknown(e, 'Mark cheque returned');
          } finally {
            setReturningSaleId(null);
          }
        },
      });
    },
    [currency, load, navigation, params.customerId, showConfirm, showErrorFromUnknown],
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
              {sales.map((sale, idx) => {
                const isCheque = sale.payment_method === 'Cheque';
                return (
                  <TouchableOpacity
                    key={sale.id}
                    activeOpacity={0.65}
                    disabled={returningSaleId === sale.id}
                    onPress={() => handleRowPress(sale)}
                    onLongPress={() => handleSaleLongPress(sale)}>
                    <ActivityTableRow
                      columns={COLUMNS}
                      isLast={idx === sales.length - 1}
                      accent={sale.cheque_returned ? 'return' : 'default'}
                      cells={[
                        <Text key="date" style={{ fontSize: 11, color: colors.text }} numberOfLines={1}>
                          {sale.sale_date}
                        </Text>,
                        <Text key="ref" style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }} numberOfLines={1}>
                          {sale.sales_id}
                        </Text>,
                        <HStack key="method" alignItems="center" gap="$1">
                          {isCheque ? <Landmark size={12} color={colors.textSecondary} /> : null}
                          <Text style={{ fontSize: 11, color: colors.text }} numberOfLines={1}>
                            {sale.payment_method ?? '—'}
                            {sale.cheque_returned ? ' (Returned)' : ''}
                          </Text>
                        </HStack>,
                        <Text
                          key="amount"
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: sale.cheque_returned ? colors.textMuted : colors.text,
                            textDecorationLine: sale.cheque_returned ? 'line-through' : 'none',
                          }}
                          numberOfLines={1}>
                          {formatCurrency(sale.net_amount, currency)}
                        </Text>,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </ActivityDataTable>
            {sales.some(s => s.payment_method === 'Cheque' && !s.cheque_returned) ? (
              <Text size="2xs" color={colors.textMuted} px="$1">
                Long-press a cheque sale to mark it as returned (bounced).
              </Text>
            ) : null}
          </VStack>

          {!loading && sales.length === 0 ? (
            <Text color={colors.textMuted} textAlign="center" py="$10">
              No sales history found for this customer.
            </Text>
          ) : null}

          <VStack space="sm">
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
              Payments received
            </Text>
            <ActivityDataTable columns={COLUMNS} emptyMessage="No payments received from this customer.">
              {payments.map((payment, idx) => {
                const isCheque = payment.payment_method === 'Cheque';
                return (
                  <TouchableOpacity
                    key={payment.id}
                    activeOpacity={0.65}
                    disabled={returningPaymentId === payment.id}
                    onPress={() => handlePaymentPress(payment)}
                    onLongPress={() => handlePaymentLongPress(payment)}>
                    <ActivityTableRow
                      columns={COLUMNS}
                      isLast={idx === payments.length - 1}
                      accent={payment.is_returned ? 'return' : 'default'}
                      cells={[
                        <Text key="date" style={{ fontSize: 11, color: colors.text }} numberOfLines={1}>
                          {payment.date}
                        </Text>,
                        <Text key="ref" style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }} numberOfLines={1}>
                          {payment.bill_number ?? payment.reference ?? '—'}
                        </Text>,
                        <HStack key="method" alignItems="center" gap="$1">
                          {isCheque ? <Landmark size={12} color={colors.textSecondary} /> : null}
                          <Text
                            style={{ fontSize: 11, color: colors.text }}
                            numberOfLines={1}>
                            {payment.payment_method ?? '—'}
                            {payment.is_returned ? ' (Returned)' : ''}
                          </Text>
                        </HStack>,
                        <Text
                          key="amount"
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: payment.is_returned ? colors.textMuted : colors.success,
                            textDecorationLine: payment.is_returned ? 'line-through' : 'none',
                          }}
                          numberOfLines={1}>
                          {formatCurrency(payment.amount, currency)}
                        </Text>,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </ActivityDataTable>
            {payments.some(p => p.payment_method === 'Cheque' && !p.is_returned) ? (
              <Text size="2xs" color={colors.textMuted} px="$1">
                Long-press a cheque payment to mark it as returned (bounced).
              </Text>
            ) : null}
          </VStack>
        </VStack>
      </SmoothScrollView>
    </ScreenContainer>
  );
};
