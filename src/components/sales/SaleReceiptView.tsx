import React from 'react';
import { Image, StyleSheet, View, type TextStyle } from 'react-native';
import { HStack, Text, VStack } from '@gluestack-ui/themed';
import { useReceiptLogoUri } from '@/hooks/useReceiptLogoUri';
import { useReceiptStyleScale } from '@/hooks/useReceiptStyleScale';
import {
  DEFAULT_RECEIPT_STORE_NAME,
  getSaleReceiptTitle,
  RECEIPT_SOFTWARE_PROVIDER,
  RECEIPT_SOFTWARE_WEBSITE,
} from '@/constants/receiptBranding';
import { formatCurrency, getCurrencyLabel, resolveCurrencyCode } from '@/utils/format';
import { formatReceiptQtyDetail, resolveLineUom } from '@/utils/uom';
import { colors } from '@/theme';
import type { SaleReceiptPayload } from '@/types/sales';
import type { PosMobileSettings } from '@/types/settings';
import type { ReceiptPrintCustomization } from '@/types/receiptPrint';

interface SaleReceiptViewProps {
  receipt: SaleReceiptPayload;
  settings?: PosMobileSettings | null;
  /** Bypasses the normal load-from-device-storage customization (see
   * useReceiptPrintCustomization) and renders with this value instead — used only
   * by the Receipt layout settings screen so its live preview reflects in-progress,
   * not-yet-saved changes instantly instead of lagging a save behind. */
  customizationOverride?: ReceiptPrintCustomization;
  /** Customer's total amount owed overall (across all their past sales) — distinct
   * from this bill's own total above. Only shown when the caller resolved and
   * supplied a real customer's current balance; omit for walk-in sales. */
  customerOutstandingBalance?: number | null;
}

