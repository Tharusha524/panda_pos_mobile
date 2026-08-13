import React from 'react';
import { Image, StyleSheet, View, type TextStyle } from 'react-native';
import { HStack, Text } from '@gluestack-ui/themed';
import { useReceiptLogoUri } from '@/hooks/useReceiptLogoUri';
import { useReceiptStyleScale } from '@/hooks/useReceiptStyleScale';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_RECEIPT_STORE_NAME,
  RECEIPT_SOFTWARE_PROVIDER,
  RECEIPT_SOFTWARE_WEBSITE,
} from '@/constants/receiptBranding';
import { formatCurrency, getCurrencyLabel, resolveCurrencyCode } from '@/utils/format';
import { colors } from '@/theme';
import type { ReceivePaymentResult } from '@/types/customers';
import type { PosMobileSettings } from '@/types/settings';
import type { SystemReportHeader } from '@/types/reports';

interface PaymentReceiptViewProps {
  result: ReceivePaymentResult;
  notes?: string | null;
  header: SystemReportHeader;
  settings?: PosMobileSettings | null;
}

/** On-screen preview for a "receive payment" receipt — same header/logo treatment
 * as SaleReceiptView (including the same layout customization settings), but with
 * the payment-specific body (previous/new balance, amount received, paid by) that
 * the old text-only receipt printed. */
export const PaymentReceiptView: React.FC<PaymentReceiptViewProps> = ({
  result,
  notes,
  header,
  settings,
}) => {
  const logoUrl = useReceiptLogoUri(settings, null);
  const {
    bodyText,
    bodyTextSizeOnly,
    companyNameStyle,
    companyDetailsStyle,
    dividerOverride,
    logoWidth,
    logoHeight,
  } = useReceiptStyleScale(settings);
  const { user } = useAuth();

  const currency = resolveCurrencyCode(settings?.company?.currency);
  const companyName =
    header.company_name ?? settings?.company?.name ?? DEFAULT_RECEIPT_STORE_NAME;
  const address = header.address ?? settings?.printHeader?.address_line;
  const phone = header.phone ?? settings?.printHeader?.phone;
  const email = header.email ?? settings?.printHeader?.email;
  const taxId = header.tax_id ?? settings?.printHeader?.tax_id;
  const regNo = settings?.printHeader?.registration_number;

  const hardware = (settings?.hardware ?? {}) as Record<string, unknown>;
  const showLogo = Boolean(logoUrl && hardware.allow_logo_on_sales_receipt !== false);

  const now = new Date();
  const printedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  return (
    <View style={styles.paper}>
      {showLogo && logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={[styles.logo, { width: logoWidth, height: logoHeight }]}
          resizeMode="contain"
        />
      ) : null}

      <Text style={[styles.companyName, companyNameStyle]}>{companyName}</Text>
      {address ? <Text style={[styles.mutedCenter, companyDetailsStyle]}>{address}</Text> : null}
      {phone ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Tel: {phone}</Text>
      ) : null}
      {email ? <Text style={[styles.mutedCenter, companyDetailsStyle]}>{email}</Text> : null}
      {taxId ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Tax ID: {taxId}</Text>
      ) : null}
      {regNo ? <Text style={[styles.mutedCenter, companyDetailsStyle]}>Reg: {regNo}</Text> : null}

      <View style={[styles.divider, dividerOverride]} />
      <Text style={[styles.invoiceTitle, bodyText(14)]}>PAYMENT RECEIPT</Text>
      <Text style={[styles.mutedCenter, bodyText(12)]}>
        All amounts in {getCurrencyLabel(currency)}
      </Text>

      <View style={styles.metaBlock}>
        <MetaRow label="Date" value={printedAt} textStyle={bodyText(12)} />
        {user?.name ? <MetaRow label="Cashier" value={user.name} textStyle={bodyText(12)} /> : null}
      </View>

      <View style={[styles.dividerThin, dividerOverride]} />
      <Text style={[styles.partyTitle, bodyText(11)]}>Customer</Text>
      <View style={styles.partyBlock}>
        <MetaRow label="Name" value={result.customer.customer_name} textStyle={bodyText(12)} />
        {result.customer.contact_no ? (
          <MetaRow label="Phone" value={result.customer.contact_no} textStyle={bodyText(12)} />
        ) : null}
      </View>

      <View style={[styles.divider, dividerOverride]} />

      <TotalRow
        label="Previous balance"
        value={formatCurrency(result.previous_balance, currency)}
        textStyle={bodyText(13)}
      />
      <TotalRow
        label="Amount received"
        value={formatCurrency(result.payment_received, currency)}
        textStyle={bodyText(13)}
      />
      <View style={styles.grandRow}>
        <Text style={[styles.grandLabel, bodyTextSizeOnly(16)]}>NEW BALANCE</Text>
        <Text style={[styles.grandValue, bodyTextSizeOnly(16)]}>
          {formatCurrency(result.new_balance, currency)}
        </Text>
      </View>

      <Text style={[styles.paidBy, bodyText(13)]}>Paid By {result.payment_method}</Text>
      {notes?.trim() ? (
        <Text style={[styles.notes, bodyText(12)]}>Notes: {notes.trim()}</Text>
      ) : null}

      <View style={[styles.divider, dividerOverride]} />
      <Text style={[styles.thankYou, bodyText(13)]}>Thank you for your business!</Text>
      <Text style={[styles.softwareLine, bodyText(11)]}>{RECEIPT_SOFTWARE_PROVIDER}</Text>
      <Text style={[styles.softwareLine, bodyText(11)]}>{RECEIPT_SOFTWARE_WEBSITE}</Text>
      <Text style={[styles.footerNote, bodyText(10)]}>Printed: {printedAt}</Text>
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

const TotalRow: React.FC<{ label: string; value: string; textStyle?: TextStyle }> = ({
  label,
  value,
  textStyle,
}) => (
  <HStack justifyContent="space-between" py="$1">
    <Text style={[styles.totalLabel, textStyle]}>{label}</Text>
    <Text style={[styles.totalValue, textStyle]}>{value}</Text>
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
  logo: {
    width: 120,
    height: 56,
    alignSelf: 'center',
    marginBottom: 8,
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
  partyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  partyBlock: {
    marginTop: 4,
    marginBottom: 8,
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
  paidBy: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 10,
  },
  notes: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
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
  footerNote: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.text,
    marginTop: 6,
  },
});
