import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { TodayActivityScreen } from '@/screens/dashboard/TodayActivityScreen';
import { AlertsScreen } from '@/screens/alerts/AlertsScreen';
import { CustomersScreen } from '@/screens/customers/CustomersScreen';
import { ExpensesScreen } from '@/screens/expenses/ExpensesScreen';
import { ExpenseFormScreen } from '@/screens/expenses/ExpenseFormScreen';
import { CustomerFormScreen } from '@/screens/customers/CustomerFormScreen';
import { CustomerReceivePaymentScreen } from '@/screens/customers/CustomerReceivePaymentScreen';
import { CustomerHistoryScreen } from '@/screens/customers/CustomerHistoryScreen';
import { CustomerSaleReceiptScreen } from '@/screens/customers/CustomerSaleReceiptScreen';
import { PaymentReceiptScreen } from '@/screens/customers/PaymentReceiptScreen';
import { PaymentDetailReceiptScreen } from '@/screens/customers/PaymentDetailReceiptScreen';
import { ChequeReturnReceiptScreen } from '@/screens/customers/ChequeReturnReceiptScreen';
import { withMobileAccess } from '@/components/common/LockedScreen';
import { MP } from '@/constants/mobilePermissions';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const GuardedAlerts = withMobileAccess(AlertsScreen, () => MP.homeAlerts);
const GuardedTodayActivity = withMobileAccess(TodayActivityScreen, () => MP.homeTodayActivity);
const GuardedCustomers = withMobileAccess(CustomersScreen, () => MP.customersView);
// Opening an existing customer only needs view — saving changes needs edit (checked on the form).
const GuardedCustomerForm = withMobileAccess<
  React.ComponentProps<typeof CustomerFormScreen>,
  HomeStackParamList['CustomerForm']
>(CustomerFormScreen, params => (params?.customerId ? MP.customersView : MP.customersCreate));
const GuardedReceivePayment = withMobileAccess(
  CustomerReceivePaymentScreen,
  () => MP.customersReceivePayment,
);
const GuardedCustomerHistory = withMobileAccess(CustomerHistoryScreen, () => MP.customersHistory);
const GuardedExpenses = withMobileAccess(ExpensesScreen, () => MP.expensesView);
const GuardedExpenseForm = withMobileAccess<
  React.ComponentProps<typeof ExpenseFormScreen>,
  HomeStackParamList['ExpenseForm']
>(ExpenseFormScreen, params => (params?.expenseId ? MP.expensesView : MP.expensesCreate));

export const HomeStackNavigator: React.FC = () => (
  <Stack.Navigator
    id="HomeStack"
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    }}>
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="AlertsList" component={GuardedAlerts} />
    <Stack.Screen name="TodayActivity" component={GuardedTodayActivity} />
    <Stack.Screen name="CustomersList" component={GuardedCustomers} />
    <Stack.Screen name="CustomerForm" component={GuardedCustomerForm} />
    <Stack.Screen
      name="CustomerReceivePayment"
      component={GuardedReceivePayment}
    />
    <Stack.Screen name="CustomerHistory" component={GuardedCustomerHistory} />
    <Stack.Screen name="CustomerSaleReceipt" component={CustomerSaleReceiptScreen} />
    <Stack.Screen name="PaymentReceipt" component={PaymentReceiptScreen} />
    <Stack.Screen name="PaymentDetailReceipt" component={PaymentDetailReceiptScreen} />
    <Stack.Screen name="ChequeReturnReceipt" component={ChequeReturnReceiptScreen} />
    <Stack.Screen name="ExpensesList" component={GuardedExpenses} />
    <Stack.Screen name="ExpenseForm" component={GuardedExpenseForm} />
  </Stack.Navigator>
);
