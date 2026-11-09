import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PurchaseCreateProvider } from '@/context/PurchaseCreateContext';
import { ProductsScreen } from '@/screens/products/ProductsScreen';
import { PurchasesScreen } from '@/screens/products/PurchasesScreen';
import { PurchaseCreateScreen } from '@/screens/products/PurchaseCreateScreen';
import { PurchaseOrderScreen } from '@/screens/products/PurchaseOrderScreen';
import { PurchaseReceiptScreen } from '@/screens/products/PurchaseReceiptScreen';
import { InventoryActivityScreen } from '@/screens/inventory/InventoryActivityScreen';
import { ItemFormScreen } from '@/screens/inventory/ItemFormScreen';
import { ItemSelectScreen } from '@/screens/inventory/ItemSelectScreen';
import { StockAdjustmentScreen } from '@/screens/inventory/StockAdjustmentScreen';
import { ItemBatchesScreen } from '@/screens/inventory/ItemBatchesScreen';
import { ItemHistoryScreen } from '@/screens/inventory/ItemHistoryScreen';
import { AddLocationScreen } from '@/screens/inventory/AddLocationScreen';
import { TogTransferScreen } from '@/screens/inventory/TogTransferScreen';
import { withMobileAccess } from '@/components/common/LockedScreen';
import { MP } from '@/constants/mobilePermissions';
import type { ProductsStackParamList } from './types';

const Stack = createNativeStackNavigator<ProductsStackParamList>();

// Opening an existing item only needs the Products tab — saving needs edit (checked on the form).
const GuardedItemForm = withMobileAccess<
  React.ComponentProps<typeof ItemFormScreen>,
  ProductsStackParamList['ItemForm']
>(ItemFormScreen, params => (params?.itemId ? null : MP.productsAdd));
const GuardedItemSelect = withMobileAccess<
  React.ComponentProps<typeof ItemSelectScreen>,
  ProductsStackParamList['ItemSelect']
>(ItemSelectScreen, params => {
  switch (params?.action) {
    case 'modify':
      return MP.productsEdit;
    case 'adjust':
      return MP.productsStockAdjust;
    case 'history':
      return MP.productsHistory;
    default:
      return null;
  }
});
const GuardedStockAdjustment = withMobileAccess(StockAdjustmentScreen, () => MP.productsStockAdjust);
const GuardedItemHistory = withMobileAccess(ItemHistoryScreen, () => MP.productsHistory);
const GuardedAddLocation = withMobileAccess(AddLocationScreen, () => MP.productsAddLocation);
const GuardedTogTransfer = withMobileAccess(TogTransferScreen, () => MP.productsTog);
const GuardedPurchases = withMobileAccess(PurchasesScreen, () => MP.purchasesView);
const GuardedPurchaseCreate = withMobileAccess(PurchaseCreateScreen, () => MP.purchasesCreate);
const GuardedPurchaseOrder = withMobileAccess(PurchaseOrderScreen, () => MP.purchasesCreate);

export const ProductsStackNavigator: React.FC = () => (
  <PurchaseCreateProvider>
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}>
      <Stack.Screen name="ProductsList" component={ProductsScreen} />
      <Stack.Screen name="InventoryActivity" component={InventoryActivityScreen} />
      <Stack.Screen name="ItemForm" component={GuardedItemForm} />
      <Stack.Screen name="ItemSelect" component={GuardedItemSelect} />
      <Stack.Screen name="StockAdjustment" component={GuardedStockAdjustment} />
      <Stack.Screen name="ItemHistory" component={GuardedItemHistory} />
      <Stack.Screen name="ItemBatches" component={ItemBatchesScreen} />
      <Stack.Screen name="AddLocation" component={GuardedAddLocation} />
      <Stack.Screen name="TogTransfer" component={GuardedTogTransfer} />
      <Stack.Screen name="PurchasesList" component={GuardedPurchases} />
      <Stack.Screen name="PurchaseCreate" component={GuardedPurchaseCreate} />
      <Stack.Screen name="PurchaseOrder" component={GuardedPurchaseOrder} />
      <Stack.Screen name="PurchaseReceipt" component={PurchaseReceiptScreen} />
    </Stack.Navigator>
  </PurchaseCreateProvider>
);
