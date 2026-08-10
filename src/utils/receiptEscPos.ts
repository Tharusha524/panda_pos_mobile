import {
  DEFAULT_RECEIPT_STORE_NAME,
  PURCHASE_RECEIPT_TITLE,
  RECEIPT_SOFTWARE_PROVIDER,
  RECEIPT_SOFTWARE_WEBSITE,
  getSaleReceiptTitle,
} from '@/constants/receiptBranding';
import type { SaleReceiptPayload } from '@/types/sales';
import type { PurchaseReceiptPayload } from '@/types/inventory';
import type { PosMobileSettings } from '@/types/settings';
import type { ReceiptPrintCustomization } from '@/types/receiptPrint';
import {
  resolveCurrencyCode,
  formatPrintAmount,
  formatPlainAmount,
  getCurrencyLabel,
} from '@/utils/format';
import { formatQtyWithUom, formatReceiptQtyDetail, resolveLineUom } from '@/utils/uom';
import { mergeReceiptPrintSettings } from '@/utils/receiptPrintCustomization';
import {
  createReceiptLayout,
  escDivider,
  escHeaderLine,
  escLine,
  escPadLine,
  escTableRow,
  escTitleLine,
  sanitizeForPrint,
  type ReceiptLayoutContext,
} from '@/utils/receiptEscPosLayout';

export type PrintableReceipt = SaleReceiptPayload | PurchaseReceiptPayload;

export type BuildEscPosOptions = {
  currency?: string | null;
  customization?: ReceiptPrintCustomization | null;
  settings?: PosMobileSettings | null;
  /** Logged-in user's name — printed on the "Cashier" line. */
  cashierName?: string | null;
  /** Customer's total amount owed across all sales (not just this one) — separate
   * from "Balance", which is just this transaction's change due. Only printed when
   * the sale has a customer and this is provided. */
  customerOutstandingBalance?: number | null;
  /** True when a custom-size company-name image was printed separately just before
   * this text body — skips the plain-text title line so the name doesn't print twice.
   * Defaults to false (unchanged behavior) when omitted. */
  skipTitleText?: boolean;
};

// Item-table columns (Item Name / Qty / Price / Amount) only fit as one line on wider
// paper (80mm-ish, 48 chars). Narrower 58mm mini paper falls back to the older
// two-line-per-item layout instead of cramming 4 columns into 32 chars.
const WIDE_TABLE_MIN_WIDTH = 44;
const ITEM_TABLE_COLUMNS = { name: 18, qty: 9, price: 8, amount: 10 } as const;

const wrapDesc = (ctx: ReceiptLayoutContext, text: string): string => {
  const w = ctx.lineWidth;
  return text.length > w ? text.slice(0, w - 1) + '…' : text;
};

