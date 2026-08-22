import {
  InteractionManager,
  PermissionsAndroid,
  Platform,
  Share,
} from 'react-native';
import type { RefObject } from 'react';
import { captureRef, type ViewShotRef } from 'react-native-view-shot';
import {
  getSaleReceiptTitle,
  RECEIPT_SOFTWARE_PROVIDER,
  RECEIPT_SOFTWARE_WEBSITE,
} from '@/constants/receiptBranding';
import { formatPrintAmount, resolveCurrencyCode } from '@/utils/format';
import { formatReceiptQtyDetail, resolveLineUom } from '@/utils/uom';
import type { SaleReceiptPayload } from '@/types/sales';
import type { PurchaseReceiptPayload } from '@/types/inventory';
import type { PaymentReceiptPayload } from '@/types/customers';

export type ReceiptCaptureRef = RefObject<ViewShotRef | null>;

async function requestSaveToGalleryPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const api = Platform.Version;

  if (api >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      {
        title: 'Save receipt image',
        message: 'Allow access to save receipt images to your gallery.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    return;
  }

  if (api >= 29) {
    return;
  }

  if (api >= 23) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Save receipt image',
        message: 'Allow storage access to save receipt images.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Permission denied — cannot save image to gallery.');
    }
  }
}

function normalizeFileUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
    return trimmed;
  }
  return `file://${trimmed}`;
}

async function waitForReceiptLayout(): Promise<void> {
  await new Promise<void>(resolve => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });
  await new Promise<void>(resolve => setTimeout(resolve, 350));
}

