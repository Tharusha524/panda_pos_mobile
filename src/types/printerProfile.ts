import type { EscPosPrintOptions } from '@/utils/escPosPrintOptions';

/** How the app formats ESC/POS output for different hardware. */
export type PrinterProfileId = 'mini_portable' | 'standard_counter';

export interface PrinterProfileMeta {
  id: PrinterProfileId;
  title: string;
  subtitle: string;
  examples: string;
}

export const PRINTER_PROFILES: PrinterProfileMeta[] = [
  {
    id: 'mini_portable',
    title: 'Mini portable (SCO3H, etc.)',
    subtitle: '58mm Bluetooth pocket printers',
    examples: 'SCO3H-SFEB, MTP-II, small ESC/POS mini',
  },
  {
    id: 'standard_counter',
    title: 'Standard counter printer',
    subtitle: '58mm / 80mm desk or Wi‑Fi printers',
    examples: 'Xprinter XP-58/80, Epson TM, network ESC/POS',
  },
];

export type PrinterProfileBehavior = {
  printOptions: EscPosPrintOptions;
  /** Send ESC/POS via native printRawData (required for SCO3H mini printers). */
  useDirectRawPrint: boolean;
  /** Strip bold/double-size tags that mini printers reject. */
  stripFancyTags: boolean;
  /** Extra wait after sending data — slow mini BT buffers need more time. */
  printDelayMultiplier: number;
  /** Raster/logo via printRawData works on both profiles, but mini units need a smaller image
   * (see logoMaxWidthPx) and a longer settle delay (see printDelayMultiplier) to stay reliable. */
  supportsRasterLogo: boolean;
  /** Max raster image width in dots for the logo. Mini SCO3H-style units reliably choke on
   * anything wider than ~200px (the native printImageData path already caps to this same
   * value) — keep the two in sync if this ever changes. */
  logoMaxWidthPx: number;
  defaultPaperWidth: '58mm' | '80mm';
};

export const PRINTER_PROFILE_BEHAVIOR: Record<PrinterProfileId, PrinterProfileBehavior> = {
  mini_portable: {
    printOptions: {
      encoding: 'CP437',
      cut: false,
      beep: false,
      tailingLine: true,
    },
    useDirectRawPrint: true,
    stripFancyTags: true,
    printDelayMultiplier: 2.5,
    supportsRasterLogo: true,
    logoMaxWidthPx: 200,
    defaultPaperWidth: '58mm',
  },
  standard_counter: {
    printOptions: {
      encoding: 'UTF8',
      cut: true,
      beep: false,
      tailingLine: true,
    },
    useDirectRawPrint: false,
    stripFancyTags: false,
    printDelayMultiplier: 1,
    supportsRasterLogo: true,
    logoMaxWidthPx: 384,
    defaultPaperWidth: '80mm',
  },
};

/** Guess profile from Bluetooth device name shown during pairing. */
export const guessPrinterProfile = (name?: string | null): PrinterProfileId => {
  const n = (name ?? '').toLowerCase();
  if (
    /sco3h|mtp[- ]?ii|mini|portable|pocket|pos[- ]?58|58mm|innerprinter|rpp|rpp02|zjiang|goojprt|mht|vsc|vsc1020/.test(
      n,
    )
  ) {
    return 'mini_portable';
  }
  return 'standard_counter';
};

export const getPrinterProfileBehavior = (
  profile: PrinterProfileId = 'mini_portable',
): PrinterProfileBehavior => PRINTER_PROFILE_BEHAVIOR[profile];
