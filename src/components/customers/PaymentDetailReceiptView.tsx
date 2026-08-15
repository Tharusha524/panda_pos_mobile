import React from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import { HStack, Text } from '@gluestack-ui/themed';
import {
  DEFAULT_RECEIPT_STORE_NAME,
  RECEIPT_SOFTWARE_PROVIDER,
  RECEIPT_SOFTWARE_WEBSITE,
} from '@/constants/receiptBranding';
import { formatCurrency, getCurrencyLabel, resolveCurrencyCode } from '@/utils/format';
import { colors } from '@/theme';
import type { PaymentDetailPayload } from '@/types/payments';
import type { PosMobileSettings } from '@/types/settings';

interface PaymentDetailReceiptViewProps {
  payment: PaymentDetailPayload;
  settings?: PosMobileSettings | null;
}

/** On-screen receipt for a payment fetched by ID (e.g. tapped from Today's table) —
 * generic across every PosPayment source_type (sale/purchase/salary/expense/customer
 * payment), unlike PaymentReceiptView which only works right after receiving a
 * customer payment (needs a before/after balance this generic fetch doesn't have). */
export const PaymentDetailReceiptView: React.FC<PaymentDetailReceiptViewProps> = ({
  payment,
  settings,
}) => {
  const currency = resolveCurrencyCode(settings?.company?.currency);
  const companyName = settings?.company?.name ?? DEFAULT_RECEIPT_STORE_NAME;
  const address = settings?.printHeader?.address_line;
  const phone = settings?.printHeader?.phone;

  const isPaidOut = payment.direction === 'Paid Out';

  return (
    <View style={styles.paper}>
      <Text style={styles.companyName}>{companyName}</Text>
      {address ? <Text style={styles.mutedCenter}>{address}</Text> : null}
      {phone ? <Text style={styles.mutedCenter}>Tel: {phone}</Text> : null}

      <View style={styles.divider} />
      <Text style={styles.invoiceTitle}>{payment.source_label.toUpperCase()}</Text>
      <Text style={styles.mutedCenter}>All amounts in {getCurrencyLabel(currency)}</Text>
      <Text style={styles.mutedCenter}>
        {payment.sales_no ?? `Payment #${payment.id}`}
      </Text>

      <View style={styles.metaBlock}>
        <MetaRow label="Date" value={payment.payment_date} />
        {payment.location ? <MetaRow label="Location" value={payment.location} /> : null}
        {payment.payment_method ? (
          <MetaRow label="Method" value={payment.payment_method} />
        ) : null}
      </View>

      {payment.details.length > 0 ? (
        <>
          <View style={styles.dividerThin} />
          {payment.details.map((line, idx) => (
            <View key={`${line.item_number ?? idx}-${idx}`} style={styles.lineRow}>
              <Text style={styles.lineDesc}>{line.description}</Text>
              <Text style={styles.lineAmt}>{formatCurrency(line.amount, currency)}</Text>
            </View>
          ))}
        </>
      ) : null}

      <View style={styles.divider} />

      {payment.discount > 0 ? (
        <TotalRow
          label="Discount"
          value={`-${formatCurrency(payment.discount, currency)}`}
        />
      ) : null}
      <View style={styles.grandRow}>
        <Text style={styles.grandLabel}>
          {isPaidOut ? 'PAID OUT' : 'AMOUNT'}
        </Text>
        <Text
          style={[
            styles.grandValue,
            isPaidOut ? { color: colors.error } : undefined,
          ]}>
          {formatCurrency(payment.paid_amount, currency)}
        </Text>
      </View>

      {payment.notes?.trim() ? (
        <Text style={styles.notes}>Notes: {payment.notes.trim()}</Text>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.thankYou}>Thank you for your business!</Text>
      <Text style={styles.softwareLine}>{RECEIPT_SOFTWARE_PROVIDER}</Text>
      <Text style={styles.softwareLine}>{RECEIPT_SOFTWARE_WEBSITE}</Text>
    </View>
  );
};

const MetaRow: React.FC<{ label: string; value: string; textStyle?: TextStyle }> = ({
  label,
  value,
  textStyle,
}) => (
  <HStack justifyContent="space-between" py="$0.5">
    <Text style={[styles.metaLabel, textStyle]}>{label}</Text>
    <Text style={[styles.metaValue, textStyle]}>{value}</Text>
  </HStack>
);

const TotalRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <HStack justifyContent="space-between" py="$1">
    <Text style={styles.totalLabel}>{label}</Text>
    <Text style={styles.totalValue}>{value}</Text>
  </HStack>
);

const styles = StyleSheet.create({
  paper: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    letterSpacing: 0.3,
  },
  mutedCenter: {
    fontSize: 12,
    textAlign: 'center',
    color: colors.text,
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 1,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.text,
    marginVertical: 12,
  },
  dividerThin: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.text,
    marginBottom: 4,
  },
  metaBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.text,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  lineDesc: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    paddingRight: 8,
  },
  lineAmt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.text,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: colors.text,
  },
  grandLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  grandValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  notes: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  thankYou: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  softwareLine: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    letterSpacing: 0.4,
  },
});
