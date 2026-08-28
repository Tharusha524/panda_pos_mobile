/**
 * React Native doesn't provide Node's global `Buffer`. exceljs (used by
 * dailySalesExcel to build the styled Daily Sale Report workbook) assumes
 * it's available even in its browser-targeted bundle — without this, building
 * the workbook throws "Property 'Buffer' doesn't exist" the moment the user
 * taps Download/Share Excel.
 */
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
