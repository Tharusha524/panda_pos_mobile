import type { NavigatorScreenParams } from '@react-navigation/native';
import type { PurchaseReceiptPayload } from '@/types/inventory';
import type { ItemSelectAction } from '@/types/inventory';
import type { SaleReceiptPayload } from '@/types/sales';
import type { PaymentReceiptPayload } from '@/types/customers';
import type { PaymentDetailPayload } from '@/types/payments';
import type { SystemReportType, ReportCategoryId } from '@/types/reports';

export type TodayActivityTab = 'sales' | 'purchases' | 'reorder';

/** Passed to a receipt screen to put it in "review before saving" mode instead
 * of its normal "already saved, print/share/download" mode — used so the
 * confirm-before-save review reuses the real receipt screen's own layout
 * (already correct/proven) instead of squeezing a receipt into a small popup. */
export interface PendingConfirm {
  title: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onEdit: () => void;
}

export type HomeStackParamList = {
  Dashboard: undefined;
  TodayActivity: { tab?: TodayActivityTab } | undefined;
  AlertsList: undefined;
  CustomersList: { filterByBalance?: boolean } | undefined;
  CustomerForm: { customerId?: number; selectOnSave?: boolean };
  CustomerReceivePayment: { customerId: number };
  CustomerHistory: { customerId: number };
  CustomerSaleReceipt: { receipt: SaleReceiptPayload; customerId?: number | null };
  PaymentReceipt: { receipt: PaymentReceiptPayload; pendingConfirm?: PendingConfirm };
  PaymentDetailReceipt: { payment: PaymentDetailPayload };
  ExpensesList: undefined;
  ExpenseForm: { expenseId?: number };
};

export type ReportsStackParamList = {
  ReportsList: undefined;
  ReportCategory: { categoryId: ReportCategoryId };
  ReportView: { type: SystemReportType };
};

export type AuthStackParamList = {
  Opening: undefined;
  BackendConfig: { fromSettings?: boolean } | undefined;
  Login: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type SalesStackParamList = {
  SalesPOS: undefined;
  SaleOrder: undefined;
  SaleReceipt: {
    receipt: SaleReceiptPayload;
    customerId?: number | null;
    pendingConfirm?: PendingConfirm;
  };
  HoldOrders: undefined;
  CustomerForm: { customerId?: number; selectOnSave?: boolean };
};

export type ProductsStackParamList = {
  ProductsList: undefined;
  InventoryActivity: undefined;
  ItemForm: { itemId?: number };
  ItemSelect: { action: ItemSelectAction };
  StockAdjustment: { itemId: number };
  ItemHistory: { itemId: number };
  ItemBatches: { itemId: number };
  AddLocation: undefined;
  TogTransfer: undefined;
  PurchasesList: undefined;
  PurchaseCreate: undefined;
  PurchaseOrder: undefined;
  PurchaseReceipt: { receipt: PurchaseReceiptPayload; pendingConfirm?: PendingConfirm };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  BackendConfig: { fromSettings?: boolean } | undefined;
  CompanySettings: undefined;
  InventorySettings: undefined;
  OrderSettings: undefined;
  AlertSettings: undefined;
  NotificationsSettings: undefined;
  UserProfile: undefined;
  PrinterSetup: undefined;
  ReceiptCustomize: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Sales: NavigatorScreenParams<SalesStackParamList> | undefined;
  Products: NavigatorScreenParams<ProductsStackParamList> | undefined;
  Reports: NavigatorScreenParams<ReportsStackParamList> | undefined;
  Profile: NavigatorScreenParams<SettingsStackParamList> | undefined;
};