export const SaleReceiptView: React.FC<SaleReceiptViewProps> = ({
  receipt,
  settings,
  customizationOverride,
  customerOutstandingBalance,
}) => {
  const sale = receipt.sale;
  const header = receipt.header as Record<string, string | undefined>;
  const hardware = (settings?.hardware ??
    receipt.hardware_settings ??
    {}) as Record<string, unknown>;
  const logoUrl = useReceiptLogoUri(settings, receipt);
  const {
    bodyText,
    bodyTextSizeOnly,
    companyNameStyle,
    companyDetailsStyle,
    dividerOverride,
    logoWidth,
    logoHeight,
  } = useReceiptStyleScale(settings, customizationOverride);

  const currency = resolveCurrencyCode(settings?.company?.currency);
  const companyName =
    header.company_name ??
    settings?.printHeader?.company_name ??
    settings?.company?.name ??
    DEFAULT_RECEIPT_STORE_NAME;
  const address =
    header.address_line ?? header.address ?? settings?.printHeader?.address_line;
  const phone = header.phone ?? settings?.printHeader?.phone;
  const email = header.email ?? settings?.printHeader?.email;
  const taxId = header.tax_id ?? settings?.printHeader?.tax_id;
  const regNo =
    header.registration_number ?? settings?.printHeader?.registration_number;

  const showLogo = Boolean(
    logoUrl && hardware.allow_logo_on_sales_receipt !== false,
  );

  const now = new Date();
  const printedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const isHold = Boolean(sale.is_hold || sale.order_status === 'hold');
  const isRefundDue = Boolean(sale.is_exchange) && sale.net_amount < 0;
  const invoiceTitle = getSaleReceiptTitle({
    isHold,
    isReturn: Boolean(sale.is_return),
  });
  const saleLines = sale.lines.filter(line => line.line_direction !== 'return');
  const returnLines = sale.lines.filter(line => line.line_direction === 'return');
  const hasReturnLines = returnLines.length > 0;
  const renderLine = (line: (typeof sale.lines)[number], idx: number) => {
    const uom = resolveLineUom(line.uom);
    const isReturnLine = line.line_direction === 'return';
    return (
      <View key={`${line.item_number}-${idx}`} style={styles.lineRow}>
        <VStack style={styles.colItem} flex={1}>
          <Text style={[styles.lineDesc, bodyText(13)]}>{line.description}</Text>
          <Text style={[styles.lineSub, bodyText(11)]}>
            {formatReceiptQtyDetail(
              line.qty,
              formatCurrency(line.unit_price, currency),
              uom,
            )}
          </Text>
        </VStack>
        <Text style={[styles.lineQty, styles.colQty, bodyText(11)]}>{`${line.qty} ${uom}`}</Text>
        <Text style={[styles.lineAmt, styles.colAmt, bodyText(13)]}>
          {isReturnLine ? '-' : ''}
          {formatCurrency(line.line_total, currency)}
        </Text>
      </View>
    );
  };

  const discountLabel = (() => {
    const base = sale.discount_label ?? 'Discount';
    if (sale.discount_percent != null && sale.discount_percent > 0) {
      return `${base} (${sale.discount_percent}%)`;
    }
    return base;
  })();
  // Refund-due exchanges store a signed (negative) net_amount — show the positive
  // magnitude everywhere on the receipt, matching how it's collected at checkout.
  const displayNetAmount = isRefundDue ? Math.abs(sale.net_amount) : sale.net_amount;
  const change =
    !isHold && sale.amount_received != null
      ? sale.amount_received - displayNetAmount
      : null;
  const customerInfoRows = [
    { label: 'Customer', value: sale.customer_name },
    { label: 'Customer ID', value: sale.customer_code },
    { label: 'Phone', value: sale.customer_contact_no },
    { label: 'Email', value: sale.customer_email },
    { label: 'Route', value: sale.customer_route },
    { label: 'Address', value: sale.customer_address },
    { label: 'Tax ID', value: sale.customer_tax_id },
  ].filter(row => Boolean(row.value && String(row.value).trim().length > 0));

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
      {address ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>{address}</Text>
      ) : null}
      {phone ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Tel: {phone}</Text>
      ) : null}
      {email ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>{email}</Text>
      ) : null}
      {taxId ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Tax ID: {taxId}</Text>
      ) : null}
      {regNo ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Reg: {regNo}</Text>
      ) : null}

      <View style={[styles.divider, dividerOverride]} />
      <Text
        style={[
          styles.invoiceTitle,
          bodyText(14),
          sale.is_return
            ? { color: colors.error }
            : isHold
              ? { color: colors.warning }
              : undefined,
        ]}>
        {invoiceTitle}
      </Text>
      {isHold ? (
        <Text style={[styles.mutedCenter, styles.holdNotice, bodyText(12)]}>
          Not paid — complete this hold bill to finalize
        </Text>
      ) : null}
      <Text style={[styles.mutedCenter, bodyText(12)]}>
        {sale.is_return
          ? 'Return No'
          : sale.is_exchange
            ? 'Exchange No'
            : isHold
              ? 'Hold No'
              : 'Bill No'}: {sale.sales_id}
      </Text>
      <Text style={[styles.mutedCenter, bodyText(12)]}>
        All amounts in {getCurrencyLabel(currency)}
      </Text>

      <View style={styles.metaBlock}>
        <MetaRow label="Date" value={sale.sale_date} textStyle={bodyText(12)} />
        {sale.location ? (
          <MetaRow label="Branch" value={sale.location} textStyle={bodyText(12)} />
        ) : null}
        <MetaRow
          label="Payment"
          value={sale.payment_method ?? 'Cash'}
          textStyle={bodyText(12)}
        />
      </View>

      {customerInfoRows.length > 0 ? (
        <>
          <View style={[styles.dividerThin, dividerOverride]} />
          <Text style={[styles.partyTitle, bodyText(11)]}>Customer Information</Text>
          <View style={styles.partyBlock}>
            {customerInfoRows.map(row => (
              <MetaRow
                key={row.label}
                label={row.label}
                value={String(row.value)}
                textStyle={bodyText(12)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasReturnLines ? (
        <>
          <Text style={[styles.sectionLabel, bodyText(11)]}>SOLD ITEMS</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colItem, bodyText(11)]}>Item</Text>
            <Text style={[styles.th, styles.colQty, bodyText(11)]}>Qty</Text>
            <Text style={[styles.th, styles.colAmt, bodyText(11)]}>Amount</Text>
          </View>
          <View style={[styles.dividerThin, dividerOverride]} />
          {saleLines.map((line, idx) => renderLine(line, idx))}

          <Text style={[styles.sectionLabel, styles.sectionLabelReturn, bodyText(11)]}>
            RETURNED ITEMS
          </Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colItem, bodyText(11)]}>Item</Text>
            <Text style={[styles.th, styles.colQty, bodyText(11)]}>Qty</Text>
            <Text style={[styles.th, styles.colAmt, bodyText(11)]}>Amount</Text>
          </View>
          <View style={[styles.dividerThin, dividerOverride]} />
          {returnLines.map((line, idx) => renderLine(line, idx))}
        </>
      ) : (
        <>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colItem, bodyText(11)]}>Item</Text>
            <Text style={[styles.th, styles.colQty, bodyText(11)]}>Qty</Text>
            <Text style={[styles.th, styles.colAmt, bodyText(11)]}>Amount</Text>
          </View>
          <View style={[styles.dividerThin, dividerOverride]} />
          {sale.lines.map((line, idx) => renderLine(line, idx))}
        </>
      )}

      <View style={[styles.divider, dividerOverride]} />

      <TotalRow
        label="Subtotal"
        value={formatCurrency(sale.sub_total, currency)}
        textStyle={bodyText(13)}
      />
      {(sale.return_sub_total ?? 0) > 0 ? (
        <TotalRow
          label="Return credit"
          value={`-${formatCurrency(sale.return_sub_total ?? 0, currency)}`}
          textStyle={bodyText(13)}
        />
      ) : null}
      {sale.discount > 0 ? (
        <TotalRow
          label={discountLabel}
          value={`-${formatCurrency(sale.discount, currency)}`}
          textStyle={bodyText(13)}
        />
      ) : null}
      {(sale.service_charge ?? 0) > 0 ? (
        <TotalRow
          label="Service charge"
          value={formatCurrency(sale.service_charge ?? 0, currency)}
          textStyle={bodyText(13)}
        />
      ) : null}
      <View style={styles.grandRow}>
        <Text style={[styles.grandLabel, bodyTextSizeOnly(16)]}>
          {isHold
            ? 'AMOUNT DUE'
            : isRefundDue
              ? 'REFUND DUE'
              : sale.discount > 0
                ? 'BALANCE'
                : 'TOTAL'}
        </Text>
        <Text style={[styles.grandValue, bodyTextSizeOnly(16)]}>
          {formatCurrency(displayNetAmount, currency)}
        </Text>
      </View>
      {!isHold && sale.amount_received != null ? (
        <>
          <TotalRow
            label="Received"
            value={formatCurrency(sale.amount_received, currency)}
            textStyle={bodyText(13)}
          />
          {change != null && change >= 0 ? (
            <TotalRow
              label="Change"
              value={formatCurrency(change, currency)}
              textStyle={bodyText(13)}
            />
          ) : null}
        </>
      ) : null}
      {customerOutstandingBalance != null ? (
        <TotalRow
          label="Outstanding balance"
          value={formatCurrency(customerOutstandingBalance, currency)}
          textStyle={bodyText(13)}
        />
      ) : null}

      <View style={[styles.divider, dividerOverride]} />
      <Text style={[styles.thankYou, bodyText(13)]}>Thank you for your business!</Text>
      <Text style={[styles.softwareLine, bodyText(11)]}>{RECEIPT_SOFTWARE_PROVIDER}</Text>
      <Text style={[styles.softwareLine, bodyText(11)]}>{RECEIPT_SOFTWARE_WEBSITE}</Text>
      <Text style={[styles.footerNote, bodyText(10)]}>Printed: {printedAt}</Text>
      {sale.show_barcode && sale.barcode_value ? (
        <Text style={[styles.barcode, bodyText(11)]}>{sale.barcode_value}</Text>
      ) : null}
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
  holdNotice: {
    color: colors.warning,
    fontWeight: '700',
    marginTop: 4,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  sectionLabelReturn: {
    marginTop: 12,
  },
  tableHead: {
    flexDirection: 'row',
    marginTop: 4,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
  },
  colItem: { flex: 1 },
  colQty: { width: 52, textAlign: 'right' },
  colAmt: { width: 110, textAlign: 'right' },
  lineRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'flex-start',
  },
  lineDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  lineSub: {
    fontSize: 11,
    color: colors.text,
    marginTop: 2,
  },
  lineAmt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  lineQty: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
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
  barcode: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 8,
    letterSpacing: 2,
  },
});
