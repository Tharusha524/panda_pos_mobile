const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const bytesToBase64 = (bytes: number[] | Uint8Array): string => {
  const list = Array.from(bytes);
  let output = '';
  for (let i = 0; i < list.length; i += 3) {
    const chr1 = list[i];
    const chr2 = i + 1 < list.length ? list[i + 1] : NaN;
    const chr3 = i + 2 < list.length ? list[i + 2] : NaN;

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    const enc3 = Number.isNaN(chr2) ? 64 : ((chr2 & 15) << 2) | (chr3 >> 6);
    const enc4 = Number.isNaN(chr3) ? 64 : chr3 & 63;

    output += BASE64_CHARS.charAt(enc1);
    output += BASE64_CHARS.charAt(enc2);
    output += enc3 === 64 ? '=' : BASE64_CHARS.charAt(enc3);
    output += enc4 === 64 ? '=' : BASE64_CHARS.charAt(enc4);
  }
  return output;
};

// char code → 6-bit value ('=' → 64, same as BASE64_CHARS.indexOf gave). A table
// lookup instead of indexOf per character — this decodes the full receipt image
// for raster printing, where the old linear scan cost seconds on its own.
const DECODE_TABLE = (() => {
  const table = new Uint8Array(128).fill(64);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    table[BASE64_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();

export const base64ToBytes = (base64: string): Uint8Array => {
  const normalized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const byteLength = (normalized.length * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;

  for (let i = 0; i < normalized.length; i += 4) {
    const enc1 = DECODE_TABLE[normalized.charCodeAt(i)];
    const enc2 = DECODE_TABLE[normalized.charCodeAt(i + 1)];
    const enc3 = DECODE_TABLE[normalized.charCodeAt(i + 2)];
    const enc4 = DECODE_TABLE[normalized.charCodeAt(i + 3)];
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
