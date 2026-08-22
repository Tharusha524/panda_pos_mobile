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
}

export interface ReceivePaymentResult {
  customer: CustomerSummary;
  payment_received: number;
  previous_balance: number;
  new_balance: number;
  payment_method: string;
  cheque_number?: string | null;
  bank_name?: string | null;
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
