import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import type { BackendReportData } from '@/types/backendReports';

const HEADER_FILL = 'FFDCEEFB'; // light blue
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
};

/** Sheet tab names can't exceed 31 chars and can't contain \/?*[] — trims
 * a report title down to something Excel will actually accept. */
const safeSheetName = (title: string): string =>
  (title || 'Report').replace(/[\\/?*[\]]/g, ' ').slice(0, 31) || 'Report';

/** Builds a plain flat-table .xlsx (title row, one header row from
 * report.columns, one row per report.rows, summary totals at the bottom) —
 * for reports whose data is already a simple column/row table (Customer
 * Settlement, Return report, etc.), as opposed to the item-level pivot
 * Daily Sale Report / Sales Report use (see dailySalesExcel.ts). */
export async function buildReportTableWorkbookBase64(
  report: BackendReportData,
  dateLabel: string,
): Promise<{ base64: string; isEmpty: boolean }> {
  const columns = report.columns ?? [];
  const rows = report.rows ?? [];
  const totalCols = Math.max(columns.length, 1);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(safeSheetName(report.title));

  columns.forEach((_, idx) => {
    ws.getColumn(idx + 1).width = 20;
  });

  // Title row
  const titleRow = ws.addRow([`${report.title} — ${dateLabel}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Header row
  const headerRow = ws.addRow(columns.map(c => c.label));
  const headerRowIndex = headerRow.number;
  headerRow.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
  });

  // Data rows
  for (const row of rows) {
    ws.addRow(columns.map(c => row[c.key] ?? ''));
  }

  // Borders across the data table.
  const lastDataRow = headerRowIndex + rows.length;
  for (let r = 1; r <= lastDataRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(r, c).border = THIN_BORDER;
    }
  }

  // Summary totals below a blank spacer row.
  if (report.summary && report.summary.length > 0) {
    ws.addRow([]);
    for (const item of report.summary) {
      const line = ws.addRow([item.label, item.value]);
      line.getCell(1).font = { bold: true };
      line.getCell(2).font = { bold: true };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, isEmpty: rows.length === 0 };
}
