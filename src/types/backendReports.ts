export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSummaryItem {
  label: string;
  value: string | number;
}

export interface ReportFilters {
  date_from: string;
  date_to: string;
  branch_id: number | null;
  branch_name: string;
  item_id?: number | null;
  item_name?: string | null;
}

export interface SalesSummaryLineItem {
  item_number: string | null;
  description: string | null;
  qty: number;
  unit_price: number;
  discount: number;
  net_price: number;
  amount: number;
}

export interface SalesSummaryPaymentSplit {
  payment_method: string;
  amount: number;
  cheque_number?: string | null;
  bank_name?: string | null;
}

export interface SalesSummarySale {
  id: number;
  date: string;
  sales_id: string | null;
  customer: string;
  route?: string | null;
  location: string | null;
  transaction_label: string;
  sub_total: number;
  discount: number;
  net_amount: number;
  payment_method: string | null;
  cheque_number?: string | null;
  bank_name?: string | null;
  /** Present only when payment_method is 'Split' — part cash, part cheque,
   * part credit, etc. on this one sale. */
  payment_splits?: SalesSummaryPaymentSplit[];
  items: SalesSummaryLineItem[];
}

export interface BackendReportData {
  title: string;
  generated_at: string;
  filters: ReportFilters;
  summary: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  note?: string | null;
  layout?: 'table' | 'sales_summary';
  sales?: SalesSummarySale[];
}

export interface FetchReportParams {
  dateFrom: string;
  dateTo: string;
  location?: string | null;
  branchId?: string | number | null;
  itemId?: number | null;
}
