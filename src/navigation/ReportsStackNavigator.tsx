import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReportsListScreen } from '@/screens/reports/ReportsListScreen';
import { ReportViewScreen } from '@/screens/reports/ReportViewScreen';
import { ReportCategoryScreen } from '@/screens/reports/ReportCategoryScreen';
import { DayEndReportScreen } from '@/screens/reports/DayEndReportScreen';
import { CustomerSaleReceiptScreen } from '@/screens/customers/CustomerSaleReceiptScreen';
import { withMobileAccess } from '@/components/common/LockedScreen';
import { MP, reportPermission } from '@/constants/mobilePermissions';
import type { ReportsStackParamList } from './types';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

const GuardedReportView = withMobileAccess<
  React.ComponentProps<typeof ReportViewScreen>,
  ReportsStackParamList['ReportView']
>(ReportViewScreen, params => (params?.type ? reportPermission(params.type) : MP.reports));
const GuardedDayEnd = withMobileAccess(DayEndReportScreen, () => MP.reportsDayEnd);

export const ReportsStackNavigator: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    }}>
    <Stack.Screen name="ReportsList" component={ReportsListScreen} />
    <Stack.Screen name="ReportCategory" component={ReportCategoryScreen} />
    <Stack.Screen name="ReportView" component={GuardedReportView} />
    <Stack.Screen name="DayEndReport" component={GuardedDayEnd} />
    <Stack.Screen name="CustomerSaleReceipt" component={CustomerSaleReceiptScreen} />
  </Stack.Navigator>
);
