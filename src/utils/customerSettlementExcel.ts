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

/** Row shape customerSettlement() on the backend returns — a superset of the
 * on-screen columns (route/cheque_number/bank_name are Excel-only). */
interface SettlementRow {
  customer: string;
  bill_number: string | null;
  payment_method: string | null;
  amount_received: number;
  cheque_number?: string | null;
  bank_name?: string | null;
  route?: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Customer Settlement Excel — one amount column per payment method actually
 * used (Cash/Cheque first if present, then any others alphabetically), a
 * cheque's number/bank shown in their own columns, and a totals row per
 * method. Distinct from the generic flat-table exporter (reportTableExcel)
 * other reports use — this one needs the per-method pivot layout the client
 * asked for by name. */
export async function buildCustomerSettlementWorkbookBase64(
  report: BackendReportData,
  dateLabel: string,
): Promise<{ base64: string; isEmpty: boolean }> {
  const rows = (report.rows ?? []) as unknown as SettlementRow[];

  const methodsPresent = Array.from(
    new Set(rows.map(r => (r.payment_method?.trim() || 'Other'))),
  );
  const priority = ['Cash', 'Cheque'];
  const methods = [
    ...priority.filter(m => methodsPresent.includes(m)),
    ...methodsPresent.filter(m => !priority.includes(m)).sort(),
  ];
  const hasCheque = methods.includes('Cheque');

  const columns = [
    'Route',
    'Customer Name',
    'Bill No',
    ...methods,
    ...(hasCheque ? ['Ch.No', 'Bank'] : []),
  ];
  const totalCols = columns.length;

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Customer Settlement');

  columns.forEach((_, idx) => {
    ws.getColumn(idx + 1).width = 18;
  });

  // Title row
  const titleRow = ws.addRow([`Customer Settlement — ${dateLabel}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Header row
  const headerRow = ws.addRow(columns);
  headerRow.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  const headerRowIndex = headerRow.number;

  // Data rows — one amount cell filled per row, under whichever method it used.
  const methodTotals: Record<string, number> = {};
  methods.forEach(m => {
    methodTotals[m] = 0;
  });

  for (const row of rows) {
    const method = row.payment_method?.trim() || 'Other';
    const values: (string | number)[] = [row.route ?? '', row.customer, row.bill_number ?? ''];
    for (const m of methods) {
      values.push(m === method ? row.amount_received : '');
    }
    if (hasCheque) {
      values.push(method === 'Cheque' ? (row.cheque_number ?? '') : '');
      values.push(method === 'Cheque' ? (row.bank_name ?? '') : '');
    }
    ws.addRow(values);
    methodTotals[method] = round2((methodTotals[method] ?? 0) + row.amount_received);
  }

  // Totals row — per method, matching the client's example layout.
  const totalValues: (string | number)[] = ['', '', 'Total'];
  for (const m of methods) {
    totalValues.push(methodTotals[m] ?? 0);
  }
  if (hasCheque) {
    totalValues.push('', '');
  }
  const totalRow = ws.addRow(totalValues);
  totalRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true };
  });

  // Borders across header + data + total.
  const lastRow = headerRowIndex + rows.length + 1;
  for (let r = headerRowIndex; r <= lastRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(r, c).border = THIN_BORDER;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, isEmpty: rows.length === 0 };
}
