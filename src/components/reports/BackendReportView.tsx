import React from 'react';
import { Image, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { HStack, Text, VStack } from '@gluestack-ui/themed';
import {
  ActivityDataTable,
  ActivityTableRow,
} from '@/components/common/ActivityDataTable';
import { useReceiptLogoUri } from '@/hooks/useReceiptLogoUri';
import { useReceiptStyleScale } from '@/hooks/useReceiptStyleScale';
import { formatCurrency, resolveCurrencyCode, parseBackendTimestamp } from '@/utils/format';
import { colors } from '@/theme';
import { filterReportColumns } from '@/constants/reportColumnFilters';
import type { BackendReportData } from '@/types/backendReports';
import type { PosMobileSettings } from '@/types/settings';
import type { SystemReportHeader, SystemReportType } from '@/types/reports';

interface BackendReportViewProps {
  report: BackendReportData;
  header: SystemReportHeader;
  settings?: PosMobileSettings | null;
  /** Which catalog report this data came from — used to trim wide reports down
   * to their highest-value columns (see reportColumnFilters). */
  reportType: SystemReportType;
}

const formatCell = (value: unknown, currency: string): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return formatCurrency(value, currency);
    }
    return String(value);
  }
  return String(value);
};

const SectionTitle: React.FC<{ title: string; textStyle?: TextStyle }> = ({
  title,
  textStyle,
}) => <Text style={[styles.sectionTitle, textStyle]}>{title}</Text>;

const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.divider, style]} />
);

export const BackendReportView: React.FC<BackendReportViewProps> = ({
  report,
  header,
  settings,
  reportType,
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
  const now = new Date();
  const printedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const visibleColumns = filterReportColumns(reportType, report.columns);
  const tableColumns = visibleColumns.map(col => ({
    key: col.key,
    label: col.label,
    flex: 1,
  }));

  const renderSalesSummary = () => {
    const sales = report.sales ?? [];
    if (!sales.length) {
      return <Text style={styles.emptyText}>No records for the selected period.</Text>;
    }

    return sales.map(sale => {
      const isReturn = sale.transaction_label === 'Return';
      return (
        <View key={sale.id} style={styles.rowCard}>
          {/* Sales No -> Customer Name -> Payment Type -> Net, in that order. */}
          <Text style={[styles.rowTitle, bodyText(13)]}>{sale.sales_id ?? `#${sale.id}`}</Text>
          <Text style={[styles.rowSub, bodyText(12)]}>{sale.customer}</Text>
          <Text style={[styles.rowMeta, bodyText(11)]}>{sale.payment_method || '—'}</Text>
          <HStack justifyContent="space-between" alignItems="center" mt="$1">
            <Text style={[styles.rowAmount, bodyText(13), isReturn && { color: colors.error }]}>
              {formatCurrency(sale.net_amount, currency)}
            </Text>
            <Text style={[styles.rowBadge, bodyText(10), isReturn && styles.rowBadgeReturn]}>
              {sale.transaction_label}
            </Text>
          </HStack>
          {sale.date || sale.location ? (
            <Text style={[styles.rowMeta, bodyText(11)]}>
              {[sale.date, sale.location].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {sale.items.length ? (
            <VStack mt="$2" space="xs">
              {sale.items.map((item, idx) => (
                <Text key={`${sale.id}-${idx}`} style={[styles.itemLine, bodyText(11)]}>
                  {item.qty} × {item.description ?? item.item_number} ·{' '}
                  {formatCurrency(item.amount, currency)}
                </Text>
              ))}
            </VStack>
          ) : null}
        </View>
      );
    });
  };

  const renderTable = () => {
    if (!visibleColumns.length) {
      return null;
    }

    return (
      <ActivityDataTable
        columns={tableColumns}
        emptyMessage="No records for the selected period or branch.">
        {report.rows.map((row, idx) => (
          <ActivityTableRow
            key={`row-${idx}`}
            columns={tableColumns}
            isLast={idx === report.rows.length - 1}
            cells={visibleColumns.map(col => (
              <Text key={col.key} style={[styles.tableCell, bodyText(11)]} numberOfLines={2}>
                {formatCell(row[col.key], currency)}
              </Text>
            ))}
          />
        ))}
      </ActivityDataTable>
    );
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
      <Text style={[styles.mutedCenter, bodyText(12)]}>
        {report.filters.date_from} — {report.filters.date_to}
      </Text>
      <Text style={[styles.mutedCenter, bodyText(12)]}>{report.filters.branch_name}</Text>
      {report.filters.item_name ? (
        <Text style={[styles.mutedCenter, bodyText(12)]}>Item: {report.filters.item_name}</Text>
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
        {report.note ? (
          <Text style={[styles.noteText, bodyText(12)]}>{report.note}</Text>
        ) : null}

        {report.summary.length ? (
          <VStack space="sm" mb="$3">
            <SectionTitle title="Summary" textStyle={bodyText(11)} />
            {report.summary.map(item => (
              <HStack key={item.label} justifyContent="space-between" py="$0.5">
                <Text style={[styles.metaLabel, bodyText(12)]}>{item.label}</Text>
                <Text style={[styles.metaValue, bodyText(12)]}>
                  {formatCell(item.value, currency)}
                </Text>
              </HStack>
            ))}
            <Divider style={dividerOverride} />
          </VStack>
        ) : null}

        {report.layout === 'sales_summary' ? renderSalesSummary() : renderTable()}
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
  noteText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
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
  itemLine: {
    fontSize: 11,
    color: colors.textMuted,
  },
  tableCell: {
    fontSize: 11,
    color: colors.text,
    flex: 1,
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
