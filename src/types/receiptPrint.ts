export type ReceiptTextAlign = 'left' | 'center' | 'right';

export type ReceiptTitleFont = 'normal' | 'large' | 'bold' | 'custom';

export type ReceiptPaperWidth = '58mm' | '80mm';

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
};
