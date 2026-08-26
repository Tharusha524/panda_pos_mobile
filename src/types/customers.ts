import type { CustomerSummary } from '@/types/sales';

export interface CustomerListSummary {
  total_customers: number;
  /** Customers with outstanding balance (net_balance > 0) */
  debtor_count: number;
  total_receivables: number;
}

export interface CustomerListResult {
  customers: CustomerSummary[];
  summary: CustomerListSummary;
  filters: {
    locations: string[];
  };
}

export interface ReceivePaymentPayload {
  amount: number;
  payment_method?: string;
  notes?: string | null;
  location?: string | null;
  cheque_number?: string | null;
  bank_name?: string | null;
  /** Which old bill this payment settles — optional, see OutstandingBill. */
  sale_id?: number | null;
}

export interface ReceivePaymentResult {
  customer: CustomerSummary;
  payment_received: number;
  previous_balance: number;
  new_balance: number;
  payment_method: string;
  cheque_number?: string | null;
  bank_name?: string | null;
  bill_number?: string | null;
}

/** One of a customer's still-unpaid credit sales — used by the Receive
 * Payment "which bill" picker. Distinct from the customer's overall
 * net_balance, which stays the source of truth for the total owed. */
export interface OutstandingBill {
  sale_id: number;
  bill_number: string | null;
  date: string | null;
  bill_amount: number;
  paid_amount: number;
  outstanding_amount: number;
}

/** A "receive payment" record for Customer History — distinct from a sale
 * row, which already covers payment taken at the time of a sale. */
export interface CustomerPaymentRecord {
  id: number;
  date: string | null;
  reference: string | null;
  payment_method: string | null;
  cheque_number: string | null;
  bank_name: string | null;
  amount: number;
  notes: string | null;
  bill_number: string | null;
  /** Frozen at the time this payment was recorded — null for payments made
   * before this was tracked (the receipt reprint falls back to the
   * customer's current balance then). */
  previous_balance: number | null;
  new_balance: number | null;
}

/** Passed to the payment receipt review screen — same payment result the "old
 * type" text receipt printed from, just routed through the image-receipt preview. */
export interface PaymentReceiptPayload {
  result: ReceivePaymentResult;
  notes: string | null;
}

export interface CustomerPayload {
  customer_code?: string;
  first_name: string;
  customer_name: string;
  contact_no: string;
  email?: string | null;
  location?: string | null;
  route: string;
  address_line1?: string | null;
  nic?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
