import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Text, VStack } from '@gluestack-ui/themed';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { BackendReportView } from '@/components/reports/BackendReportView';
import { SystemReportView } from '@/components/reports/SystemReportView';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { useSystemReport } from '@/hooks/useSystemReport';
import { bluetoothPrintService } from '@/services/bluetooth/bluetoothPrintService';
import { reportService } from '@/services/api/reportService';
import { navigateToPrinterSetup } from '@/navigation/navigationRef';
import { getReportMeta } from '@/types/reports';
import type { ReportsStackParamList } from '@/navigation/types';
import type { BackendReportData, SalesSummarySale } from '@/types/backendReports';
import { colors } from '@/theme';
import {
  defaultReportFilters,
  formatReportDateRangeLabel,
} from '@/utils/reportDateFilters';
import type { ReportFilterParams } from '@/types/reportFilters';
import { captureReceiptBase64 } from '@/utils/receiptImageShare';
import { supportsDateFilter, supportsItemFilter } from '@/constants/reportFilterCapabilities';
import { downloadDailySalesExcel, shareDailySalesExcel } from '@/utils/dailySalesFile';
import { downloadReportTableExcel, shareReportTableExcel } from '@/utils/reportTableFile';
import {
  downloadCustomerSettlementExcel,
  shareCustomerSettlementExcel,
} from '@/utils/customerSettlementFile';
import {
  buildPrintHeaderFromSettings as buildHeader,
  getReceiptPrintCustomization,
} from '@/utils/receiptPrintCustomization';

type Route = RouteProp<ReportsStackParamList, 'ReportView'>;

const isPrinterSetupError = (msg: string): boolean =>
  /no printer|not configured|settings/i.test(msg);

/** Matches a Sale row's items against its returned_items (by item number,
 * falling back to description) and subtracts the returned qty/amount from
 * each matched item — so a partially returned bill shows correctly reduced
 * Pcs/amounts in the Sales Report Excel instead of the full original
 * quantities. Returns null when the bill was fully returned (dropped from
 * the report entirely, matching the on-screen Sales Report). */
const applyReturnsToSalesReportRow = (sale: SalesSummarySale): SalesSummarySale | null => {
  const returnedAmount = sale.returned_amount ?? 0;
  const netAfterReturn = Math.round((sale.net_amount - returnedAmount) * 100) / 100;
  if (netAfterReturn <= 0.01) {
    return null;
  }

  const returnedItems = sale.returned_items ?? [];
  if (returnedItems.length === 0) {
    return sale;
  }

  const returnedByKey = new Map(
    returnedItems.map(r => [(r.item_number?.trim() || r.description?.trim() || '').toUpperCase(), r]),
  );

  const items = sale.items
    .map(item => {
      const key = (item.item_number?.trim() || item.description?.trim() || '').toUpperCase();
      const returned = key ? returnedByKey.get(key) : undefined;
      if (!returned) {
        return item;
      }
      const qty = Math.round((item.qty - returned.qty) * 100) / 100;
      if (qty <= 0.009) {
        return null;
      }
      const amount = Math.round((item.amount - returned.amount) * 100) / 100;
      return { ...item, qty, amount, net_price: qty > 0 ? Math.round((amount / qty) * 100) / 100 : item.unit_price };
    })
    .filter((item): item is SalesSummarySale['items'][number] => item !== null);

  return { ...sale, net_amount: netAfterReturn, items };
};

