import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Box, Text } from '@gluestack-ui/themed';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { BackendReportView } from '@/components/reports/BackendReportView';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { usePosSettings } from '@/context/PosSettingsContext';
import { reportService } from '@/services/api/reportService';
import { inventoryService } from '@/services/api/inventoryService';
import { bluetoothPrintService } from '@/services/bluetooth/bluetoothPrintService';
import { navigateToPrinterSetup } from '@/navigation/navigationRef';
import { downloadReportTableExcel, shareReportTableExcel } from '@/utils/reportTableFile';
import { captureReceiptBase64 } from '@/utils/receiptImageShare';
import {
  buildPrintHeaderFromSettings as buildHeader,
  getReceiptPrintCustomization,
} from '@/utils/receiptPrintCustomization';
import {
  formatDateYmd,
  formatReportDateLabel,
  formatReportDateRangeLabel,
} from '@/utils/reportDateFilters';
import type { ReportFilterParams } from '@/types/reportFilters';
import type { BackendReportData } from '@/types/backendReports';
import { colors } from '@/theme';

const isPrinterSetupError = (msg: string): boolean =>
  /no printer|not configured|settings/i.test(msg);

interface DayEndRow {
  key: string;
  itemNumber: string | null;
  description: string;
  sold: number;
  remaining: number;
  start: number;
}

const rowKey = (itemNumber: string | null | undefined, description: string | null | undefined): string =>
  (itemNumber?.trim() || description?.trim() || 'unknown').toUpperCase();

