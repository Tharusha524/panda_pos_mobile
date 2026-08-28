import React from 'react';
import { Image, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { HStack, Text, VStack } from '@gluestack-ui/themed';
import { useReceiptLogoUri } from '@/hooks/useReceiptLogoUri';
import { useReceiptStyleScale } from '@/hooks/useReceiptStyleScale';
import { formatCurrency, resolveCurrencyCode, parseBackendTimestamp } from '@/utils/format';
import { colors } from '@/theme';
import type { SystemReportPayload } from '@/types/reports';
import type { PosMobileSettings } from '@/types/settings';
import { TRANSACTION_TYPE_EXCHANGE, TRANSACTION_TYPE_RETURN } from '@/types/sales';

interface SystemReportViewProps {
  report: SystemReportPayload;
  settings?: PosMobileSettings | null;
}

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

const SectionTitle: React.FC<{ title: string; textStyle?: TextStyle }> = ({
  title,
  textStyle,
}) => <Text style={[styles.sectionTitle, textStyle]}>{title}</Text>;

const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.divider, style]} />
);

export const SystemReportView: React.FC<SystemReportViewProps> = ({
  report,
  settings,
}) => {
  const logoUrl = useReceiptLogoUri(settings, null);
  const {
    customization,
    bodyText,
    companyNameStyle,
    companyDetailsStyle,
    dividerOverride,
    logoWidth,
    logoHeight,
  } = useReceiptStyleScale(settings);
  const showLogo = Boolean(logoUrl && customization.showLogo);

  const currency = resolveCurrencyCode(settings?.company?.currency);
  const header = report.header;
  const now = new Date();
  const printedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const renderDailySummary = () => {
    const data = report.daily_summary;
    if (!data) {
      return null;
    }
    const { metrics, summary } = data;

    return (
      <VStack space="sm">
        <SectionTitle title="Today" textStyle={bodyText(11)} />
        <MetaRow
          label="Sales"
          value={`${summary.today_sales_count} · ${formatCurrency(summary.today_sales_amount, currency)}`}
          textStyle={bodyText(12)}
        />
        {(summary.today_returns_count ?? 0) > 0 ? (
          <MetaRow
            label="Returns"
            value={`${summary.today_returns_count} · ${formatCurrency(summary.today_returns_amount, currency)}`}
            textStyle={bodyText(12)}
          />
        ) : null}
        {summary.today_net_sales_amount != null ? (
          <MetaRow
            label="Net sales"
            value={formatCurrency(summary.today_net_sales_amount, currency)}
            textStyle={bodyText(12)}
          />
        ) : null}
        <MetaRow
          label="Purchases"
          value={`${summary.today_purchases_count} · ${formatCurrency(summary.today_purchases_amount, currency)}`}
          textStyle={bodyText(12)}
        />
        {(report.purchase_rows ?? []).length > 0 ? renderPurchaseRows() : null}
        <MetaRow
          label="Expenses"
          value={formatCurrency(metrics.today_expenses_amount, currency)}
          textStyle={bodyText(12)}
        />
        <MetaRow
          label="Payments"
          value={formatCurrency(metrics.today_payments_amount, currency)}
          textStyle={bodyText(12)}
        />

        <Divider style={dividerOverride} />
        <SectionTitle title="Inventory" textStyle={bodyText(11)} />
        <MetaRow label="Active items" value={String(metrics.active_items)} textStyle={bodyText(12)} />
        <MetaRow label="Low stock" value={String(metrics.low_stock_count)} textStyle={bodyText(12)} />
        <MetaRow
          label="Reorder items"
          value={String(summary.reorder_items_count)}
          textStyle={bodyText(12)}
        />

        <Divider style={dividerOverride} />
        <SectionTitle title="Other" textStyle={bodyText(11)} />
        <MetaRow label="Hold orders" value={String(metrics.hold_orders_count)} textStyle={bodyText(12)} />
        <MetaRow label="Customers" value={String(metrics.customers_count)} textStyle={bodyText(12)} />
        <MetaRow
          label="Month sales"
          value={formatCurrency(metrics.month_sales_amount, currency)}
          textStyle={bodyText(12)}
        />
      </VStack>
    );
  };

  const renderSalesRows = () => {
    const rows = report.sales_rows ?? [];
    if (!rows.length) {
      return <Text style={styles.emptyText}>No sales recorded today.</Text>;
    }

    return rows.map(row => {
      const isReturn = row.transaction_type === TRANSACTION_TYPE_RETURN;
      const isExchange = row.transaction_type === TRANSACTION_TYPE_EXCHANGE;
      const isRefundDue = isExchange && row.amount < 0;
      const showAsReturn = isReturn || isRefundDue;
      return (
        <View key={`${row.id}-${row.sales_id}`} style={styles.rowCard}>
          <HStack justifyContent="space-between" alignItems="flex-start">
            <VStack flex={1} pr="$2">
              <Text style={[styles.rowTitle, bodyText(13)]}>{row.sales_id}</Text>
              {row.customer_name ? (
                <Text style={[styles.rowSub, bodyText(12)]}>{row.customer_name}</Text>
              ) : null}
              <Text style={[styles.rowMeta, bodyText(11)]}>
                {[row.payment_method, row.time, row.location].filter(Boolean).join(' · ')}
              </Text>
            </VStack>
            <VStack alignItems="flex-end">
              <Text style={[styles.rowAmount, bodyText(13), showAsReturn && { color: colors.error }]}>
                {formatCurrency(Math.abs(row.amount), currency)}
              </Text>
              <Text style={[styles.rowBadge, bodyText(10), showAsReturn && styles.rowBadgeReturn]}>
                {isExchange ? 'Exchange' : isReturn ? 'Return' : 'Sale'}
              </Text>
            </VStack>
          </HStack>
        </View>
      );
    });
  };

  const renderPurchaseRows = () => {
    const rows = report.purchase_rows ?? [];
    if (!rows.length) {
      return <Text style={styles.emptyText}>No purchases recorded today.</Text>;
    }

    return rows.map(row => (
      <View key={`${row.id}-${row.invoice_id}`} style={styles.rowCard}>
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack flex={1} pr="$2">
            <Text style={[styles.rowTitle, bodyText(13)]}>{row.invoice_id}</Text>
            {row.supplier_name ? (
              <Text style={[styles.rowSub, bodyText(12)]}>{row.supplier_name}</Text>
            ) : null}
            <Text style={[styles.rowMeta, bodyText(11)]}>
              {[row.payment_method, row.time, row.location].filter(Boolean).join(' · ')}
            </Text>
          </VStack>
          <Text style={[styles.rowAmount, bodyText(13)]}>
            {formatCurrency(row.amount, currency)}
          </Text>
        </HStack>
      </View>
    ));
  };

  const renderReorderRows = () => {
    const rows = report.reorder_rows ?? [];
    if (!rows.length) {
      return <Text style={styles.emptyText}>No items need reordering.</Text>;
    }

    return rows.map(row => (
      <View key={row.id} style={styles.rowCard}>
        <Text style={[styles.rowTitle, bodyText(13)]}>
          {row.item_number ? `${row.item_number} · ` : ''}
          {row.description}
        </Text>
        <Text style={[styles.rowMeta, bodyText(11)]}>
          Stock {row.qty}
          {row.uom ? ` ${row.uom}` : ''} · Reorder {row.reorder_qty}
          {row.location ? ` · ${row.location}` : ''}
        </Text>
      </View>
    ));
  };

  return (
    <View style={styles.paper}>
      {showLogo && logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={[styles.logo, { width: logoWidth, height: logoHeight }]}
          resizeMode="contain"
        />
      ) : null}

      <Text style={[styles.companyName, companyNameStyle]}>
        {header.company_name ?? 'Business Report'}
      </Text>
      {header.address ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>{header.address}</Text>
      ) : null}
      {header.phone ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Tel: {header.phone}</Text>
      ) : null}
      {header.email ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>{header.email}</Text>
      ) : null}
      {header.tax_id ? (
        <Text style={[styles.mutedCenter, companyDetailsStyle]}>Tax ID: {header.tax_id}</Text>
      ) : null}

      <Divider style={dividerOverride} />
      <Text style={[styles.reportTitle, bodyText(14)]}>{report.title}</Text>
      {report.subtitle ? (
        <Text style={[styles.mutedCenter, bodyText(12)]}>{report.subtitle}</Text>
      ) : null}
      {report.generated_at ? (
        <Text style={[styles.mutedCenter, bodyText(12)]}>
          Generated:{' '}
          {parseBackendTimestamp(report.generated_at).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </Text>
      ) : null}

      <View style={styles.body}>
        {report.type === 'daily_summary' ? renderDailySummary() : null}
        {report.type === 'sales_report' ? renderSalesRows() : null}
        {report.type === 'reorder' ? renderReorderRows() : null}
      </View>

      <Divider style={dividerOverride} />
      <Text style={[styles.footerNote, bodyText(10)]}>Printed: {printedAt}</Text>
    </View>
  );
};

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
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: colors.text,
    marginVertical: 12,
    opacity: 0.2,
  },
  body: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  rowCard: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  rowBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  rowBadgeReturn: {
    color: colors.error,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
});
