import type { SystemReportType } from '@/types/reports';
import type { ReportColumn } from '@/types/backendReports';

/**
 * Some backend reports return more columns than comfortably fit the receipt-width
 * table (~400px on screen, and the equivalent on thermal paper) — with every
 * column squeezed to equal width, text overlaps/truncates and becomes unreadable.
 * This trims those reports down to the columns that matter most for a quick
 * glance, in the given display order. Reports not listed here are unaffected —
 * every column the backend sends is still shown.
 */
const REPORT_COLUMN_ALLOWLIST: Partial<Record<SystemReportType, string[]>> = {
  // Sales report (backend key "sales-details"): Sale ID, Customer, Payment
  // method, Total (net amount) — dropping Date, Branch, Sub Total, Discount.
  sales_report: ['sales_id', 'customer', 'payment_method', 'net_amount'],
  // Customer report (backend key "customer-list"): Name, Route/Branch,
  // Balance, Phone — dropping Code, Email.
  customer_report: ['name', 'location', 'balance', 'phone'],
  // Item report (backend key "item-list"): Item code, Description, Category,
  // Quantity, Sell price — dropping Branch, Cost, Active.
  item_report: ['item_number', 'description', 'category', 'qty', 'selling_price'],
};

/** Filters (and reorders) report columns down to the curated allowlist for the
 * given report type. Reports without an allowlist entry are returned unchanged. */
export const filterReportColumns = (
  type: SystemReportType,
  columns: ReportColumn[],
): ReportColumn[] => {
  const keep = REPORT_COLUMN_ALLOWLIST[type];
  if (!keep) {
    return columns;
  }
  const byKey = new Map(columns.map(col => [col.key, col]));
  return keep
    .map(key => byKey.get(key))
    .filter((col): col is ReportColumn => Boolean(col));
};
