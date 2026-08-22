export interface PaymentDetailLine {
  item_number?: string | null;
  description: string;
  qty: number;
  unit_price: number;
  discount: number;
  net_price: number;
  amount: number;
}

/** Matches backend PaymentService::formatPayment() — GET /payments/{id} */
export interface PaymentDetailPayload {
  id: number;
  source_type: string | null;
  source_id: number | null;
  payment_type: string | null;
  location: string | null;
  payment_date: string;
  payment_datetime?: string | null;
  sales_no: string | null;
  receipt_type: string | null;
  payment_method: string | null;
  discount: number;
  paid_amount: number;
  notes: string | null;
  direction: 'Income' | 'Paid Out' | 'Payment' | string;
  source_label: string;
  details: PaymentDetailLine[];
}
