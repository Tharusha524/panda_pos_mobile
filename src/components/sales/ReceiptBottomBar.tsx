import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';

interface ReceiptActionsProps {
  onPrint?: () => void;
  onNewSale?: () => void;
  printLoading?: boolean;
  showPrint?: boolean;
  /** Label for the secondary button — defaults to "New sale" for the sale receipt
   * flow; other receipt screens (e.g. payment receipt) pass their own, like "Done". */
  secondaryLabel?: string;
}

export const ReceiptActions: React.FC<ReceiptActionsProps> = ({
  onPrint,
  onNewSale,
  printLoading = false,
  showPrint = true,
  secondaryLabel = 'New sale',
}) => {
  if (!showPrint || !onPrint) {
    return onNewSale ? (
      <View style={styles.wrap}>
        <PrimaryButton label={secondaryLabel} onPress={onNewSale} />
      </View>
    ) : null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.col}>
          <PrimaryButton
            label={printLoading ? 'Printing…' : 'Print receipt'}
            onPress={onPrint}
            loading={printLoading}
            disabled={printLoading}
          />
        </View>
        {onNewSale ? (
          <View style={styles.col}>
            <PrimaryButton label={secondaryLabel} variant="outline" onPress={onNewSale} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

/** @deprecated use ReceiptActions */
export const ReceiptBottomBar = ReceiptActions;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
});
