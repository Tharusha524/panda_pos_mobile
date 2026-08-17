import type { SystemReportType } from '@/types/reports';

/**
 * Which report types actually respect the Date range / Item filters, verified
 * against the backend query logic in ReportService.php. Reports not listed as
 * supporting a filter return live current-state snapshots (current balances,
 * current stock levels) or fixed "today" data, so that filter control is
 * hidden in the UI rather than shown as if it does something.
 */
const DATE_FILTER_UNSUPPORTED: ReadonlySet<SystemReportType> = new Set<SystemReportType>([
  'daily_summary', // fixed to today (dashboard API takes no date params)
  'customer_report', // live current balances, not date-scoped
  'item_report', // live current stock, not date-scoped
  'reorder', // live current stock, not date-scoped
  'customer_aging', // live current balances, not date-scoped
]);

const ITEM_FILTER_SUPPORTED: ReadonlySet<SystemReportType> = new Set<SystemReportType>([
  'sales_report',
  'return_report',
  'item_report',
  'reorder',
  'expiry_report',
]);

export const supportsDateFilter = (type: SystemReportType): boolean =>
  !DATE_FILTER_UNSUPPORTED.has(type);

export const supportsItemFilter = (type: SystemReportType): boolean =>
  ITEM_FILTER_SUPPORTED.has(type);

/** True if this report has at least one working filter control to show. */
export const hasAnyReportFilter = (type: SystemReportType): boolean =>
  supportsDateFilter(type) || supportsItemFilter(type);
