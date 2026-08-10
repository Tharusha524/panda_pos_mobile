import type {
  ReceiptPrintCustomization,
  ReceiptTextAlign,
  ReceiptTitleFont,
} from '@/types/receiptPrint';
import { lineWidthForPaper } from '@/utils/receiptPrintCustomization';

export type ReceiptLayoutContext = {
  lineWidth: number;
  customization: ReceiptPrintCustomization;
};

export const createReceiptLayout = (
  customization: ReceiptPrintCustomization,
): ReceiptLayoutContext => ({
  lineWidth: lineWidthForPaper(customization.paperWidth),
  customization,
});

const alignOpen: Record<ReceiptTextAlign, string> = {
  left: '<L>',
  center: '<C>',
  right: '<R>',
};

const titleOpen: Record<ReceiptTitleFont, string> = {
  normal: '<C>',
  large: '<CD>',
  bold: '<CB>',
  // Normally rendered as an image (see receiptTitleImageStorage) and this tag is
  // never used — kept only as a safe text fallback if that image is unavailable.
  custom: '<C>',
};

const padLine = (left: string, right: string, width: number): string => {
  const gap = width - left.length - right.length;
  if (gap <= 0) {
    return `${left.slice(0, width - right.length - 1)} ${right}`;
  }
  return `${left}${' '.repeat(gap)}${right}`;
};

const plainCenter = (text: string, width: number): string => {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const pad = Math.floor((width - text.length) / 2);
  return `${' '.repeat(pad)}${text}`;
};

export const escLine = (
  ctx: ReceiptLayoutContext,
  text: string,
  align: ReceiptTextAlign = ctx.customization.bodyAlign,
): string => `${alignOpen[align]}${text}\n`;

export const escHeaderLine = (
  ctx: ReceiptLayoutContext,
  text: string,
): string => escLine(ctx, text, ctx.customization.headerAlign);

// Breaks text into lines no longer than `width`, splitting only on spaces so
// words are never cut mid-way — falls back to the whole string if it's short
// enough or has no spaces to break on.
const wrapWords = (text: string, width: number): string[] => {
  if (width <= 0 || text.length <= width) {
    return [text];
  }
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [text];
};

export const escTitleLine = (ctx: ReceiptLayoutContext, text: string): string => {
  if (ctx.customization.titleFont === 'large') {
    // Double-width printing halves the usable columns per line, so wrap on
    // word boundaries at half the paper width — otherwise long company names
    // overflow the printer's own line buffer and get cut mid-word instead of
    // centering cleanly.
    const width = Math.max(1, Math.floor(ctx.lineWidth / 2));
    const wrapped = wrapWords(text, width);
    // No leading sacrificial blank line here anymore — that only relocated a
    // printer "first command" glitch onto its own visible line instead of
    // actually hiding it. The warm-up byte glued onto the front of the raw
    // write (see WARM_UP_BYTE_BASE64 in bluetoothPrintService.ts) absorbs it
    // invisibly instead, so this can go straight to the real title line.
    return wrapped.map(line => `${titleOpen.large}${line}\n`).join('');
  }
  return `${titleOpen[ctx.customization.titleFont]}${text}\n`;
};

export const escDivider = (ctx: ReceiptLayoutContext, char = '-'): string =>
  escLine(ctx, char.repeat(ctx.lineWidth), ctx.customization.bodyAlign);

export const escPadLine = (ctx: ReceiptLayoutContext, left: string, right: string): string =>
  escLine(ctx, padLine(left, right, ctx.lineWidth), 'left');

export type TableColumn = {
  text: string;
  width: number;
  align?: 'left' | 'right';
};

/** Fixed-width multi-column row (e.g. Item Name / Qty / Price / Amount), single space between columns. */
export const escTableRow = (ctx: ReceiptLayoutContext, columns: TableColumn[]): string => {
  const parts = columns.map(col => {
    const text = col.text.length > col.width ? col.text.slice(0, col.width) : col.text;
    const pad = ' '.repeat(col.width - text.length);
    return col.align === 'right' ? pad + text : text + pad;
  });
  return escLine(ctx, parts.join(' '), 'left');
};

// Some locales format times with a narrow no-break space (U+202F) or similar before
// AM/PM, which thermal printer fonts can't render (prints as "?"). Collapse any
// non-ASCII whitespace down to a plain space so the printout stays clean.
export const sanitizeForPrint = (text: string): string => text.replace(/[^\S\r\n]/g, ' ');

/** Visible preview for customize screen (no ESC/POS tags). */
export const previewLine = (
  ctx: ReceiptLayoutContext,
  text: string,
  align: ReceiptTextAlign = ctx.customization.headerAlign,
): string => {
  if (align === 'center') {
    return plainCenter(text, ctx.lineWidth);
  }
  if (align === 'right') {
    const pad = Math.max(0, ctx.lineWidth - text.length);
    return `${' '.repeat(pad)}${text}`.slice(-ctx.lineWidth);
  }
  return text.slice(0, ctx.lineWidth);
};
