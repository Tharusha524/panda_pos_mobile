import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';

const HEADER_FILL = 'FFDCEEFB'; // light blue
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
};

export interface DayEndExcelRow {
  itemNumber: string | null;
  description: string;
  start: number;
  sold: number;
  remaining: number;
  /** Packets per bundle for THIS item (set on the item itself, since it
   * varies by item and can change over time) — null when not configured,
   * in which case Bundle is left blank rather than guessed. */
  packetsPerBundle: number | null;
}

/** Whole bundles + leftover packets, e.g. 265 packets at 20/bundle -> 13
 * bundles, 5 leftover packets — never a fractional bundle count. */
function splitBundlePkts(qty: number, perBundle: number | null): { bundle: number | string; pkts: number } {
  if (!perBundle || perBundle <= 0) {
    return { bundle: '—', pkts: qty };
  }
  return { bundle: Math.floor(qty / perBundle), pkts: qty % perBundle };
}

/** Day End Report Excel — Item No / Item, then Start / Sold / Left each
 * split into Bundle + Pkts sub-columns (two-row header), matching the
 * client's requested layout. A dedicated builder rather than the generic
 * flat-table exporter since it needs merged group headers. */
export async function buildDayEndReportWorkbookBase64(
  rows: DayEndExcelRow[],
  dateLabel: string,
  totals: { start: number; sold: number; remaining: number },
): Promise<{ base64: string; isEmpty: boolean }> {
  const totalCols = 8; // Item No, Item, Start Bundle, Start Pkts, Sold Bundle, Sold Pkts, Left Bundle, Left Pkts

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Day End Report');

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 20;
  for (let c = 3; c <= totalCols; c++) {
    ws.getColumn(c).width = 10;
  }

  // Title row
  const titleRow = ws.addRow([`Day End Report — ${dateLabel}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 13 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Header row 1 — group labels, merged across their Bundle/Pkts pair.
  const headerRow1 = ws.addRow(['Item No', 'Item', 'Start', '', 'Sold', '', 'Left', '']);
  const headerRow1Index = headerRow1.number;
  ws.mergeCells(headerRow1Index, 1, headerRow1Index + 1, 1);
  ws.mergeCells(headerRow1Index, 2, headerRow1Index + 1, 2);
  ws.mergeCells(headerRow1Index, 3, headerRow1Index, 4);
  ws.mergeCells(headerRow1Index, 5, headerRow1Index, 6);
  ws.mergeCells(headerRow1Index, 7, headerRow1Index, 8);

  // Header row 2 — Bundle/Pkts sub-labels under each group.
  const headerRow2 = ws.addRow(['', '', 'Bundle', 'Pkts', 'Bundle', 'Pkts', 'Bundle', 'Pkts']);

  for (const row of [headerRow1, headerRow2]) {
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    });
  }

  // Data rows
  for (const row of rows) {
    const start = splitBundlePkts(row.start, row.packetsPerBundle);
    const sold = splitBundlePkts(row.sold, row.packetsPerBundle);
    const remaining = splitBundlePkts(row.remaining, row.packetsPerBundle);
    ws.addRow([
      row.itemNumber ?? '',
      row.description,
      start.bundle,
      start.pkts,
      sold.bundle,
      sold.pkts,
      remaining.bundle,
      remaining.pkts,
    ]);
  }

  // Borders across header + data table.
  const lastDataRow = headerRow2.number + rows.length;
  for (let r = headerRow1Index; r <= lastDataRow; r++) {
    for (let c = 1; c <= totalCols; c++) {
      ws.getCell(r, c).border = THIN_BORDER;
    }
  }

  // Summary totals (plain packet totals — bundles aren't summed since
  // different items can have different bundle sizes).
  ws.addRow([]);
  const summaryRows = [
    ['Total start stock', totals.start],
    ['Total sold', totals.sold],
    ['Total remaining', totals.remaining],
  ];
  for (const [label, value] of summaryRows) {
    const line = ws.addRow([label, value]);
    line.getCell(1).font = { bold: true };
    line.getCell(2).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, isEmpty: rows.length === 0 };
}
