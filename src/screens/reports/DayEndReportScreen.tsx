import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Box, HStack, Text, VStack } from '@gluestack-ui/themed';
import { SmoothScrollView } from '@/components/common/SmoothScrollView';
import { ScreenContainer } from '@/components/common/ScreenContainer';
import { AppHeader } from '@/components/common/AppHeader';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { useErrorDialog } from '@/context/ErrorDialogContext';
import { reportService } from '@/services/api/reportService';
import { inventoryService } from '@/services/api/inventoryService';
import { formatDateYmd, formatReportDateLabel } from '@/utils/reportDateFilters';
import type { ReportFilterParams } from '@/types/reportFilters';
import { colors, typography } from '@/theme';

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
  const { showError } = useErrorDialog();
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
          <Box
            bg={colors.white}
            borderRadius="$xl"
            borderWidth={1}
            borderColor={colors.border}
            overflow="hidden"
            mt="$3">
            <HStack bg={colors.backgroundAlt} px="$3" py="$2" borderBottomWidth={1} borderColor={colors.border}>
              <Text style={[typography.label, styles.colItem]} color={colors.textSecondary}>
                Item
              </Text>
              <Text style={[typography.label, styles.colNum]} color={colors.textSecondary}>
                Start
              </Text>
              <Text style={[typography.label, styles.colNum]} color={colors.textSecondary}>
                Sold
              </Text>
              <Text style={[typography.label, styles.colNum]} color={colors.textSecondary}>
                Left
              </Text>
            </HStack>

            {rows.length === 0 && !loading ? (
              <Box px="$4" py="$8">
                <Text textAlign="center" color={colors.textMuted}>
                  No stock or sales for this selection.
                </Text>
              </Box>
            ) : (
              rows.map(row => (
                <HStack
                  key={row.key}
                  px="$3"
                  py="$2.5"
                  borderBottomWidth={1}
                  borderColor={colors.border}>
                  <VStack style={styles.colItem}>
                    <Text fontWeight="$semibold" color={colors.text} numberOfLines={1}>
                      {row.description}
                    </Text>
                    {row.itemNumber ? (
                      <Text size="xs" color={colors.textMuted}>
                        {row.itemNumber}
                      </Text>
                    ) : null}
                  </VStack>
                  <Text style={styles.colNum} color={colors.text}>
                    {row.start}
                  </Text>
                  <Text style={styles.colNum} color={colors.text}>
                    {row.sold}
                  </Text>
                  <Text style={styles.colNum} color={colors.text} fontWeight="$semibold">
                    {row.remaining}
                  </Text>
                </HStack>
              ))
            )}

            {rows.length > 0 ? (
              <HStack bg={colors.backgroundAlt} px="$3" py="$2.5">
                <Text style={[typography.label, styles.colItem]} color={colors.text}>
                  Total
                </Text>
                <Text style={styles.colNum} fontWeight="$bold" color={colors.text}>
                  {totals.start}
                </Text>
                <Text style={styles.colNum} fontWeight="$bold" color={colors.text}>
                  {totals.sold}
                </Text>
                <Text style={styles.colNum} fontWeight="$bold" color={colors.text}>
                  {totals.remaining}
                </Text>
              </HStack>
            ) : null}
          </Box>

          <Text size="xs" color={colors.textMuted} mt="$3" px="$1">
            Start stock is derived (Left + Sold) for the selected date, so it always balances even if the
            lorry was loaded more than once that day.
          </Text>
        </Box>
      </SmoothScrollView>
    </ScreenContainer>
  );
};

const styles = {
  colItem: { flex: 2 },
  colNum: { flex: 1, textAlign: 'right' as const },
};
