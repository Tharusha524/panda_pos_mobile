import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import type { SalesSummarySale } from '@/types/backendReports';

interface PivotItemColumn {
  /** Item description, used both as the pivot key and the column header —
   * two lines with the same description are treated as the same column. */
  key: string;
}

interface PivotRow {
  date: string;
  billNo: string;
  customer: string;
  route: string;
  /** Keyed by payment method — a plain sale has exactly one entry; a split
   * sale (payment_method 'Split') has one entry per method it used, so the
   * row's total is spread across more than one method column. */
  amountsByMethod: Record<string, number>;
  /** Blank unless this sale was paid by cheque — "/"-joined if a split sale
   * used more than one cheque. */
  chequeNumber: string;
  /** Blank unless a bank was recorded (cheque or bank transfer) — "/"-joined
   * if a split sale recorded more than one. */
  bankName: string;
  total: number;
  /** unitPrice is the per-unit price of the product on this sale, not a summed amount. */
  perItem: Record<string, { qty: number; unitPrice: number }>;
}

interface PivotResult {
  columns: PivotItemColumn[];
  /** Distinct payment methods used that day, in order of first appearance —
   * each becomes its own sub-column under the "Payment Method" header. */
  paymentMethods: string[];
  rows: PivotRow[];
  totals: {
    /** Only qty is meaningful to total across rows — unit price isn't summable. */
    perItem: Record<string, { qty: number }>;
    perPaymentMethod: Record<string, number>;
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
 * Pcs/Unit Price column pair per distinct item sold that day. By default,
 * Return transactions are excluded — this mirrors the paper "Daily Sale
 * Report" sheet, a positive-sales view only. Pass `includeReturns: true` for
 * the Return Report export, where the caller has already pre-filtered the
 * list down to only Return rows and excluding them again would zero it out. */
export function buildDailySalesPivot(
  sales: SalesSummarySale[],
  includeReturns: boolean = false,
): PivotResult {
  const saleRows = includeReturns
    ? sales
    : sales.filter(s => s.transaction_label !== 'Return');

  const columns: PivotItemColumn[] = [];
  const seenColumns = new Set<string>();
  const paymentMethods: string[] = [];
  const seenMethods = new Set<string>();

  const rows: PivotRow[] = saleRows.map(sale => {
    const perItem: Record<string, { qty: number; unitPrice: number }> = {};
    for (const item of sale.items) {
      const key = item.description?.trim() || item.item_number?.trim() || 'Item';
      if (!seenColumns.has(key)) {
        seenColumns.add(key);
        columns.push({ key });
      }
      const existing = perItem[key] ?? { qty: 0, unitPrice: 0 };
      perItem[key] = {
        qty: existing.qty + item.qty,
        // Same item can appear on more than one line in a sale (e.g. different
        // batches) — last price wins for display rather than summing prices.
        unitPrice: item.unit_price,
      };
    }
    const splits = sale.payment_splits ?? [];
    const amountsByMethod: Record<string, number> = {};
    let chequeNumber = sale.cheque_number?.trim() || '';
    let bankName = sale.bank_name?.trim() || '';

    if (splits.length > 0) {
      const chequeNumbers: string[] = [];
      const bankNames: string[] = [];
      for (const split of splits) {
        const method = split.payment_method?.trim() || '—';
        amountsByMethod[method] = (amountsByMethod[method] ?? 0) + split.amount;
        if (!seenMethods.has(method)) {
          seenMethods.add(method);
          paymentMethods.push(method);
        }
        if (split.cheque_number?.trim()) {
          chequeNumbers.push(split.cheque_number.trim());
        }
        if (split.bank_name?.trim()) {
          bankNames.push(split.bank_name.trim());
        }
      }
      chequeNumber = chequeNumbers.join(' / ');
      bankName = bankNames.join(' / ');
    } else {
      const paymentMethod = sale.payment_method?.trim() || '—';
      // A sale labeled "Split" but with no actual split rows is broken data
      // (saved before the split-payment save fix went live) — showing it as
      // its own "Split" column would be misleading. Leave it out of the
      // payment-method breakdown entirely; its Total column still shows the
      // right amount, just with no method attributed to it.
      if (!/^split$/i.test(paymentMethod)) {
        amountsByMethod[paymentMethod] = sale.net_amount;
        if (!seenMethods.has(paymentMethod)) {
          seenMethods.add(paymentMethod);
          paymentMethods.push(paymentMethod);
        }
      }
    }

    // sale.date is "dd-mm-yyyy HH:mm" — just the date portion here, the
    // sale's own time isn't meaningful to a per-bill Excel row.
    const dateOnly = sale.date?.split(' ')[0] ?? '';

    return {
      date: dateOnly,
      billNo: sale.sales_id ?? '',
      customer: sale.customer || 'Walk-in',
      route: sale.route?.trim() || '',
      amountsByMethod,
      chequeNumber,
      bankName,
      total: sale.net_amount,
      perItem,
    };
  });

  const totals = {
    perItem: {} as Record<string, { qty: number }>,
    perPaymentMethod: {} as Record<string, number>,
    grandTotal: 0,
  };
  for (const col of columns) {
    totals.perItem[col.key] = { qty: 0 };
  }
  for (const method of paymentMethods) {
    totals.perPaymentMethod[method] = 0;
  }
  for (const row of rows) {
    totals.grandTotal += row.total;
    for (const [method, amount] of Object.entries(row.amountsByMethod)) {
      totals.perPaymentMethod[method] = (totals.perPaymentMethod[method] ?? 0) + amount;
    }
    for (const col of columns) {
      const cell = row.perItem[col.key];
      if (cell) {
        totals.perItem[col.key].qty += cell.qty;
      }
    }
  }

  return { columns, paymentMethods, rows, totals };
}

/** Builds the .xlsx workbook for a day's sales pivot and returns it as a
 * base64 string, ready to write to a file. `isEmpty` is true when there were
 * no (non-return) sales that day — caller decides whether to still export an
 * empty sheet or show a message instead. */
export async function buildDailySalesWorkbookBase64(
  sales: SalesSummarySale[],
  dateLabel: string,
  title: string = 'Daily Sale Report',
  includeReturns: boolean = false,
): Promise<{ base64: string; isEmpty: boolean }> {
  const { columns, paymentMethods, rows, totals } = buildDailySalesPivot(sales, includeReturns);
  // Falls back to one placeholder column so the "Payment Method" header
  // still has something to merge across on an empty (no-sales) sheet.
  // Any cheque-type method is floated to the end of this list so its column
  // sits immediately next to the "Ch. Details" (Cheque Number/Bank Name)
  // columns that follow right after — otherwise they'd end up separated by
  // whichever other methods (Cash, Credit, ...) came first that day.
  const methodCols = (paymentMethods.length > 0 ? paymentMethods : ['Payment Method'])
    .slice()
    .sort((a, b) => (/cheque/i.test(a) ? 1 : 0) - (/cheque/i.test(b) ? 1 : 0));

  // Date + Bill No + Route + Name + item pairs + one column per payment
  // method + Cheque Number + Bank Name + Total
  const itemColsEnd = 4 + columns.length * 2;
  const paymentStart = itemColsEnd + 1;
  const paymentEnd = paymentStart + methodCols.length - 1;
  const chequeCol = paymentEnd + 1;
  const bankCol = chequeCol + 1;
  const totalCol = bankCol + 1;
  const totalCols = totalCol;

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(title);

  // Widened throughout — narrower values here previously clipped/wrapped
  // "Route", long customer names, cheque amounts (showing as ####) and
  // "Bank Name" in Excel.
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 26;
  // Item columns stay narrow on purpose — widening every one to fit its
  // full name on one line made the whole sheet unreasonably wide. Instead
  // the item name header wraps onto multiple lines within this narrow
  // width (see wrapText + the taller header row below), which keeps the
  // sheet compact while still showing the full name clearly.
  columns.forEach((_, idx) => {
    ws.getColumn(5 + idx * 2).width = 8;
    ws.getColumn(6 + idx * 2).width = 10;
  });
  methodCols.forEach((_, idx) => {
    ws.getColumn(paymentStart + idx).width = 16;
  });
  ws.getColumn(chequeCol).width = 16;
  ws.getColumn(bankCol).width = 22;
  ws.getColumn(totalCol).width = 14;
  // Total column only — shown as "10,000.00" instead of the plain number.
  ws.getColumn(totalCol).numFmt = '#,##0.00';

  // Title row
  const titleRow = ws.addRow([`${title} — ${dateLabel}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Header rows (Route | Name | <item> ... | Payment Method | Ch. Details |
  // Total, then Pcs/Unit Price / <method names> / Cheque Number/Bank Name
  // sub-labels underneath) — Payment Method gets one sub-column per method
  // actually used that day, same merged-header pattern each item column and
  // Ch. Details already use (title on top, sub-labels underneath).
  const headerRow1: (string | number)[] = ['Date', 'Bill No', 'Route', 'Name'];
  const headerRow2: (string | number)[] = ['', '', '', ''];
  for (const col of columns) {
    headerRow1.push(col.key, '');
    headerRow2.push('Pcs', 'Unit Price');
  }
  headerRow1.push('Payment Method');
  for (let i = 1; i < methodCols.length; i++) {
    headerRow1.push('');
  }
  headerRow2.push(...methodCols);
  headerRow1.push('Ch. Details', '', 'Total');
  headerRow2.push('Cheque Number', 'Bank Name', '');

  const headerRowIndex1 = ws.addRow(headerRow1).number;
  const headerRowIndex2 = ws.addRow(headerRow2).number;
  // Tall enough for a long item name (e.g. "SHEET 220 TOILET ROLLE") to
  // wrap onto several lines within its narrow column and still read
  // clearly, instead of Excel's default single-line height clipping it.
  ws.getRow(headerRowIndex1).height = 60;

  columns.forEach((_, idx) => {
    const startCol = 5 + idx * 2;
    ws.mergeCells(headerRowIndex1, startCol, headerRowIndex1, startCol + 1);
  });
  ws.mergeCells(headerRowIndex1, paymentStart, headerRowIndex1, paymentEnd);
  ws.mergeCells(headerRowIndex1, chequeCol, headerRowIndex1, bankCol);
  ws.mergeCells(headerRowIndex1, totalCol, headerRowIndex2, totalCol);
  ws.mergeCells(headerRowIndex1, 1, headerRowIndex2, 1);
  ws.mergeCells(headerRowIndex1, 2, headerRowIndex2, 2);
  ws.mergeCells(headerRowIndex1, 3, headerRowIndex2, 3);
  ws.mergeCells(headerRowIndex1, 4, headerRowIndex2, 4);

  for (let r = headerRowIndex1; r <= headerRowIndex2; r++) {
    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.font = { bold: true };
      // wrapText lets a long item name break across lines (at whole word
      // boundaries) within its narrow column instead of being clipped or
      // spilling over neighboring cells.
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = THIN_BORDER;
    }
  }

  // Data rows
  for (const row of rows) {
    const line: (string | number)[] = [row.date, row.billNo, row.route, row.customer];
    for (const col of columns) {
      const cell = row.perItem[col.key];
      line.push(cell ? cell.qty : '', cell ? cell.unitPrice : '');
    }
    for (const method of methodCols) {
      const amount = row.amountsByMethod[method];
      line.push(amount ? amount : '');
    }
    line.push(row.chequeNumber, row.bankName, row.total);
    ws.addRow(line);
  }

  // Total row
  const totalLine: (string | number)[] = ['', '', '', 'Total'];
  for (const col of columns) {
    const t = totals.perItem[col.key];
    // Unit price isn't summable across sales — leave that side of the total row blank.
    totalLine.push(t.qty, '');
  }
  for (const method of methodCols) {
    totalLine.push(totals.perPaymentMethod[method] ?? 0);
  }
  totalLine.push('', '', totals.grandTotal);
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
