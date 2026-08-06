import { RECEIPT_SOFTWARE_PROVIDER, RECEIPT_SOFTWARE_WEBSITE } from '@/constants/receiptBranding';
import type { PosMobileSettings } from '@/types/settings';
import type { ReceiptPrintCustomization } from '@/types/receiptPrint';
import type { SystemReportHeader } from '@/types/reports';
import type { CustomerSummary } from '@/types/sales';
import type { ReceivePaymentResult } from '@/types/customers';
import { formatPlainAmount } from '@/utils/format';
import { mergeReceiptPrintSettings } from '@/utils/receiptPrintCustomization';
import {
  createReceiptLayout,
  escDivider,
  escHeaderLine,
  escLine,
  escPadLine,
  escTitleLine,
  sanitizeForPrint,
} from '@/utils/receiptEscPosLayout';

export type BuildCustomerStatementOptions = {
  customization?: ReceiptPrintCustomization | null;
  settings?: PosMobileSettings | null;
  /** Logged-in user's name — printed on the "Cashier" line. */
  cashierName?: string | null;
};

/**
 * Standalone "give the customer their current details" printout — not tied to any
 * payment transaction. Available any time from the Receive Payment screen, so a
 * cashier can hand over a customer's name/contact/outstanding balance on request.
 */
export const buildEscPosCustomerStatement = (
  customer: CustomerSummary,
  header: SystemReportHeader,
  options?: BuildCustomerStatementOptions,
): string => {
  const customization = mergeReceiptPrintSettings(options?.settings, options?.customization);
  const ctx = createReceiptLayout(customization);
  const lines: string[] = [];

  lines.push(escTitleLine(ctx, header.company_name ?? 'Business'));
  if (header.address) {
    lines.push(escHeaderLine(ctx, header.address));
  }
  if (customization.showPhone && header.phone) {
    lines.push(escHeaderLine(ctx, `Tel: ${header.phone}`));
  }
  lines.push(escDivider(ctx));

  const now = new Date();
  const dateStr = sanitizeForPrint(now.toLocaleDateString());
  const timeStr = sanitizeForPrint(
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );
  lines.push(escPadLine(ctx, dateStr, timeStr));
  if (options?.cashierName?.trim()) {
    lines.push(escPadLine(ctx, 'Cashier', options.cashierName.trim().slice(0, 18)));
  }
  lines.push(escDivider(ctx));

  // 'left' explicitly — sits among left-anchored ledger rows below, same as the
  // "Customer Details" section on sale receipts.
  lines.push(escLine(ctx, 'Customer Statement', 'left'));
  lines.push(escPadLine(ctx, 'Name', customer.customer_name.slice(0, 18)));
  const customerId = customer.customer_code ?? customer.customer_id;
  if (customerId) {
    lines.push(escPadLine(ctx, 'Customer ID', String(customerId).slice(0, 18)));
  }
  if (customer.contact_no) {
    lines.push(escPadLine(ctx, 'Phone No', customer.contact_no.slice(0, 18)));
  }
  if (customer.address) {
    lines.push(escPadLine(ctx, 'Address', customer.address.slice(0, 18)));
  }
  lines.push(escDivider(ctx));
  lines.push(
    escPadLine(ctx, 'Outstanding balance', formatPlainAmount(customer.net_balance ?? 0)),
  );

  lines.push(escDivider(ctx));
  lines.push(escHeaderLine(ctx, customization.footerMessage));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_PROVIDER));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_WEBSITE));
  lines.push(escLine(ctx, ''));
  lines.push(escLine(ctx, ''));

  return lines.join('');
};

/**
 * Receipt for an actual payment just collected — previous balance, amount received,
 * new balance, payment method, and any notes. Printed right after a payment succeeds
 * (optional — the cashier chooses whether to print), distinct from the standalone
 * customer statement above which has no transaction to report.
 */
export const buildEscPosPaymentReceipt = (
  result: ReceivePaymentResult,
  header: SystemReportHeader,
  notes: string | null | undefined,
  options?: BuildCustomerStatementOptions,
): string => {
  const customization = mergeReceiptPrintSettings(options?.settings, options?.customization);
  const ctx = createReceiptLayout(customization);
  const lines: string[] = [];

  lines.push(escTitleLine(ctx, header.company_name ?? 'Business'));
  if (header.address) {
    lines.push(escHeaderLine(ctx, header.address));
  }
  if (customization.showPhone && header.phone) {
    lines.push(escHeaderLine(ctx, `Tel: ${header.phone}`));
  }
  lines.push(escLine(ctx, ''));
  lines.push(escHeaderLine(ctx, 'PAYMENT RECEIPT'));
  lines.push(escDivider(ctx));

  const now = new Date();
  const dateStr = sanitizeForPrint(now.toLocaleDateString());
  const timeStr = sanitizeForPrint(
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );
  lines.push(escPadLine(ctx, dateStr, timeStr));
  if (options?.cashierName?.trim()) {
    lines.push(escPadLine(ctx, 'Cashier', options.cashierName.trim().slice(0, 18)));
  }
  lines.push(escDivider(ctx));

  lines.push(escPadLine(ctx, 'Name', result.customer.customer_name.slice(0, 18)));
  if (result.customer.contact_no) {
    lines.push(escPadLine(ctx, 'Phone No', result.customer.contact_no.slice(0, 18)));
  }
  lines.push(escDivider(ctx));

  lines.push(escPadLine(ctx, 'Previous balance', formatPlainAmount(result.previous_balance)));
  lines.push(escPadLine(ctx, 'Amount received', formatPlainAmount(result.payment_received)));
  lines.push(escDivider(ctx, '='));
  lines.push(escPadLine(ctx, 'New balance', formatPlainAmount(result.new_balance)));
  lines.push(escDivider(ctx, '='));

  // 'left' explicitly — sits among left-anchored ledger rows, same convention as
  // "Paid By" on sale receipts.
  lines.push(escLine(ctx, `Paid By ${result.payment_method}`, 'left'));
  if (notes?.trim()) {
    lines.push(escLine(ctx, `Notes: ${notes.trim()}`.slice(0, ctx.lineWidth), 'left'));
  }

  lines.push(escDivider(ctx));
  lines.push(escHeaderLine(ctx, customization.footerMessage));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_PROVIDER));
  lines.push(escHeaderLine(ctx, RECEIPT_SOFTWARE_WEBSITE));
  lines.push(escLine(ctx, ''));
  lines.push(escLine(ctx, ''));

  return lines.join('');
};
