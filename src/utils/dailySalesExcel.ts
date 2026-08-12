import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import type { SalesSummarySale } from '@/types/backendReports';

interface PivotItemColumn {
  /** Item description, used both as the pivot key and the column header —
   * two lines with the same description are treated as the same column. */
  key: string;
}

interface PivotRow {
  customer: string;
  paymentMethod: string;
  total: number;
  perItem: Record<string, { qty: number; amount: number }>;
}

interface PivotResult {
  columns: PivotItemColumn[];
  rows: PivotRow[];
  totals: {
    perItem: Record<string, { qty: number; amount: number }>;
    grandTotal: number;
  };
}

const HEADER_FILL = 'FFDCEEFB'; // light blue
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
};

/** Pivots a day's sales into: one row per sale (as printed on that bill), one
 * Pcs/Total column pair per distinct item sold that day. Return transactions
 * are excluded — this mirrors the paper "Daily Sale Report" sheet, a
 * positive-sales view only. */
export function buildDailySalesPivot(sales: SalesSummarySale[]): PivotResult {
  const saleRows = sales.filter(s => s.transaction_label !== 'Return');

  const columns: PivotItemColumn[] = [];
  const seenColumns = new Set<string>();

  const rows: PivotRow[] = saleRows.map(sale => {
    const perItem: Record<string, { qty: number; amount: number }> = {};
    for (const item of sale.items) {
      const key = item.description?.trim() || item.item_number?.trim() || 'Item';
      if (!seenColumns.has(key)) {
        seenColumns.add(key);
        columns.push({ key });
      }
      const existing = perItem[key] ?? { qty: 0, amount: 0 };
      perItem[key] = {
        qty: existing.qty + item.qty,
        amount: existing.amount + item.amount,
      };
    }
    return {
      customer: sale.customer || 'Walk-in',
      paymentMethod: sale.payment_method || '—',
      total: sale.net_amount,
      perItem,
    };
  });

  const totals = {
    perItem: {} as Record<string, { qty: number; amount: number }>,
    grandTotal: 0,
  };
  for (const col of columns) {
    totals.perItem[col.key] = { qty: 0, amount: 0 };
  }
  for (const row of rows) {
    totals.grandTotal += row.total;
    for (const col of columns) {
      const cell = row.perItem[col.key];
      if (cell) {
        totals.perItem[col.key].qty += cell.qty;
        totals.perItem[col.key].amount += cell.amount;
      }
    }
  }

  return { columns, rows, totals };
}

/** Builds the .xlsx workbook for a day's sales pivot and returns it as a
 * base64 string, ready to write to a file. `isEmpty` is true when there were
 * no (non-return) sales that day — caller decides whether to still export an
 * empty sheet or show a message instead. */
export async function buildDailySalesWorkbookBase64(
  sales: SalesSummarySale[],
  dateLabel: string,
): Promise<{ base64: string; isEmpty: boolean }> {
  const { columns, rows, totals } = buildDailySalesPivot(sales);
  const totalCols = 1 + columns.length * 2 + 2; // Name + item pairs + Payment + Total

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Daily Sale Report');

  ws.getColumn(1).width = 18;
  columns.forEach((_, idx) => {
    ws.getColumn(2 + idx * 2).width = 8;
    ws.getColumn(3 + idx * 2).width = 10;
  });
  ws.getColumn(totalCols - 1).width = 14;
  ws.getColumn(totalCols).width = 12;

  // Title row
  const titleRow = ws.addRow([`Daily Sale Report — ${dateLabel}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Header rows (Name | <item> ... | Payment Method | Total, then Pcs/Total sub-labels)
  const headerRow1: (string | number)[] = ['Name'];
  const headerRow2: (string | number)[] = [''];
  for (const col of columns) {
    headerRow1.push(col.key, '');
    headerRow2.push('Pcs', 'Total');
  }
  headerRow1.push('Payment Method', 'Total');
  headerRow2.push('', '');

  const headerRowIndex1 = ws.addRow(headerRow1).number;
  const headerRowIndex2 = ws.addRow(headerRow2).number;

  columns.forEach((_, idx) => {
    const startCol = 2 + idx * 2;
    ws.mergeCells(headerRowIndex1, startCol, headerRowIndex1, startCol + 1);
  });
  ws.mergeCells(headerRowIndex1, totalCols - 1, headerRowIndex2, totalCols - 1);
  ws.mergeCells(headerRowIndex1, totalCols, headerRowIndex2, totalCols);
  ws.mergeCells(headerRowIndex1, 1, headerRowIndex2, 1);

  for (let r = headerRowIndex1; r <= headerRowIndex2; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    }
  }

  // Data rows
  for (const row of rows) {
    const line: (string | number)[] = [row.customer];
    for (const col of columns) {
      const cell = row.perItem[col.key];
      line.push(cell ? cell.qty : '', cell ? cell.amount : '');
    }
    line.push(row.paymentMethod, row.total);
    ws.addRow(line);
  }

  // Total row
  const totalLine: (string | number)[] = ['Total'];
  for (const col of columns) {
    const t = totals.perItem[col.key];
    totalLine.push(t.qty, t.amount);
  }
  totalLine.push('', totals.grandTotal);
  const totalRow = ws.addRow(totalLine);
  totalRow.eachCell({ includeEmpty: true }, cell => {
    cell.font = { bold: true };
  });

  // Borders across the whole table (title through the total row).
  const lastRow = headerRowIndex2 + rows.length + 1;
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(r, c);
      cell.border = THIN_BORDER;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, isEmpty: rows.length === 0 };
}
