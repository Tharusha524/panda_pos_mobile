import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { CompanySettingsScreen } from '@/screens/settings/CompanySettingsScreen';
import { InventorySettingsScreen } from '@/screens/settings/InventorySettingsScreen';
import { OrderSettingsScreen } from '@/screens/settings/OrderSettingsScreen';
import { AlertSettingsScreen } from '@/screens/settings/AlertSettingsScreen';
import { NotificationsSettingsScreen } from '@/screens/settings/NotificationsSettingsScreen';
import { UserProfileScreen } from '@/screens/settings/UserProfileScreen';
import { PrinterSetupScreen } from '@/screens/settings/PrinterSetupScreen';
import { ReceiptCustomizeScreen } from '@/screens/settings/ReceiptCustomizeScreen';
import { BackendConfigScreen } from '@/screens/auth/BackendConfigScreen';
import { withMobileAccess } from '@/components/common/LockedScreen';
import { MP } from '@/constants/mobilePermissions';
import type { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

const GuardedCompany = withMobileAccess(CompanySettingsScreen, () => MP.settingsCompany);
const GuardedInventory = withMobileAccess(InventorySettingsScreen, () => MP.settingsInventory);
const GuardedOrder = withMobileAccess(OrderSettingsScreen, () => MP.settingsOrders);
const GuardedAlert = withMobileAccess(AlertSettingsScreen, () => MP.settingsAlerts);
const GuardedNotifications = withMobileAccess(
  NotificationsSettingsScreen,
  () => MP.settingsNotifications,
);
const GuardedPrinter = withMobileAccess(PrinterSetupScreen, () => MP.settingsPrinter);
const GuardedReceiptLayout = withMobileAccess(
  ReceiptCustomizeScreen,
  () => MP.settingsReceiptLayout,
);
const GuardedServer = withMobileAccess(BackendConfigScreen, () => MP.settingsServer);

export const SettingsStackNavigator: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    }}>
    <Stack.Screen name="SettingsHome" component={SettingsScreen} />
    <Stack.Screen name="CompanySettings" component={GuardedCompany} />
    <Stack.Screen name="InventorySettings" component={GuardedInventory} />
    <Stack.Screen name="OrderSettings" component={GuardedOrder} />
    <Stack.Screen name="AlertSettings" component={GuardedAlert} />
    <Stack.Screen name="NotificationsSettings" component={GuardedNotifications} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    <Stack.Screen name="PrinterSetup" component={GuardedPrinter} />
    <Stack.Screen name="ReceiptCustomize" component={GuardedReceiptLayout} />
    <Stack.Screen name="BackendConfig" component={GuardedServer} />
  </Stack.Navigator>
);
