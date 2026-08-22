import type { TextStyle } from 'react-native';
import { useReceiptPrintCustomization } from '@/hooks/useReceiptPrintCustomization';
import {
  DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  type ReceiptPrintCustomization,
  type ReceiptTextWeight,
} from '@/types/receiptPrint';
import type { PosMobileSettings } from '@/types/settings';

const WEIGHT_MAP: Record<ReceiptTextWeight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '600',
  bold: '700',
};

// The logo's original box was 120×56 — keep that aspect ratio as its width is resized.
const LOGO_ASPECT_RATIO = 56 / 120;

export interface ReceiptStyleScale {
  customization: ReceiptPrintCustomization;
  /** Scales a body-text font size (px) around the receiptBodyTextSizePx baseline. */
  scaleFont: (base: number) => number;
  /** Scaled font size, plus (unless the weight is left at 'regular') the body text
   * weight override — for ordinary body text lines. */
  bodyText: (base: number) => TextStyle;
  /** Scaled font size only, no weight override — for text that must keep its own
   * fixed weight (e.g. a grand total) regardless of the body text weight setting. */
  bodyTextSizeOnly: (base: number) => TextStyle;
  companyNameStyle: TextStyle;
  companyDetailsStyle: TextStyle;
  dividerOverride: { height: number };
  logoWidth: number;
  logoHeight: number;
}

/** Turns the user's Receipt Layout customization settings (Settings → Receipt
 * printer → Customize) into concrete style values — the single place this logic
 * lives, shared by every image-type receipt/report view (sale, purchase, payment,
 * backend/system reports) so one setting consistently drives them all. */
export const useReceiptStyleScale = (
  settings?: PosMobileSettings | null,
  /** Bypasses the normal load-from-device-storage customization and uses this
   * value instead — used only by the Receipt layout settings screen so its live
   * preview reflects in-progress, not-yet-saved changes instantly. */
  customizationOverride?: ReceiptPrintCustomization,
): ReceiptStyleScale => {
  const loadedCustomization = useReceiptPrintCustomization(settings);
  const customization = customizationOverride ?? loadedCustomization;

  // Every body-text line's font size scales proportionally around this baseline
  // (instead of every line getting its own independent control), so a receipt's
  // existing size hierarchy — totals bigger than footnotes — is preserved rather
  // than flattened. 'regular' weight means "leave each line's own designed weight
  // alone", so at the defaults this renders pixel-identical to the original
  // hardcoded styles.
  const bodyScale =
    customization.receiptBodyTextSizePx /
    DEFAULT_RECEIPT_PRINT_CUSTOMIZATION.receiptBodyTextSizePx;
  const bodyWeightOverride =
    customization.receiptBodyTextWeight === 'regular'
      ? undefined
      : WEIGHT_MAP[customization.receiptBodyTextWeight];
  const scaleFont = (base: number) => Math.max(8, Math.round(base * bodyScale));
  const bodyText = (base: number): TextStyle => ({
    fontSize: scaleFont(base),
    ...(bodyWeightOverride ? { fontWeight: bodyWeightOverride } : null),
  });
  const bodyTextSizeOnly = (base: number): TextStyle => ({ fontSize: scaleFont(base) });

  const logoWidth = customization.receiptLogoWidthPx;
  const logoHeight = Math.round(logoWidth * LOGO_ASPECT_RATIO);

  const companyNameStyle: TextStyle = {
    fontSize: customization.receiptCompanyNameSizePx,
    fontWeight: WEIGHT_MAP[customization.receiptCompanyNameWeight],
  };
  // Company details block (address/phone/email/tax ID/reg no) has its own
  // dedicated size+weight, separate from the general body text control above.
  const companyDetailsStyle: TextStyle = {
    fontSize: customization.receiptCompanyDetailsSizePx,
    ...(customization.receiptCompanyDetailsWeight === 'regular'
      ? null
      : { fontWeight: WEIGHT_MAP[customization.receiptCompanyDetailsWeight] }),
  };
  // Always rendered fully solid black at this thickness — see
  // receiptDividerThicknessPx's doc comment on ReceiptPrintCustomization.
  const dividerOverride = { height: customization.receiptDividerThicknessPx };

  return {
    customization,
    scaleFont,
    bodyText,
    bodyTextSizeOnly,
    companyNameStyle,
    companyDetailsStyle,
    dividerOverride,
    logoWidth,
    logoHeight,
  };
};
