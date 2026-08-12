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
import { ReportDatePickerField } from '@/components/inputs/ReportDatePickerField';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { useSystemReport } from '@/hooks/useSystemReport';
import { bluetoothPrintService } from '@/services/bluetooth/bluetoothPrintService';
import { reportService } from '@/services/api/reportService';
import { navigateToPrinterSetup } from '@/navigation/navigationRef';
import { getReportMeta } from '@/types/reports';
import type { ReportsStackParamList } from '@/navigation/types';
import type { BackendReportData } from '@/types/backendReports';
import { colors, shadows } from '@/theme';
import {
  defaultReportFilters,
  formatDateYmd,
  formatReportDateLabel,
  formatReportDateRangeLabel,
} from '@/utils/reportDateFilters';
import type { ReportFilterParams } from '@/types/reportFilters';
import { captureReceiptBase64 } from '@/utils/receiptImageShare';
import { supportsDateFilter, supportsItemFilter } from '@/constants/reportFilterCapabilities';
import { downloadDailySalesExcel, shareDailySalesExcel } from '@/utils/dailySalesFile';
import {
  buildPrintHeaderFromSettings as buildHeader,
  getReceiptPrintCustomization,
} from '@/utils/receiptPrintCustomization';

type Route = RouteProp<ReportsStackParamList, 'ReportView'>;

const isPrinterSetupError = (msg: string): boolean =>
  /no printer|not configured|settings/i.test(msg);

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

  // Daily Business Summary is otherwise fixed to "today" (see useSystemReport —
  // the dashboard API it uses takes no date param). This lets that one report
  // type pick any past day and see/export that day's sales, without touching
  // the existing today-only dashboard flow above.
  const isDailySummary = params.type === 'daily_summary';
  const today = useMemo(() => formatDateYmd(new Date()), []);
  const [salesReportDate, setSalesReportDate] = useState(today);
  const isPastDateSelected = isDailySummary && salesReportDate !== today;
  const [dailySalesReport, setDailySalesReport] = useState<BackendReportData | null>(null);
  const [dailySalesLoading, setDailySalesLoading] = useState(false);
  const [dailySalesError, setDailySalesError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState<'download' | 'share' | null>(null);

  useEffect(() => {
    if (!isDailySummary) {
      return;
    }
    let cancelled = false;
    setDailySalesLoading(true);
    setDailySalesError(null);
    reportService
      .fetch('sales-summary', { dateFrom: salesReportDate, dateTo: salesReportDate })
      .then(report => {
        if (!cancelled) {
          setDailySalesReport(report);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setDailySalesError(e instanceof Error ? e.message : 'Failed to load sales for this day');
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
  }, [isDailySummary, salesReportDate]);

  const handleExportExcel = async (action: 'download' | 'share') => {
    if (!dailySalesReport) {
      showError({
        title: 'Excel export',
        message: 'Sales for this day are still loading — try again in a moment.',
        variant: 'warning',
      });
      return;
    }
    setExportingExcel(action);
    try {
      const dateLabel = formatReportDateLabel(salesReportDate);
      if (action === 'download') {
        const message = await downloadDailySalesExcel(
          dailySalesReport.sales ?? [],
          salesReportDate,
          dateLabel,
        );
        showError({ title: 'Excel saved', message, variant: 'info', confirmLabel: 'OK' });
      } else {
        await shareDailySalesExcel(dailySalesReport.sales ?? [], salesReportDate, dateLabel);
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
    if (isPastDateSelected) {
      return formatReportDateLabel(salesReportDate);
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
    isPastDateSelected,
    meta?.subtitle,
    result,
    salesReportDate,
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
          <Box
            w="100%"
            maxWidth={400}
            bg={colors.white}
            borderRadius="$xl"
            borderWidth={1}
            borderColor={colors.border}
            p="$4"
            mb="$4"
            style={shadows.sm}>
            <ReportDatePickerField
              label="Report day"
              value={salesReportDate}
              onChange={setSalesReportDate}
            />
          </Box>
        ) : null}

        {isPastDateSelected ? (
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
              {isDailySummary ? (
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