export const buildEscPosReceipt = (
  receipt: SaleReceiptPayload,
  options?: BuildEscPosOptions,
): string => {
  const customization = mergeReceiptPrintSettings(
    options?.settings,
    options?.customization,
  );
  const ctx = createReceiptLayout(customization);
  const sale = receipt.sale;
  const header = receipt.header as Record<string, string | undefined>;
  const lines: string[] = [];

  const isReturn = Boolean((sale as { is_return?: boolean }).is_return);
  const isHold =
    (sale as { is_hold?: boolean }).is_hold ||
    (sale as { order_status?: string }).order_status === 'hold';

  // Header — company name, address, phone, plus email/tax id/registration
  // (matching the on-screen receipt preview) when present and enabled.
  const company = header.company_name ?? DEFAULT_RECEIPT_STORE_NAME;
  if (!options?.skipTitleText) {
    lines.push(escTitleLine(ctx, company));
  }
  if (header.address_line ?? header.address) {
    lines.push(escHeaderLine(ctx, String(header.address_line ?? header.address)));
  }
  if (customization.showPhone && header.phone) {
    lines.push(escHeaderLine(ctx, `Tel: ${header.phone}`));
  }
  if (customization.showEmail && header.email) {
    lines.push(escHeaderLine(ctx, String(header.email)));
  }
  if (customization.showTaxId && header.tax_id) {
    lines.push(escHeaderLine(ctx, `Tax ID: ${header.tax_id}`));
  }
  if (customization.showRegistration && header.registration_number) {
    lines.push(escHeaderLine(ctx, `Reg: ${header.registration_number}`));
  }

  lines.push(escDivider(ctx));

  // Bill title — "SALES RECEIPT" / "HOLD ORDER" / "SALES RETURN", matching the
  // on-screen receipt preview's bold heading (previously only shown for hold/return).
  lines.push(escHeaderLine(ctx, getSaleReceiptTitle({ isHold, isReturn })));
  if (isHold) {
    lines.push(escHeaderLine(ctx, 'NOT PAID — Complete to finalize'));
  }
  const currencyLabel = getCurrencyLabel(
    options?.currency ?? options?.settings?.company?.currency,
  );
  lines.push(escHeaderLine(ctx, `All amounts in ${currencyLabel}`));
  lines.push(escDivider(ctx));

  // Date / Time / Branch / Cashier / Sales receipt # — ledger rows (unaffected by
  // center alignment), matching the rest of the totals-style content below.
  const timeStr = sanitizeForPrint(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );
  lines.push(escPadLine(ctx, sale.sale_date, timeStr));
  if (sale.location) {
    lines.push(escPadLine(ctx, 'Branch', sale.location.slice(0, 18)));
  }
  if (options?.cashierName?.trim()) {
    lines.push(escPadLine(ctx, 'Cashier', options.cashierName.trim().slice(0, 18)));
  }
  lines.push(
    escPadLine(
      ctx,
      isReturn ? 'Return receipt #' : isHold ? 'Hold receipt #' : 'Sales receipt #',
      sale.sales_id,
    ),
  );
  lines.push(escDivider(ctx));

  // Item table — full single-line columns on wide paper, two-line fallback on
  // narrow 58mm mini paper where 4 columns can't fit legibly.
  const isWideTable = ctx.lineWidth >= WIDE_TABLE_MIN_WIDTH;
  if (isWideTable) {
    const c = ITEM_TABLE_COLUMNS;
    lines.push(
      escTableRow(ctx, [
        { text: 'Item Name', width: c.name },
        { text: 'Qty', width: c.qty, align: 'right' },
        { text: 'Price', width: c.price, align: 'right' },
        { text: 'Amount', width: c.amount, align: 'right' },
      ]),
    );
    lines.push(escDivider(ctx));
    for (const line of sale.lines) {
      lines.push(
        escTableRow(ctx, [
          { text: line.description, width: c.name },
          { text: formatQtyWithUom(line.qty, line.uom), width: c.qty, align: 'right' },
          { text: formatPlainAmount(line.unit_price), width: c.price, align: 'right' },
          { text: formatPlainAmount(line.line_total), width: c.amount, align: 'right' },
        ]),
      );
    }
  } else {
    lines.push(escPadLine(ctx, 'Item', 'Amount'));
    lines.push(escLine(ctx, '.'.repeat(ctx.lineWidth), 'left'));
    for (const line of sale.lines) {
      const desc = wrapDesc(ctx, line.description);
      const uom = resolveLineUom(line.uom);
      if (line.item_number) {
        lines.push(escLine(ctx, `ID ${line.item_number}`));
      }
      lines.push(escLine(ctx, desc));
      const detail = formatReceiptQtyDetail(line.qty, formatPlainAmount(line.unit_price), uom);
      lines.push(escPadLine(ctx, detail, formatPlainAmount(line.line_total)));
    }
  }

  lines.push(escDivider(ctx));
  lines.push(escPadLine(ctx, 'Subtotal', formatPlainAmount(sale.sub_total)));
  if (sale.discount > 0) {
    const baseLabel =
      (sale as { discount_label?: string | null }).discount_label?.trim() || 'Discount';
    const pct = (sale as { discount_percent?: number | null }).discount_percent;
    const discountLabel =
      pct != null && pct > 0 ? `${baseLabel} (${pct}%)` : baseLabel;
    lines.push(escPadLine(ctx, discountLabel, `-${formatPlainAmount(sale.discount)}`));
  }
  if ((sale.service_charge ?? 0) > 0) {
    lines.push(escPadLine(ctx, 'Service charge', formatPlainAmount(sale.service_charge ?? 0)));
  }
  lines.push(escDivider(ctx));
  lines.push(escPadLine(ctx, isHold ? 'Amount due' : 'Total', formatPlainAmount(sale.net_amount)));
  lines.push(escDivider(ctx, '='));

  // 'left' explicitly — these sit among left-anchored ledger rows (Received/Balance,
  // Name/Phone No/Address), so they must not fall back to the general center-align rule.
  lines.push(escLine(ctx, `Paid By ${sale.payment_method ?? 'Cash'}`, 'left'));
  if (!isHold && sale.amount_received != null) {
    lines.push(escPadLine(ctx, 'Received', formatPlainAmount(sale.amount_received)));
    const change = sale.amount_received - sale.net_amount;
    if (change >= 0) {
      lines.push(escPadLine(ctx, 'Balance', formatPlainAmount(change)));
    }
  }
  // Customer's total amount owed overall — distinct from "Balance" above, which is
  // just this transaction's change due. Only shown when the caller resolved and
  // supplied a real customer's current balance (see printReceipt's customerId param).
  if (options?.customerOutstandingBalance != null) {
    lines.push(
      escPadLine(
        ctx,
        'Outstanding balance',
        formatPlainAmount(options.customerOutstandingBalance),
      ),
    );
  }
  lines.push(escLine(ctx, `No of Item(s) ${sale.lines.length}`, 'left'));
  if (isHold) {
    lines.push(escLine(ctx, ''));
    lines.push(escHeaderLine(ctx, 'THIS BILL IS ON HOLD'));
    lines.push(escHeaderLine(ctx, 'Payment not taken yet'));
  }

  // Customer Details — only when a real (non-walk-in) customer is attached.
  if (sale.customer_name) {
    lines.push(escDivider(ctx));
    lines.push(escLine(ctx, 'Customer Details', 'left'));
    lines.push(escPadLine(ctx, 'Name', sale.customer_name.slice(0, 18)));
    if (sale.customer_code) {
      lines.push(escPadLine(ctx, 'Customer ID', sale.customer_code.slice(0, 18)));
    }
    if (sale.customer_contact_no) {
      lines.push(escPadLine(ctx, 'Phone No', sale.customer_contact_no.slice(0, 18)));
    }
    if (sale.customer_email) {
      lines.push(escPadLine(ctx, 'Email', sale.customer_email.slice(0, 18)));
    }
    if (sale.customer_route) {
      lines.push(escPadLine(ctx, 'Route', sale.customer_route.slice(0, 18)));
    }
    if (sale.customer_address) {
      lines.push(escPadLine(ctx, 'Address', sale.customer_address.slice(0, 18)));
    }
    if (sale.customer_tax_id) {
      lines.push(escPadLine(ctx, 'Tax ID', sale.customer_tax_id.slice(0, 18)));
    }
  }

  lines.push(escDivider(ctx));
  lines.push(escHeaderLine(ctx, customization.footerMessage));
  lines.push(escDivider(ctx));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_PROVIDER));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_WEBSITE));
  lines.push(
    escHeaderLine(
      ctx,
      `Printed: ${sanitizeForPrint(
        `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      )}`,
    ),
  );
  lines.push(escLine(ctx, ''));
  lines.push(escLine(ctx, ''));

  return lines.join('');
};

export const buildEscPosPurchaseReceipt = (
  receipt: PurchaseReceiptPayload,
  options?: BuildEscPosOptions,
): string => {
  const customization = mergeReceiptPrintSettings(
    options?.settings,
    options?.customization,
  );
  const ctx = createReceiptLayout(customization);
  const code = resolveCurrencyCode(options?.currency);
  const purchase = receipt.purchase;
  const header = receipt.header as Record<string, string | undefined>;
  const lines: string[] = [];

  lines.push(escTitleLine(ctx, header.company_name ?? 'Purchase Bill'));
  if (header.address_line ?? header.address) {
    lines.push(escHeaderLine(ctx, String(header.address_line ?? header.address)));
  }
  if (customization.showPhone && header.phone) {
    lines.push(escHeaderLine(ctx, `Tel: ${header.phone}`));
  }
  lines.push(escLine(ctx, ''));
  lines.push(escHeaderLine(ctx, PURCHASE_RECEIPT_TITLE));
  lines.push(escHeaderLine(ctx, `Receipt: ${purchase.invoice_id}`));
  lines.push(escDivider(ctx));
  // Plain line (not escPadLine) so Date follows bodyAlign instead of always sitting
  // left-anchored — everything else here stays a proper left/right ledger row.
  lines.push(escLine(ctx, `Date: ${purchase.purchase_date}`));

  if (purchase.location) {
    lines.push(escPadLine(ctx, 'Location', purchase.location.slice(0, 18)));
  }
  if (purchase.supplier_name) {
    lines.push(escPadLine(ctx, 'Supplier', purchase.supplier_name.slice(0, 18)));
  }
  if (purchase.supplier_contact_no) {
    lines.push(escPadLine(ctx, 'Phone', purchase.supplier_contact_no.slice(0, 18)));
  }
  if (purchase.supplier_email) {
    lines.push(escPadLine(ctx, 'Email', purchase.supplier_email.slice(0, 18)));
  }
  lines.push(escPadLine(ctx, 'Payment', purchase.payment_method ?? 'Cash'));
  lines.push(escDivider(ctx));
  lines.push(escPadLine(ctx, 'Item', 'Amount'));
  lines.push(escLine(ctx, '.'.repeat(ctx.lineWidth), 'left'));

  for (const line of purchase.lines) {
    const desc = wrapDesc(ctx, line.description);
    const uom = resolveLineUom(line.uom);
    if (line.item_number) {
      lines.push(escLine(ctx, `ID ${line.item_number}`));
    }
    lines.push(escLine(ctx, desc));
    const detail = formatReceiptQtyDetail(
      line.qty,
      formatPrintAmount(line.unit_price, code),
      uom,
    );
    lines.push(escPadLine(ctx, detail, formatPrintAmount(line.line_total, code)));
  }

  lines.push(escDivider(ctx));
  lines.push(escPadLine(ctx, 'Subtotal', formatPrintAmount(purchase.sub_total, code)));
  if (purchase.discount > 0) {
    lines.push(
      escPadLine(ctx, 'Discount', `-${formatPrintAmount(purchase.discount, code)}`),
    );
  }
  lines.push(escPadLine(ctx, 'TOTAL', formatPrintAmount(purchase.amount, code)));
  if (purchase.amount_paid != null) {
    lines.push(escPadLine(ctx, 'Paid', formatPrintAmount(purchase.amount_paid, code)));
  }
  if (purchase.notes?.trim()) {
    lines.push(escLine(ctx, ''));
    lines.push(escLine(ctx, purchase.notes.trim().slice(0, ctx.lineWidth)));
  }
  lines.push(escDivider(ctx));
  lines.push(escHeaderLine(ctx, customization.footerMessage));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_PROVIDER));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_WEBSITE));
  lines.push(escLine(ctx, ''));
  lines.push(escLine(ctx, ''));

  return lines.join('');
};

export const buildEscPosPrintText = (
  receipt: PrintableReceipt,
  options?: BuildEscPosOptions,
): string => {
  if ('purchase' in receipt) {
    return buildEscPosPurchaseReceipt(receipt, options);
  }
  return buildEscPosReceipt(receipt, options);
};
