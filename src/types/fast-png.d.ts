// `fast-png` ships an ESM "exports" map with co-located .d.ts files, which this project's
// tsconfig (moduleResolution: "node") can't resolve. Declared manually to avoid changing
// the project-wide module resolution strategy.
declare module 'fast-png' {
  export type PngDataArray = Uint8Array | Uint8ClampedArray | Uint16Array;

  export interface DecodedPng {
    width: number;
    height: number;
    data: PngDataArray;
    depth: 1 | 2 | 4 | 8 | 16;
    channels: number;
    palette?: number[][];
  }

  export function decode(data: Uint8Array | ArrayBufferLike): DecodedPng;
  export function convertIndexedToRgb(decodedImage: DecodedPng): Uint8Array;
  export function hasPngSignature(data: Uint8Array): boolean;
}
