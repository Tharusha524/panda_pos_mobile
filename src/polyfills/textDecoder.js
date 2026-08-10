/**
 * Hermes (React Native's JS engine) doesn't provide the Web `TextDecoder` API.
 * fast-png (used by escPosRasterImage to decode logo/title PNGs before printing)
 * calls `new TextDecoder('latin1')` at module-load time to read optional PNG text
 * metadata chunks — without this, that throws "Property 'TextDecoder' doesn't
 * exist" and crashes the whole app the moment any PNG with such a chunk is
 * printed (seen with screenshots captured for the custom-size company-name
 * image, which reliably include one).
 *
 * Only 'latin1' decoding is needed here, which is a direct 1:1 byte-to-codepoint
 * mapping — no need to pull in a full text-encoding polyfill library for it.
 */
if (typeof global.TextDecoder === 'undefined') {
  class MinimalLatin1TextDecoder {
    constructor(encoding) {
      this.encoding = encoding;
    }

    decode(bytes) {
      let result = '';
      for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i]);
      }
      return result;
    }
  }

  global.TextDecoder = MinimalLatin1TextDecoder;
}