export const ReportViewScreen: React.FC = () => {
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { settings, currency } = usePosSettings();
  const { showError, showConfirm } = useErrorDialog();
  const [filters, setFilters] = useState<ReportFilterParams>(defaultReportFilters);
  const { result, loading, refreshing, error, refresh } = useSystemReport(
    params.type,
    filters,
  );
  const [printing, setPrinting] = useState(false);
  const reportShotRef = useRef<ViewShotRef>(null);
  const lastError = useRef<string | null>(null);

  const meta = getReportMeta(params.type);
  const header = useMemo(() => buildHeader(settings), [settings]);

  // Daily Business Summary's dashboard API is fixed to "today" and ignores
  // the date filter entirely (see useSystemReport) — so instead of showing
  // that live dashboard, this report type always fetches sales-summary for
  // whatever range is picked on the filter bar as a side channel, and shows
  // that instead. Same range-picker UX as the other report types below.
  const isDailySummary = params.type === 'daily_summary';
  // Sales report already has its own date-range picker (ReportFilterBar
  // below) — it reuses the same Excel pivot as Daily Business Summary, just
  // fed that range's sales instead of a single day's, no extra UI needed.
  const isSalesReport = params.type === 'sales_report';
  // Return report also uses the item-level pivot — sales-summary already
  // returns both sales and returns together (row.transaction_label tells
  // them apart), so it's filtered down to Return rows only after fetching.
  const isReturnReport = params.type === 'return_report';
  // Credit sales Excel also needs to show the actual items bought (like
  // Daily/Sales/Return do) instead of just Name/Phone/Outstanding — reuses
  // the same item-level pivot, filtered down to credit-related sales only
  // (either plain payment_method 'Credit', or a split-payment sale with a
  // Credit portion) after fetching.
  const isCreditSales = params.type === 'credit_sales';
  const pivotExcelSupported = isDailySummary || isSalesReport || isReturnReport || isCreditSales;
  // Customer Settlement is already a flat column/row table (see
  // reportPayload on the backend) — exported as-is via the generic table
  // exporter instead of the item-level sales pivot above.
  const isCustomerSettlement = params.type === 'customer_settlement';
  const genericExcelSupported = isCustomerSettlement;
  const excelExportSupported = pivotExcelSupported || genericExcelSupported;
  const [dailySalesReport, setDailySalesReport] = useState<BackendReportData | null>(null);
  const [dailySalesLoading, setDailySalesLoading] = useState(false);
  const [dailySalesError, setDailySalesError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState<'download' | 'share' | null>(null);

  // All of Daily Business Summary / Sales report / Return report / Customer
  // Settlement / Credit sales now use the normal filter bar's date range.
  const excelDateFrom = filters.dateFrom;
  const excelDateTo = filters.dateTo;

  useEffect(() => {
    if (!pivotExcelSupported) {
      return;
    }
    let cancelled = false;
    setDailySalesLoading(true);
    setDailySalesError(null);
    reportService
      .fetch('sales-summary', { dateFrom: excelDateFrom, dateTo: excelDateTo })
      .then(report => {
        if (!cancelled) {
          setDailySalesReport(
            isReturnReport
              ? { ...report, sales: (report.sales ?? []).filter(s => s.transaction_label === 'Return') }
              : isCreditSales
                ? {
                    ...report,
                    sales: (report.sales ?? []).filter(
                      s =>
                        /^credit$/i.test(s.payment_method?.trim() ?? '') ||
                        (s.payment_splits ?? []).some(sp => /^credit$/i.test(sp.payment_method?.trim() ?? '')),
                    ),
                  }
                : isSalesReport || isDailySummary
                  ? {
                      ...report,
                      // Deducts each bill's returned amount/items the same
                      // way for both reports — buildDailySalesPivot still
                      // separately filters out the Return-type rows
                      // themselves (untouched by this), so only the
                      // adjusted Sale rows end up in the final sheet.
                      sales: (report.sales ?? [])
                        .map(applyReturnsToSalesReportRow)
                        .filter((s): s is SalesSummarySale => s !== null),
                    }
                  : report,
          );
        }
      })
      .catch(e => {
        if (!cancelled) {
          setDailySalesError(e instanceof Error ? e.message : 'Failed to load sales for this period');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDailySalesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pivotExcelSupported, excelDateFrom, excelDateTo]);

  const handleExportExcel = async (action: 'download' | 'share') => {
    const dateKey = `${excelDateFrom}_to_${excelDateTo}`;
    const dateLabel = formatReportDateRangeLabel(excelDateFrom, excelDateTo);

    setExportingExcel(action);
    try {
      if (genericExcelSupported) {
        if (!result || result.source !== 'backend') {
          showError({
            title: 'Excel export',
            message: 'This report is still loading — try again in a moment.',
            variant: 'warning',
          });
          return;
        }
        // Customer Settlement pivots by payment method (route/customer/bill,
        // one amount column per method, cheque no./bank) — a different
        // layout from the plain flat-table export the other reports use.
        if (isCustomerSettlement) {
          if (action === 'download') {
            const message = await downloadCustomerSettlementExcel(result.report, dateKey, dateLabel);
            showError({ title: 'Excel saved', message, variant: 'info', confirmLabel: 'OK' });
          } else {
            await shareCustomerSettlementExcel(result.report, dateKey, dateLabel);
          }
          return;
        }
        if (action === 'download') {
          const message = await downloadReportTableExcel(result.report, dateKey, dateLabel);
          showError({ title: 'Excel saved', message, variant: 'info', confirmLabel: 'OK' });
        } else {
          await shareReportTableExcel(result.report, dateKey, dateLabel);
        }
        return;
      }

      if (!dailySalesReport) {
        showError({
          title: 'Excel export',
          message: 'Sales for this period are still loading — try again in a moment.',
          variant: 'warning',
        });
        return;
      }
      const title = isSalesReport
        ? 'Sales Report'
        : isReturnReport
          ? 'Return Report'
          : isCreditSales
            ? 'Credit Sales Report'
            : 'Daily Sale Report';
      if (action === 'download') {
        const message = await downloadDailySalesExcel(
          dailySalesReport.sales ?? [],
          dateKey,
          dateLabel,
          title,
          isReturnReport,
        );
        showError({ title: 'Excel saved', message, variant: 'info', confirmLabel: 'OK' });
      } else {
        await shareDailySalesExcel(
          dailySalesReport.sales ?? [],
          dateKey,
          dateLabel,
          title,
          isReturnReport,
        );
      }
    } catch (e) {
      showError({
        title: action === 'download' ? 'Download failed' : 'Share failed',
        message: e instanceof Error ? e.message : 'Could not export the Excel report',
        variant: 'warning',
      });
    } finally {
      setExportingExcel(null);
    }
  };

  useEffect(() => {
    if (error && error !== lastError.current) {
      lastError.current = error;
      showError({ title: 'Report unavailable', message: error });
    }
  }, [error, showError]);

  const promptPrinterSetup = (message: string) => {
    showConfirm({
      title: 'Printer not set up',
      message,
      confirmLabel: 'Open printer setup',
      cancelLabel: 'Cancel',
      onConfirm: () => navigateToPrinterSetup(),
    });
  };

  const handlePrint = async () => {
    if (!result) {
      return;
    }
    if (!bluetoothPrintService.isSupported()) {
      promptPrinterSetup(
        'Bluetooth printing is not available on this device.\n\nConfigure a receipt printer in Settings → Receipt printer.',
      );
      return;
    }
    setPrinting(true);
    try {
      let capturedImageBase64: string | undefined;
      try {
        const customization = await getReceiptPrintCustomization(settings);
        if (customization.printAsImage) {
          capturedImageBase64 = await captureReceiptBase64(reportShotRef);
        }
      } catch {
        // Couldn't read the setting or capture the preview — fall back to the
        // normal text report below instead of blocking the print entirely.
      }
      if (result.source === 'dashboard') {
        await bluetoothPrintService.printReport(
          result.report,
          currency,
          settings,
          capturedImageBase64,
        );
      } else {
        await bluetoothPrintService.printBackendReport(
          result.report,
          header,
          currency,
          settings,
          capturedImageBase64,
          params.type,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Print failed';
      if (isPrinterSetupError(msg)) {
        promptPrinterSetup(
          `${msg}\n\nConfigure your portable printer once in Settings → Receipt printer.`,
        );
      } else {
        showError({ title: 'Print', message: msg, variant: 'warning' });
      }
    } finally {
      setPrinting(false);
    }
  };

  const subtitle = useMemo(() => {
    if (isDailySummary) {
      return formatReportDateRangeLabel(filters.dateFrom, filters.dateTo);
    }
    if (result?.source === 'dashboard') {
      return result.report.subtitle ?? formatReportDateRangeLabel(filters.dateFrom, filters.dateTo);
    }
    if (result?.source === 'backend') {
      const itemSuffix = result.report.filters.item_name
        ? ` · ${result.report.filters.item_name}`
        : filters.itemLabel
          ? ` · ${filters.itemLabel}`
          : '';
      return `${result.report.filters.date_from} — ${result.report.filters.date_to}${itemSuffix}`;
    }
    return meta?.subtitle;
  }, [
    filters.dateFrom,
    filters.dateTo,
    filters.itemLabel,
    isDailySummary,
    meta?.subtitle,
    result,
  ]);

  const scrollBottomPad = Math.max(insets.bottom, 16) + 88;

  return (
    <ScreenContainer>
      <AppHeader
        title={meta?.title ?? (result?.source === 'backend' ? result.report.title : 'Report')}
        subtitle={subtitle}
        showBack
      />

      {loading && !result ? <LoadingOverlay message="Loading report…" /> : null}

      <SmoothScrollView
        contentContainerStyle={{
          padding: 16,
          alignItems: 'center',
        }}
        contentPaddingBottom={scrollBottomPad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }>
        <ReportFilterBar
          filters={filters}
          onChange={setFilters}
          showDateFilter={supportsDateFilter(params.type)}
          showItemFilter={supportsItemFilter(params.type)}
        />

        {isDailySummary ? (
          <>
            {dailySalesLoading && !dailySalesReport ? (
              <LoadingOverlay message="Loading day's sales…" />
            ) : null}
            {dailySalesReport ? (
              <View style={{ width: '100%', maxWidth: 400 }} collapsable={false}>
                <BackendReportView
                  report={dailySalesReport}
                  header={header}
                  settings={settings}
                  reportType={params.type}
                />
              </View>
            ) : !dailySalesLoading && dailySalesError ? (
              <Box w="100%" maxWidth={400} px="$4" py="$8">
                <VStack alignItems="center" space="md">
                  <Text fontSize="$sm" color={colors.textSecondary} textAlign="center">
                    {dailySalesError}
                  </Text>
                </VStack>
              </Box>
            ) : null}
            <Box w="100%" maxWidth={400} gap="$2" mt="$4" mb="$2">
              <PrimaryButton
                label={exportingExcel === 'download' ? 'Saving…' : 'Download Excel'}
                variant="outline"
                onPress={() => handleExportExcel('download')}
                loading={exportingExcel === 'download'}
                disabled={exportingExcel != null}
              />
              <PrimaryButton
                label={exportingExcel === 'share' ? 'Sharing…' : 'Share Excel'}
                variant="outline"
                onPress={() => handleExportExcel('share')}
                loading={exportingExcel === 'share'}
                disabled={exportingExcel != null}
              />
            </Box>
          </>
        ) : result ? (
          <>
            <View style={{ width: '100%', maxWidth: 400 }} collapsable={false}>
              <ViewShot
                ref={reportShotRef}
                options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                style={{ backgroundColor: '#fff' }}>
                {result.source === 'dashboard' ? (
                  <SystemReportView report={result.report} settings={settings} />
                ) : (
                  <BackendReportView
                    report={result.report}
                    header={header}
                    settings={settings}
                    reportType={params.type}
                  />
                )}
              </ViewShot>
            </View>
            <Box w="100%" maxWidth={400} gap="$2" mt="$4" mb="$2">
              <PrimaryButton
                label={printing ? 'Printing…' : 'Print via Bluetooth'}
                onPress={handlePrint}
                loading={printing}
                disabled={!result}
              />
              {excelExportSupported ? (
                <>
                  <PrimaryButton
                    label={exportingExcel === 'download' ? 'Saving…' : 'Download Excel'}
                    variant="outline"
                    onPress={() => handleExportExcel('download')}
                    loading={exportingExcel === 'download'}
                    disabled={exportingExcel != null}
                  />
                  <PrimaryButton
                    label={exportingExcel === 'share' ? 'Sharing…' : 'Share Excel'}
                    variant="outline"
                    onPress={() => handleExportExcel('share')}
                    loading={exportingExcel === 'share'}
                    disabled={exportingExcel != null}
                  />
                </>
              ) : null}
            </Box>
          </>
        ) : !loading && !error ? (
          <Box w="100%" maxWidth={400} px="$4" py="$8">
            <VStack alignItems="center" space="md">
              <Text fontSize="$sm" color={colors.textSecondary} textAlign="center">
                No report data available.
              </Text>
            </VStack>
          </Box>
        ) : null}
      </SmoothScrollView>
    </ScreenContainer>
  );
};
