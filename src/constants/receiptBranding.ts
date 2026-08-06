/** Shown at the bottom of every printed / on-screen receipt. */
export const RECEIPT_SOFTWARE_PROVIDER = 'Designed by DIO Solutions';
export const RECEIPT_SOFTWARE_WEBSITE = 'dio.lk';

export const DEFAULT_RECEIPT_STORE_NAME = 'Sales Receipt';

export const PURCHASE_RECEIPT_TITLE = 'PURCHASE RECEIPT';

export function getSaleReceiptTitle(options: {
  isHold?: boolean;
  isReturn?: boolean;
}): string {
  if (options.isHold) {
    return 'HOLD ORDER';
  }
  if (options.isReturn) {
    return 'SALES RETURN';
  }
  return 'SALES RECEIPT';
}
