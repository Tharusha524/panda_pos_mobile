import type { EscPosPrintOptions } from '@/utils/escPosPrintOptions';
import { base64ToBytes, bytesToBase64 } from '@/utils/escPosBase64';

type ExchangeTextFn = (text: string, options?: EscPosPrintOptions) => { toString: (enc: string) => string };

const loadExchangeText = (): ExchangeTextFn => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-thermal-receipt-printer/dist/utils/EPToolkit');
  return mod.exchange_text as ExchangeTextFn;
};

/** Mini printers (SCO3H) often choke on double-width / bold font tags. */
export const stripFancyEscPosTags = (text: string): string =>
  text
    .replace(/<CB>/gi, '<C>')
    .replace(/<\/CB>/gi, '')
    .replace(/<CD>/gi, '<C>')
    .replace(/<\/CD>/gi, '')
    .replace(/<CM>/gi, '<C>')
    .replace(/<\/CM>/gi, '')
    .replace(/<B>/gi, '')
    .replace(/<\/B>/gi, '')
    .replace(/<M>/gi, '')
    .replace(/<\/M>/gi, '')
    .replace(/<D>/gi, '')
    .replace(/<\/D>/gi, '');

/** EPToolkit splits on `\n` only — `\r` bytes can break SCO3H output. */
export const normalizeEscPosNewlines = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// react-native-thermal-receipt-printer's EPToolkit.exchange_text unconditionally
// prepends a full printer-initialize command (ESC @ — bytes 0x1B, 0x40) to every
// payload it builds, every time it's called. That's fine as a cold-start reset,
// but every one of our print jobs (see sendRawText) is really issued mid-session,
// right after the logo's raster image finishes — and some clone thermal printers
// mishandle a full reset that soon after raster data, misprinting its identifier
// byte as a literal stray character (the "2"/"3"/"a" seen right before the
// company name, regardless of title font or line layout — every layout variant
// hit this same ESC @ first). It's safe to drop: the library's own line-spacing
// reset immediately follows it, and it resets formatting after every line anyway.
const PRINTER_INIT_BYTES = [0x1b, 0x40];

const stripLeadingPrinterInit = (base64: string): string => {
  const bytes = base64ToBytes(base64);
  if (bytes[0] === PRINTER_INIT_BYTES[0] && bytes[1] === PRINTER_INIT_BYTES[1]) {
    return bytesToBase64(bytes.subarray(2));
  }
  return base64;
};

// Separately from the ESC @ issue above: this printer also glitches specifically
// on the multi-byte command EPToolkit sends to switch into the large/bold company
// -name font (double-width/double-height + user-defined-font-size). Its own
// leading byte gets misread and printed as a stray digit — glued directly onto
// the company name itself, which also throws off our word-wrap width by one
// character (splitting words like "PRODUCTS" mid-word). This happens wherever the
// command lands in the stream, not just at a write boundary, so the warm-up-byte
// fix above doesn't cover it. Fix: splice a few inert NUL bytes directly in front
// of each occurrence of the exact command bytes — NUL has no printable glyph on
// any thermal printer, unlike a real command, so even if the glitch lands there
// instead, nothing visible prints.
const RISKY_COMMAND_SEQUENCES: readonly number[][] = [
  [27, 97, 1, 27, 33, 32, 28, 33, 4], // <CD> large title font
  [27, 97, 1, 27, 33, 48, 28, 33, 12], // <CB> bold title font
  [27, 97, 1, 27, 33, 16, 28, 33, 8], // <CM> medium title font
];
const GLITCH_GUARD_BYTES: readonly number[] = [0, 0, 0, 0];

const matchesAt = (bytes: Uint8Array, offset: number, seq: number[]): boolean => {
  if (offset + seq.length > bytes.length) {
    return false;
  }
  for (let j = 0; j < seq.length; j++) {
    if (bytes[offset + j] !== seq[j]) {
      return false;
    }
  }
  return true;
};

const guardRiskyCommands = (bytes: Uint8Array): Uint8Array => {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (RISKY_COMMAND_SEQUENCES.some(seq => matchesAt(bytes, i, seq))) {
      out.push(...GLITCH_GUARD_BYTES);
    }
    out.push(bytes[i]);
  }
  return Uint8Array.from(out);
};

export const buildEscPosBase64Payload = (
  text: string,
  options: EscPosPrintOptions,
): string => {
  const exchangeText = loadExchangeText();
  const buffer = exchangeText(normalizeEscPosNewlines(text), options);
  const withoutInit = base64ToBytes(stripLeadingPrinterInit(buffer.toString('base64')));
  return bytesToBase64(guardRiskyCommands(withoutInit));
};

/** Plain ASCII feed after body — helps mini printers eject paper without cut command. */
export const appendMiniPrinterFeed = (base64: string): string => {
  const feed = [0x0a, 0x0a, 0x0a, 0x0a, 0x0a];
  const binary = atobPolyfill(base64);
  const merged = new Uint8Array(binary.length + feed.length);
  merged.set(binary, 0);
  merged.set(feed, binary.length);
  return bytesToBase64(merged);
};

const atobPolyfill = (base64: string): Uint8Array => {
  const normalized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const byteLength = (normalized.length * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  for (let i = 0; i < normalized.length; i += 4) {
    const enc1 = chars.indexOf(normalized[i]);
    const enc2 = chars.indexOf(normalized[i + 1]);
    const enc3 = chars.indexOf(normalized[i + 2]);
    const enc4 = chars.indexOf(normalized[i + 3]);
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes[byteIndex++] = chr1;
    if (enc3 !== 64 && byteIndex < byteLength) {
      bytes[byteIndex++] = chr2;
    }
    if (enc4 !== 64 && byteIndex < byteLength) {
      bytes[byteIndex++] = chr3;
    }
  }
  return bytes;
};
