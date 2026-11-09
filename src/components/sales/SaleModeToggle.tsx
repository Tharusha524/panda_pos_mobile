import React, { useMemo } from 'react';
import { Lock, Repeat, RotateCcw, ShoppingCart } from 'lucide-react-native';
import { PaperSegmentFilter } from '@/components/common/PaperSegmentFilter';
import { colors } from '@/theme';
import type { SaleTransactionMode } from '@/types/sales';

interface SaleModeToggleProps {
  mode: SaleTransactionMode;
  onChange: (mode: SaleTransactionMode) => void;
  compact?: boolean;
  /** Shown with a lock icon; selecting one is left to `onChange` to refuse. */
  lockedModes?: SaleTransactionMode[];
}

const SALE_MODE_OPTIONS = [
  {
    value: 'sale' as const,
    label: 'New Sale',
    Icon: ShoppingCart,
    checkedColor: colors.primary,
  },
  {
    value: 'return' as const,
    label: 'Return',
    Icon: RotateCcw,
    checkedColor: colors.text,
  },
  {
    value: 'exchange' as const,
    label: 'Exchange',
    Icon: Repeat,
    checkedColor: colors.warning,
  },
];

export const SaleModeToggle: React.FC<SaleModeToggleProps> = ({
  mode,
  onChange,
  compact = false,
  lockedModes,
}) => {
  const options = useMemo(
    () =>
      lockedModes?.length
        ? SALE_MODE_OPTIONS.map(o =>
            lockedModes.includes(o.value) ? { ...o, Icon: Lock } : o,
          )
        : SALE_MODE_OPTIONS,
    [lockedModes],
  );

  return (
    <PaperSegmentFilter
      options={options}
      selected={mode}
      onSelect={onChange}
      title={compact ? '' : 'Transaction type'}
    />
  );
};
