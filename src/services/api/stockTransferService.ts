import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/auth';
import type {
  StockTransferContext,
  StockTransferItemOption,
  StockTransferPayload,
  StockTransferResult,
  StockTransferSummaryRow,
} from '@/types/stockTransfer';

export const stockTransferService = {
  async context(): Promise<StockTransferContext> {
    const { data } = await apiClient.get<ApiSuccessResponse<StockTransferContext>>(
      '/stock-transfers/context',
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to load stock transfer context');
    }
    return data.data;
  },

  async search(
    query: string,
    fromLocation: string,
    toLocation?: string,
  ): Promise<StockTransferItemOption[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<StockTransferItemOption[]>>(
      '/stock-transfers/search',
      {
        params: {
          q: query || undefined,
          from_location: fromLocation,
          to_location: toLocation || undefined,
        },
      },
    );
    if (!data.success) {
      throw new Error(data.message ?? 'Failed to search items');
    }
    return data.data ?? [];
  },

  /** Qty transferred INTO `toLocation` per item over a date range — powers
   * the Day End Report's "Start" column (what was actually loaded onto the
   * lorry that day), instead of a derived Left+Sold guess. */
  async summary(
    toLocation: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<StockTransferSummaryRow[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<StockTransferSummaryRow[]>>(
      '/stock-transfers/summary',
      { params: { to_location: toLocation, date_from: dateFrom, date_to: dateTo } },
    );
    if (!data.success) {
      throw new Error(data.message ?? 'Failed to load stock transfer summary');
    }
    return data.data ?? [];
  },

  async transfer(payload: StockTransferPayload): Promise<StockTransferResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<StockTransferResult>>(
      '/stock-transfers',
      payload,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Stock transfer failed');
    }
    return data.data;
  },
};
