import { decode as decodeJpeg } from 'jpeg-js';
import { decode as decodePng, convertIndexedToRgb, hasPngSignature } from 'fast-png';
import { bytesToBase64 } from '@/utils/escPosBase64';

const base64ToBytes = (base64: string): Uint8Array => {
  const BASE64_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const byteLength = (normalized.length * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;

  for (let i = 0; i < normalized.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(normalized[i]);
    const enc2 = BASE64_CHARS.indexOf(normalized[i + 1]);
    const enc3 = BASE64_CHARS.indexOf(normalized[i + 2]);
    const enc4 = BASE64_CHARS.indexOf(normalized[i + 3]);
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

const ESC = 0x1b;
const SELECT_BIT_IMAGE_MODE = [ESC, 0x2a, 33];
const SET_LINE_SPACE_24 = [ESC, 0x33, 24];
const SET_LINE_SPACE_32 = [ESC, 0x33, 32];
const LINE_FEED = [0x0a];
const CENTER_ALIGN = [ESC, 0x61, 1];

const shouldPrintColor = (r: number, g: number, b: number, a: number): boolean => {
  if (a < 128) {
    return false;
  }
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 127;
};

const resizeRgba = (
  data: Uint8Array,
  width: number,
  height: number,
  targetWidth: number,
): { data: Uint8Array; width: number; height: number } => {
  if (width <= targetWidth) {
    return { data, width, height };
  }
  const targetHeight = Math.max(1, Math.round((height * targetWidth) / width));
  const out = new Uint8Array(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor((y * height) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor((x * width) / targetWidth));
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: out, width: targetWidth, height: targetHeight };
};

const buildPixelGrid = (
  rgba: Uint8Array,
  width: number,
  height: number,
): number[][] => {
  const pixels: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row.push(
        shouldPrintColor(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]) ? 1 : 0,
      );
    }
    pixels.push(row);
  }
  return pixels;
};

const recollectSlice = (y: number, x: number, pixels: number[][]): number[] => {
  const slices = [0, 0, 0];
  for (let yy = y, band = 0; yy < y + 24 && band < 3; yy += 8, band++) {
    let slice = 0;
    for (let b = 0; b < 8; b++) {
      const row = yy + b;
      if (row >= pixels.length) {
        continue;
      }
      if (pixels[row][x]) {
        slice |= 1 << (7 - b);
      }
    }
    slices[band] = slice;
  }
  return slices;
};

/** Expand whatever channel layout fast-png decoded (gray, gray+alpha, RGB, RGBA; 8 or 16-bit) into flat 8-bit RGBA. */
const normalizePngToRgba8 = (png: ReturnType<typeof decodePng>): Uint8Array => {
  const { width, height, depth } = png;

  // Palette output from convertIndexedToRgb is already plain 0-255 bytes, regardless
  // of the index bit depth — only raw (non-indexed) samples need the 16-bit rescale.
  let channels: number;
  let readSample: (i: number) => number;
  if (png.palette) {
    const source = convertIndexedToRgb(png);
    channels = source.length / (width * height);
    readSample = i => source[i];
  } else {
    if (depth !== 8 && depth !== 16) {
      throw new Error(`Unsupported PNG bit depth: ${depth}`);
    }
    const source = png.data;
    channels = png.channels;
    readSample = depth === 16 ? i => Math.round(source[i] / 257) : i => source[i];
  }

  const out = new Uint8Array(width * height * 4);
  const pixelCount = width * height;
  for (let p = 0; p < pixelCount; p++) {
    const srcIdx = p * channels;
    const dstIdx = p * 4;
    let r: number;
    let g: number;
    let b: number;
    let a: number;
    if (channels === 4) {
      r = readSample(srcIdx);
      g = readSample(srcIdx + 1);
      b = readSample(srcIdx + 2);
      a = readSample(srcIdx + 3);
    } else if (channels === 3) {
      r = readSample(srcIdx);
      g = readSample(srcIdx + 1);
      b = readSample(srcIdx + 2);
      a = 255;
    } else if (channels === 2) {
      r = g = b = readSample(srcIdx);
      a = readSample(srcIdx + 1);
    } else {
      r = g = b = readSample(srcIdx);
      a = 255;
    }
    out[dstIdx] = r;
    out[dstIdx + 1] = g;
    out[dstIdx + 2] = b;
    out[dstIdx + 3] = a;
  }
  return out;
};

const decodeImageBytes = (
  bytes: Uint8Array,
): { data: Uint8Array; width: number; height: number } => {
  if (hasPngSignature(bytes)) {
    const png = decodePng(bytes);
    return { data: normalizePngToRgba8(png), width: png.width, height: png.height };
  }
  // Fall back to JPEG for everything else (jpeg-js throws on unrecognized data,
  // which is caught by the caller and treated as "no logo available").
  const jpeg = decodeJpeg(bytes, { useTArray: true });
  return { data: jpeg.data, width: jpeg.width, height: jpeg.height };
};

/**
 * Build ESC/POS raster bytes (base64) for thermal printRawData from an image file's
 * base64 content. Supports both PNG and JPEG source images (detected by file signature) —
 * the receipt logo picker can produce either depending on the source photo's format.
 */
export const buildEscPosRasterBase64FromImage = (
  imageBase64: string,
  maxWidth = 384,
): string => {
  const bytes = base64ToBytes(imageBase64);
  const decoded = decodeImageBytes(bytes);
  const resized = resizeRgba(decoded.data, decoded.width, decoded.height, maxWidth);
  const pixels = buildPixelGrid(resized.data, resized.width, resized.height);

  const out: number[] = [
    ...SET_LINE_SPACE_24,
    ...CENTER_ALIGN,
  ];

  for (let y = 0; y < pixels.length; y += 24) {
    out.push(...SELECT_BIT_IMAGE_MODE);
    out.push(resized.width & 0xff);
    out.push((resized.width >> 8) & 0xff);
    for (let x = 0; x < resized.width; x++) {
      out.push(...recollectSlice(y, x, pixels));
    }
    out.push(...LINE_FEED);
  }

  out.push(...SET_LINE_SPACE_32);
  out.push(...LINE_FEED);

  return bytesToBase64(out);
};
