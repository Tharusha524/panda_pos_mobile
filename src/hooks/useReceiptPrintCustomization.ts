import { useEffect, useState } from 'react';
import type { PosMobileSettings } from '@/types/settings';
import {
  DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  type ReceiptPrintCustomization,
} from '@/types/receiptPrint';
import { getReceiptPrintCustomization } from '@/utils/receiptPrintCustomization';

/** Resolves the merged (local device + server) receipt print customization for use
 * in a rendered receipt view — starts at the defaults (which match the app's
 * original built-in look, so there's no visible flash for anyone who hasn't
 * customized anything) and updates once the on-device setting loads. */
export const useReceiptPrintCustomization = (
  settings?: PosMobileSettings | null,
): ReceiptPrintCustomization => {
  const [customization, setCustomization] = useState<ReceiptPrintCustomization>(
    DEFAULT_RECEIPT_PRINT_CUSTOMIZATION,
  );

  useEffect(() => {
    let active = true;
    getReceiptPrintCustomization(settings).then(resolved => {
      if (active) {
        setCustomization(resolved);
      }
    });
    return () => {
      active = false;
    };
  }, [settings]);

  return customization;
};
