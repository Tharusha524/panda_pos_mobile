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

export const escTitleLine = (ctx: ReceiptLayoutContext, text: string): string =>
  `${titleOpen[ctx.customization.titleFont]}${text}\n`;

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
