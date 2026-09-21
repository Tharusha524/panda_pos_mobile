export interface StockTransferContext {
  locations: string[];
}

export interface StockTransferItemOption {
  id: number;
  item_number: string;
  description: string;
  location: string;
  qty: number;
  to_qty: number | null;
  selling_price: number;
  uom: string;
}

export interface StockTransferLineInput {
  item_id: number;
  qty: number;
}

export interface StockTransferPayload {
  from_location: string;
  to_location: string;
  transfer_date?: string;
  notes?: string;
  lines: StockTransferLineInput[];
}

export interface StockTransferResultLine {
  item_number: string;
  description: string;
  qty: number;
  from_before: number;
  from_after: number;
  to_before: number;
  to_after: number;
}

export interface StockTransferResult {
  transfer_id: number;
  from_location: string;
  to_location: string;
  transfer_date: string;
  lines: StockTransferResultLine[];
}

export interface StockTransferSummaryRow {
  item_number: string;
  description: string;
  qty: number;
}
