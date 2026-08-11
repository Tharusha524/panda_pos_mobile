import type { PosMobileSettings } from '@/types/settings';
import type { PrintableReceipt } from '@/utils/receiptEscPos';
import type { SystemReportHeader } from '@/types/reports';
import { receiptPrintStorage } from '@/services/storage/receiptPrintStorage';
import {
  DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  type ReceiptPaperWidth,
  type ReceiptPrintCustomization,
} from '@/types/receiptPrint';

/** Shared company header info for anything printed that isn't a sale/purchase
 * receipt (reports, customer statements) — those pull header fields from their own
 * backend response instead. */
export const buildPrintHeaderFromSettings = (
  settings?: PosMobileSettings | null,
): SystemReportHeader => ({
  company_name: settings?.printHeader?.company_name ?? settings?.company?.name ?? undefined,
  address: settings?.printHeader?.address_line ?? settings?.company?.address ?? undefined,
  phone: settings?.printHeader?.phone ?? settings?.company?.phone ?? undefined,
  email: settings?.printHeader?.email ?? settings?.company?.email ?? undefined,
  tax_id: settings?.printHeader?.tax_id ?? settings?.company?.tax_id ?? undefined,
});

const paperWidthFromHardware = (hardware?: Record<string, unknown>): ReceiptPaperWidth => {
  const raw = hardware?.printing_paper_size;
  if (typeof raw === 'string' && /80/i.test(raw)) {
    return '80mm';
  }
  if (typeof raw === 'number' && raw >= 80) {
    return '80mm';
  }
  return '58mm';
};

export const lineWidthForPaper = (paper: ReceiptPaperWidth): number =>
  paper === '80mm' ? 48 : 32;

export const mergeReceiptPrintSettings = (
  settings?: PosMobileSettings | null,
  local?: ReceiptPrintCustomization | null,
): ReceiptPrintCustomization => {
  const hardware = (settings?.hardware ?? {}) as Record<string, unknown>;
  const base = { ...DEFAULT_RECEIPT_PRINT_CUSTOMIZATION, ...local };

  if (hardware.allow_logo_on_sales_receipt === false) {
    base.showLogo = false;
  }

  if (!local?.paperWidth && hardware.printing_paper_size) {
    base.paperWidth = paperWidthFromHardware(hardware);
  }

  const serverFooter = hardware.receipt_footer_message ?? hardware.footer_message;
  if (
    typeof serverFooter === 'string' &&
    serverFooter.trim() &&
    (!local?.footerMessage ||
      local.footerMessage === DEFAULT_RECEIPT_PRINT_CUSTOMIZATION.footerMessage)
  ) {
    base.footerMessage = serverFooter.trim();
  }

  // All printouts are center-aligned system-wide — not user-configurable, so this
  // always wins over any locally saved or server-provided alignment preference.
  base.headerAlign = 'center';
  base.bodyAlign = 'center';

  return base;
};

/** Local device customization merged with server settings — the same merge
 * bluetoothPrintService applies right before printing, exposed here so a screen
 * can check `printAsImage` up front (e.g. to decide whether to capture the
 * on-screen receipt preview before calling printReceipt). */
export const getReceiptPrintCustomization = async (
  settings?: PosMobileSettings | null,
): Promise<ReceiptPrintCustomization> => {
  const local = await receiptPrintStorage.get();
  return mergeReceiptPrintSettings(settings, local);
};

/** @deprecated Use resolveReceiptLogo from receiptLogoResolver */
export const resolveReceiptLogoUrl = (
  receipt: PrintableReceipt,
  settings?: PosMobileSettings | null,
): string | null => {
  const header = receipt.header as Record<string, string | undefined>;
  const printOpts =
    'sale' in receipt
      ? (receipt as { print_options?: Record<string, unknown> }).print_options
      : undefined;

  const url =
    (printOpts?.logo_url as string | undefined) ??
    header.logo_url ??
    settings?.printHeader?.logo_url ??
    settings?.company?.logo_url;

  if (!url?.trim()) {
    return null;
  }
  return url.trim();
};

export { resolveReceiptLogo } from '@/utils/receiptLogoResolver';
