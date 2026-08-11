import React from 'react';
import { Image, StyleSheet, View, type TextStyle } from 'react-native';
import { HStack, Text, VStack } from '@gluestack-ui/themed';
import { useReceiptLogoUri } from '@/hooks/useReceiptLogoUri';
import { useReceiptPrintCustomization } from '@/hooks/useReceiptPrintCustomization';
import {
  DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  type ReceiptTextWeight,
} from '@/types/receiptPrint';
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
}

const WEIGHT_MAP: Record<ReceiptTextWeight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '600',
  bold: '700',
};

// The logo's original box was 120×56 — keep that aspect ratio as its width is resized.
const LOGO_ASPECT_RATIO = 56 / 120;

export const SaleReceiptView: React.FC<SaleReceiptViewProps> = ({
  receipt,
  settings,
  customizationOverride,
}) => {
  const sale = receipt.sale;
  const header = receipt.header as Record<string, string | undefined>;
  const hardware = (settings?.hardware ??
    receipt.hardware_settings ??
    {}) as Record<string, unknown>;
  const logoUrl = useReceiptLogoUri(settings, receipt);
  const loadedCustomization = useReceiptPrintCustomization(settings);
  const customization = customizationOverride ?? loadedCustomization;

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

  // Every body-text line's font size scales proportionally around this baseline
  // (instead of every line getting its own independent control), so the receipt's
  // existing size hierarchy — totals bigger than footnotes — is preserved rather
  // than flattened. 'regular' weight means "leave each line's own designed weight
  // alone", so at the defaults this renders pixel-identical to the original
  // hardcoded styles below.
  const bodyScale =
    customization.receiptBodyTextSizePx /
    DEFAULT_RECEIPT_PRINT_CUSTOMIZATION.receiptBodyTextSizePx;
  const bodyWeightOverride =
    customization.receiptBodyTextWeight === 'regular'
      ? undefined
      : WEIGHT_MAP[customization.receiptBodyTextWeight];
  const scaleFont = (base: number) => Math.max(8, Math.round(base * bodyScale));
  /** Scales font size and, unless the weight is left at 'regular', overrides the
   * line's weight too. Used for ordinary body text. */
  const bodyText = (base: number): TextStyle => ({
    fontSize: scaleFont(base),
    ...(bodyWeightOverride ? { fontWeight: bodyWeightOverride } : null),
  });
  /** Scales font size only — used for the grand total, which always stays at its
   * own extra-bold weight regardless of the body text weight setting, so the key
   * number on the receipt never loses emphasis. */
  const bodyTextSizeOnly = (base: number): TextStyle => ({ fontSize: scaleFont(base) });

  const logoWidth = customization.receiptLogoWidthPx;
  const logoHeight = Math.round(logoWidth * LOGO_ASPECT_RATIO);
  const companyNameStyle: TextStyle = {
    fontSize: customization.receiptCompanyNameSizePx,
    fontWeight: WEIGHT_MAP[customization.receiptCompanyNameWeight],
  };
  // Company details block (address/phone/email/tax ID/reg no) has its own
  // dedicated size+weight, separate from the general body text control below.
  const companyDetailsStyle: TextStyle = {
    fontSize: customization.receiptCompanyDetailsSizePx,
    ...(customization.receiptCompanyDetailsWeight === 'regular'
      ? null
      : { fontWeight: WEIGHT_MAP[customization.receiptCompanyDetailsWeight] }),
  };
  // Both divider styles below are overridden to this thickness and rendered fully
  // solid black — see receiptDividerThicknessPx doc comment.
  const dividerOverride = { height: customization.receiptDividerThicknessPx };

  const now = new Date();
  const printedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const isHold = Boolean(sale.is_hold || sale.order_status === 'hold');
  const invoiceTitle = getSaleReceiptTitle({
    isHold,
    isReturn: Boolean(sale.is_return),
  });

  const discountLabel = (() => {
    const base = sale.discount_label ?? 'Discount';
    if (sale.discount_percent != null && sale.discount_percent > 0) {
      return `${base} (${sale.discount_percent}%)`;
    }
    return base;
  })();
  const change =
    !isHold && sale.amount_received != null
      ? sale.amount_received - sale.net_amount
      : null;
  const customerInfoRows = [
    { label: 'Customer', value: sale.customer_name },
    { label: 'Customer ID', value: sale.customer_code },
    { label: 'Phone', value: sale.customer_contact_no },
    { label: 'Email', value: sale.customer_email },
    { label: 'Location', value: sale.customer_location },
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
          sale.is_return ? { color: colors.error } : isHold ? { color: colors.warning } : undefined,
        ]}>
        {invoiceTitle}
      </Text>
      {isHold ? (
        <Text style={[styles.mutedCenter, styles.holdNotice, bodyText(12)]}>
          Not paid — complete this hold bill to finalize
        </Text>
      ) : null}
      <Text style={[styles.mutedCenter, bodyText(12)]}>
        {sale.is_return ? 'Return No' : isHold ? 'Hold No' : 'Bill No'}: {sale.sales_id}
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

      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.colItem, bodyText(11)]}>Item</Text>
        <Text style={[styles.th, styles.colQty, bodyText(11)]}>Qty</Text>
        <Text style={[styles.th, styles.colAmt, bodyText(11)]}>Amount</Text>
      </View>
      <View style={[styles.dividerThin, dividerOverride]} />

      {sale.lines.map((line, idx) => {
        const uom = resolveLineUom(line.uom);
        return (
        <View key={`${line.item_number}-${idx}`} style={styles.lineRow}>
          <VStack style={styles.colItem} flex={1}>
            <Text style={[styles.lineDesc, bodyText(13)]}>{line.description}</Text>
            <Text style={[styles.lineSub, bodyText(11)]}>
              {line.item_number ? `ID ${line.item_number} · ` : ''}
              {formatReceiptQtyDetail(
                line.qty,
                formatCurrency(line.unit_price, currency),
                uom,
              )}
            </Text>
          </VStack>
          <Text style={[styles.lineQty, styles.colQty, bodyText(11)]}>{`${line.qty} ${uom}`}</Text>
          <Text style={[styles.lineAmt, styles.colAmt, bodyText(13)]}>
            {formatCurrency(line.line_total, currency)}
          </Text>
        </View>
        );
      })}

      <View style={[styles.divider, dividerOverride]} />

      <TotalRow
        label="Subtotal"
        value={formatCurrency(sale.sub_total, currency)}
        textStyle={bodyText(13)}
      />
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
          {isHold ? 'AMOUNT DUE' : sale.discount > 0 ? 'BALANCE' : 'TOTAL'}
        </Text>
        <Text style={[styles.grandValue, bodyTextSizeOnly(16)]}>
          {formatCurrency(sale.net_amount, currency)}
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
  colAmt: { width: 80, textAlign: 'right' },
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
