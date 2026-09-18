import React from 'react';
import { RotateCcw, ShoppingCart } from 'lucide-react-native';
import { PaperSegmentFilter } from '@/components/common/PaperSegmentFilter';
import { colors } from '@/theme';

export type ExchangeAddMode = 'sale' | 'return';

interface ExchangeAddModeToggleProps {
  mode: ExchangeAddMode;
  onChange: (mode: ExchangeAddMode) => void;
  saleCount: number;
  returnCount: number;
}

const OPTIONS = (saleCount: number, returnCount: number) => [
  {
    value: 'sale' as const,
    label: 'New Sale',
    Icon: ShoppingCart,
    checkedColor: colors.primary,
    badge: saleCount || undefined,
  },
  {
    value: 'return' as const,
    label: 'Return',
    Icon: RotateCcw,
    checkedColor: colors.error,
    badge: returnCount || undefined,
  },
];

/**
 * Exchange mode only — lets the cashier pick which direction tapping a product
 * in the (shared) product grid below adds it as. Replaces the old "pick a bill
 * first" flow: return items are now picked straight from the catalog, same as
 * new-sale items, with no original-bill lookup involved.
 */
export const ExchangeAddModeToggle: React.FC<ExchangeAddModeToggleProps> = ({
  mode,
  onChange,
  saleCount,
  returnCount,
}) => (
  <PaperSegmentFilter
    options={OPTIONS(saleCount, returnCount)}
    selected={mode}
    onSelect={onChange}
    title="Adding to cart as"
  />
);
