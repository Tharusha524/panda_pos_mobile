export type ReceiptTextAlign = 'left' | 'center' | 'right';

export type ReceiptTitleFont = 'normal' | 'large' | 'bold' | 'custom';

export type ReceiptPaperWidth = '58mm' | '80mm';

/** 'regular' means "leave this text's own designed weight alone" (today's exact
 * look); 'medium'/'bold' force that weight onto the text it applies to. */
export type ReceiptTextWeight = 'regular' | 'medium' | 'bold';

export interface ReceiptPrintCustomization {
  headerAlign: ReceiptTextAlign;
  bodyAlign: ReceiptTextAlign;
  titleFont: ReceiptTitleFont;
  showLogo: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showTaxId: boolean;
  showRegistration: boolean;
  footerMessage: string;
  paperWidth: ReceiptPaperWidth;
  /** Only used when titleFont === 'custom' — company name is rendered as an image
   * at this pixel size instead of using the printer's fixed-size text tags. */
  titleFontSizePx: number;
  /** Print the whole receipt as one raster image captured from the on-screen
   * preview, instead of building it from ESC/POS text commands. Matches the
   * preview pixel-for-pixel and sidesteps printer text-formatting bugs entirely,
   * at the cost of a slower print. Off by default. */
  printAsImage: boolean;
  /** Width (px) of the logo shown in the on-screen receipt preview and, when
   * printAsImage is on, the printed page — height scales with it to keep the
   * logo's aspect ratio. */
  receiptLogoWidthPx: number;
  /** Font size (px) of the company name in the on-screen receipt preview / printed
   * image (separate from titleFontSizePx, which only affects the raster title used
   * by ESC/POS text-mode printing). */
  receiptCompanyNameSizePx: number;
  receiptCompanyNameWeight: ReceiptTextWeight;
  /** Reference size (px) for the receipt's body text (item lines, totals, meta
   * rows, footer, etc.) in the on-screen preview / printed image — every body text
   * line scales proportionally around this value, so the existing size hierarchy
   * (totals bigger than footnotes) is preserved rather than flattened. */
  receiptBodyTextSizePx: number;
  receiptBodyTextWeight: ReceiptTextWeight;
  /** Font size (px) + weight for the company details block right under the
   * company name (address, phone, email, tax ID, registration number) — separate
   * from the general body text control so this block can be sized/weighted on
   * its own. */
  receiptCompanyDetailsSizePx: number;
  receiptCompanyDetailsWeight: ReceiptTextWeight;
  /** Thickness (px) of the horizontal divider lines that separate receipt
   * sections — also always rendered fully solid black (not the original faint
   * translucent line), since a thin, partly-transparent line is exactly the kind
   * of pixel that gets lost when the receipt is converted to printer dots. */
  receiptDividerThicknessPx: number;
}

export const DEFAULT_RECEIPT_PRINT_CUSTOMIZATION: ReceiptPrintCustomization = {
  headerAlign: 'center',
  bodyAlign: 'center',
  titleFont: 'bold',
  showLogo: true,
  showPhone: true,
  showEmail: true,
  showTaxId: true,
  showRegistration: true,
  footerMessage: 'Thank You Come Again',
  paperWidth: '58mm',
  titleFontSizePx: 28,
  printAsImage: false,
  // These defaults exactly match SaleReceiptView's original hardcoded styling, so
  // nobody sees any visual change until they actually open the new controls.
  receiptLogoWidthPx: 120,
  receiptCompanyNameSizePx: 18,
  receiptCompanyNameWeight: 'bold',
  receiptBodyTextSizePx: 12,
  receiptBodyTextWeight: 'regular',
  receiptCompanyDetailsSizePx: 12,
  receiptCompanyDetailsWeight: 'regular',
  receiptDividerThicknessPx: 1,
};