export async function captureFromViewShotRef(
  viewShotRef: ReceiptCaptureRef,
): Promise<string> {
  await waitForReceiptLayout();

  const node = viewShotRef.current;
  if (!node) {
    throw new Error('Receipt is not ready. Wait a moment and try again.');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (typeof node.capture === 'function') {
        const captured = await node.capture();
        if (captured) {
          return normalizeFileUri(captured);
        }
      }

      const uri = await captureRef(node, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (uri) {
        return normalizeFileUri(uri);
      }
    } catch (error) {
      lastError = error;
      await new Promise<void>(resolve => setTimeout(resolve, 400));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Could not capture receipt image. Scroll to the top and try again.');
}

/** Same capture as captureFromViewShotRef, but returns the PNG as a base64 string
 * instead of writing a temp file — used to feed the raster "print receipt as
 * image" path (see bluetoothPrintService.printReceipt) without a filesystem
 * round-trip. Retries once on failure for the same reasons as the tmpfile path. */
export async function captureReceiptBase64(
  viewShotRef: ReceiptCaptureRef,
): Promise<string> {
  await waitForReceiptLayout();

  const node = viewShotRef.current;
  if (!node) {
    throw new Error('Receipt is not ready. Wait a moment and try again.');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await captureRef(node, {
        format: 'png',
        quality: 1,
        result: 'base64',
      });
    } catch (error) {
      lastError = error;
      await new Promise<void>(resolve => setTimeout(resolve, 400));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Could not capture receipt image. Scroll to the top and try again.');
}

async function getCameraRoll() {
  try {
    const mod = await import('@react-native-camera-roll/camera-roll');
    return mod.CameraRoll;
  } catch {
    throw new Error(
      'Gallery save is not available. Rebuild the app after installing camera-roll.',
    );
  }
}

function formatSaveError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Could not save receipt image to gallery.';
}

async function saveUriToGallery(uri: string, salesId: string): Promise<string> {
  await requestSaveToGalleryPermission();

  const CameraRoll = await getCameraRoll();
  const fileUri = normalizeFileUri(uri);

  try {
    await CameraRoll.saveAsset(fileUri, { type: 'photo' });
    return `Receipt ${salesId} saved to Photos`;
  } catch (firstError) {
    try {
      await CameraRoll.save(fileUri, { type: 'photo' });
      return `Receipt ${salesId} saved to Photos`;
    } catch {
      throw new Error(formatSaveError(firstError));
    }
  }
}

type ShareableReceipt = SaleReceiptPayload | PurchaseReceiptPayload | PaymentReceiptPayload;

function getReceiptReference(receipt: ShareableReceipt): string {
  if ('purchase' in receipt) {
    return receipt.purchase.invoice_id;
  }
  if ('result' in receipt) {
    return `Payment-${receipt.result.customer.customer_name}`;
  }
  return receipt.sale.sales_id;
}

/** Save receipt PNG to device gallery (Photos). */
export async function downloadReceiptAsImage(
  viewShotRef: ReceiptCaptureRef,
  receipt: ShareableReceipt,
): Promise<string> {
  const uri = await captureFromViewShotRef(viewShotRef);
  const salesId = getReceiptReference(receipt);
  const fileUri = normalizeFileUri(uri);

  try {
    return await saveUriToGallery(uri, salesId);
  } catch (galleryError) {
    try {
      await Share.share({
        title: `Receipt ${salesId}`,
        message: Platform.OS === 'android' ? `Receipt ${salesId}` : undefined,
        url: fileUri,
      });
      return `Receipt ${salesId} ready — pick Save or Photos in the share menu if gallery save failed.`;
    } catch {
      throw new Error(formatSaveError(galleryError));
    }
  }
}

/** Open share sheet with receipt image file. */
export async function shareReceiptImageFile(
  viewShotRef: ReceiptCaptureRef,
  receipt: ShareableReceipt,
): Promise<void> {
  const fileUri = normalizeFileUri(await captureFromViewShotRef(viewShotRef));
  const receiptRef = getReceiptReference(receipt);

  if (Platform.OS === 'ios') {
    await Share.share({
      url: fileUri,
      title: `Receipt ${receiptRef}`,
    });
    return;
  }

  try {
    await requestSaveToGalleryPermission();
    const CameraRoll = await getCameraRoll();
    const saved = await CameraRoll.saveAsset(fileUri, { type: 'photo' });
    const shareUri =
      saved?.node?.image?.uri != null
        ? normalizeFileUri(String(saved.node.image.uri))
        : fileUri;
    await Share.share({
      title: `Receipt ${receiptRef}`,
      url: shareUri,
    });
  } catch {
    try {
      const base64 = await captureReceiptBase64(viewShotRef);
      const dataUri = `data:image/png;base64,${base64}`;
      await Share.share({
        title: `Receipt ${receiptRef}`,
        url: dataUri,
      });
    } catch {
      await Share.share({ title: `Receipt ${receiptRef}`, url: fileUri });
    }
  }
}

export function buildReceiptShareText(
  receipt: SaleReceiptPayload,
  currency?: string | null,
): string {
  const s = receipt.sale;
  const header = receipt.header as Record<string, string | undefined>;
  const company = header.company_name ?? 'Receipt';
  const code = resolveCurrencyCode(currency);
  const isHold = Boolean(s.is_hold || s.order_status === 'hold');
  const isExchange = Boolean(s.is_exchange);
  const isRefundDue = isExchange && s.net_amount < 0;
  const displayNetAmount = isRefundDue ? Math.abs(s.net_amount) : s.net_amount;
  const discountLine =
    s.discount > 0
      ? `Discount${s.discount_percent != null && s.discount_percent > 0 ? ` (${s.discount_percent}%)` : ''}: -${formatPrintAmount(s.discount, code)}`
      : '';
  const returnCreditLine =
    (s.return_sub_total ?? 0) > 0
      ? `Return credit: -${formatPrintAmount(s.return_sub_total ?? 0, code)}`
      : '';
  const formatLine = (l: (typeof s.lines)[number]): string => {
    const uom = resolveLineUom(l.uom);
    const amount =
      l.line_direction === 'return'
        ? `-${formatPrintAmount(l.line_total, code)}`
        : formatPrintAmount(l.line_total, code);
    return `  ${l.item_number ? `[${l.item_number}] ` : ''}${l.description} ${formatReceiptQtyDetail(l.qty, formatPrintAmount(l.unit_price, code), uom)} = ${amount}`;
  };

  // Sold and returned items print as two clearly separate, plainly-labeled
  // blocks rather than one mixed list with a color tag — this is shared text
  // (no color available anyway), so separation is what keeps it readable.
  const returnLines = s.lines.filter(l => l.line_direction === 'return');
  const saleLines = s.lines.filter(l => l.line_direction !== 'return');
  const lines =
    returnLines.length > 0
      ? [
          'SOLD ITEMS',
          saleLines.map(formatLine).join('\n'),
          'RETURNED ITEMS',
          returnLines.map(formatLine).join('\n'),
        ].join('\n')
      : s.lines.map(formatLine).join('\n');

  return [
    company,
    getSaleReceiptTitle({ isHold, isReturn: Boolean(s.is_return) }),
    isHold ? 'NOT PAID — Complete to finalize' : '',
    `${isHold ? 'Hold' : isExchange ? 'Exchange' : s.is_return ? 'Return' : 'Bill'}: ${s.sales_id}`,
    `Date: ${s.sale_date}`,
    s.location ? `Branch: ${s.location}` : '',
    s.customer_name ? `Customer: ${s.customer_name}` : '',
    `Payment: ${s.payment_method ?? 'Cash'}`,
    '---',
    lines,
    '---',
    `Subtotal: ${formatPrintAmount(s.sub_total, code)}`,
    returnCreditLine,
    discountLine,
    `${isHold ? 'Amount due' : isRefundDue ? 'Refund due' : s.discount > 0 ? 'Balance' : 'TOTAL'}: ${formatPrintAmount(displayNetAmount, code)}`,
    !isHold && s.amount_received != null
      ? `Paid: ${formatPrintAmount(s.amount_received, code)}`
      : '',
    isHold ? 'THIS BILL IS ON HOLD' : '',
    '',
    'Thank you!',
    RECEIPT_SOFTWARE_PROVIDER,
    RECEIPT_SOFTWARE_WEBSITE,
  ]
    .filter(Boolean)
    .join('\n');
}