export const DayEndReportScreen: React.FC = () => {
  const { showError, showConfirm } = useErrorDialog();
  const { settings, currency } = usePosSettings();
  const header = useMemo(() => buildHeader(settings), [settings]);
  const [printing, setPrinting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState<'download' | 'share' | null>(null);
  const reportShotRef = useRef<ViewShotRef>(null);
  const today = formatDateYmd(new Date());
  const [filters, setFilters] = useState<ReportFilterParams>({
    dateFrom: today,
    dateTo: today,
    itemId: null,
    itemLabel: null,
    location: 'all',
  });

  const [rows, setRows] = useState<DayEndRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [salesReport, inventory] = await Promise.all([
          reportService.fetch('sales-summary', {
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            location: filters.location,
          }),
          inventoryService.list({
            location: filters.location !== 'all' ? filters.location : undefined,
          }),
        ]);
        if (cancelled) return;

        const soldByKey = new Map<string, { itemNumber: string | null; description: string; qty: number }>();
        for (const sale of salesReport.sales ?? []) {
          if (sale.transaction_label === 'Return') {
            continue;
          }
          for (const line of sale.items ?? []) {
            const key = rowKey(line.item_number, line.description);
            const existing = soldByKey.get(key);
            if (existing) {
              existing.qty += line.qty;
            } else {
              soldByKey.set(key, {
                itemNumber: line.item_number,
                description: line.description?.trim() || 'Unnamed item',
                qty: line.qty,
              });
            }
          }
        }

        const remainingByKey = new Map<string, { itemNumber: string | null; description: string; qty: number }>();
        for (const item of inventory.items ?? []) {
          const key = rowKey(item.item_number, item.description);
          remainingByKey.set(key, {
            itemNumber: item.item_number ?? null,
            description: item.description?.trim() || 'Unnamed item',
            qty: item.qty ?? 0,
          });
        }

        const allKeys = new Set<string>([...soldByKey.keys(), ...remainingByKey.keys()]);
        const built: DayEndRow[] = Array.from(allKeys).map(key => {
          const sold = soldByKey.get(key)?.qty ?? 0;
          const remaining = remainingByKey.get(key)?.qty ?? 0;
          const description =
            remainingByKey.get(key)?.description ?? soldByKey.get(key)?.description ?? 'Unnamed item';
          const itemNumber = remainingByKey.get(key)?.itemNumber ?? soldByKey.get(key)?.itemNumber ?? null;
          return {
            key,
            itemNumber,
            description,
            sold,
            remaining,
            // Start stock = whatever's left now plus whatever was sold today —
            // derived rather than pulled from a separate transfer history, so
            // it always balances (Start − Sold = Remaining) regardless of how
            // many times the lorry was loaded that day.
            start: remaining + sold,
          };
        });

        built.sort((a, b) => a.description.localeCompare(b.description));
        setRows(built);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load day end report');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.dateFrom, filters.dateTo, filters.location, reloadToken]);

  useEffect(() => {
    if (error) {
      showError({ title: 'Day End Report unavailable', message: error });
    }
  }, [error, showError]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          start: acc.start + row.start,
          sold: acc.sold + row.sold,
          remaining: acc.remaining + row.remaining,
        }),
        { start: 0, sold: 0, remaining: 0 },
      ),
    [rows],
  );

  const subtitle =
    filters.dateFrom === filters.dateTo
      ? formatReportDateLabel(filters.dateFrom)
      : `${formatReportDateLabel(filters.dateFrom)} — ${formatReportDateLabel(filters.dateTo)}`;

  // Print/Excel reuse the same flat-table report shape the other report
  // pages use (BackendReportView / reportTableFile), built here from the
  // rows already computed above instead of a second backend round trip.
  const reportData: BackendReportData = useMemo(
    () => ({
      title: 'Day End Report',
      generated_at: new Date().toISOString(),
      filters: {
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        branch_id: null,
        branch_name: filters.location === 'all' ? 'All branches' : filters.location,
      },
      summary: [
        { label: 'Total start stock', value: totals.start },
        { label: 'Total sold', value: totals.sold },
        { label: 'Total remaining', value: totals.remaining },
      ],
      columns: [
        { key: 'item_number', label: 'Item No' },
        { key: 'description', label: 'Item' },
        { key: 'start', label: 'Start' },
        { key: 'sold', label: 'Sold' },
        { key: 'remaining', label: 'Left' },
      ],
      rows: rows.map(row => ({
        item_number: row.itemNumber ?? '',
        description: row.description,
        start: row.start,
        sold: row.sold,
        remaining: row.remaining,
      })),
    }),
    [rows, totals, filters.dateFrom, filters.dateTo, filters.location],
  );

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
    if (rows.length === 0) {
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
        // Couldn't read the setting or capture the preview — fall back to
        // the normal text report below instead of blocking the print.
      }
      await bluetoothPrintService.printBackendReport(
        reportData,
        header,
        currency,
        settings,
        capturedImageBase64,
      );
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

  const handleExportExcel = async (action: 'download' | 'share') => {
    const dateKey = `${filters.dateFrom}_to_${filters.dateTo}`;
    const dateLabel = formatReportDateRangeLabel(filters.dateFrom, filters.dateTo);
    setExportingExcel(action);
    try {
      if (action === 'download') {
        const message = await downloadReportTableExcel(reportData, dateKey, dateLabel);
        showError({ title: 'Excel saved', message, variant: 'info', confirmLabel: 'OK' });
      } else {
        await shareReportTableExcel(reportData, dateKey, dateLabel);
      }
    } catch (e) {
      showError({
        title: 'Excel export',
        message: e instanceof Error ? e.message : 'Could not export the Excel report',
      });
    } finally {
      setExportingExcel(null);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Day End Report" subtitle={subtitle} showBack />

      {loading && rows.length === 0 ? <LoadingOverlay message="Loading day end report…" /> : null}

      <SmoothScrollView
        contentContainerStyle={{ padding: 16, alignItems: 'center' }}
        contentPaddingBottom={32}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setReloadToken(t => t + 1);
            }}
            tintColor={colors.primary}
          />
        }>
        <ReportFilterBar filters={filters} onChange={setFilters} showItemFilter={false} />

        <Box w="100%" maxWidth={480}>
          {rows.length === 0 && !loading ? (
            <Box bg={colors.white} borderRadius="$xl" borderWidth={1} borderColor={colors.border} px="$4" py="$8" mt="$3">
              <Text textAlign="center" color={colors.textMuted}>
                No stock or sales for this selection.
              </Text>
            </Box>
          ) : rows.length > 0 ? (
            <View collapsable={false}>
              <ViewShot
                ref={reportShotRef}
                options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                style={{ backgroundColor: '#fff' }}>
                <BackendReportView report={reportData} header={header} settings={settings} />
              </ViewShot>
            </View>
          ) : null}

          <Text size="xs" color={colors.textMuted} mt="$3" px="$1">
            Start stock is derived (Left + Sold) for the selected date, so it always balances even if the
            lorry was loaded more than once that day.
          </Text>

          {rows.length > 0 ? (
            <Box gap="$2" mt="$4" mb="$2">
              <PrimaryButton
                label={printing ? 'Printing…' : 'Print via Bluetooth'}
                onPress={handlePrint}
                loading={printing}
                disabled={printing}
              />
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
          ) : null}
        </Box>
      </SmoothScrollView>
    </ScreenContainer>
  );
};
