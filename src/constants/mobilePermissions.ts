import type { MainTabParamList } from '@/navigation/types';

/**
 * Mobile permission keys. Must match PermissionService::MOBILE_CATALOG in the
 * Laravel backend — the website role editor sets them per role.
 */
export const MP = {
  home: 'mobile.home',
  homeFigures: 'mobile.home.figures',
  homeTodayActivity: 'mobile.home.today_activity',
  homePrintDaily: 'mobile.home.print_daily',
  homeAlerts: 'mobile.home.alerts',
  customersView: 'mobile.customers.view',
  customersCreate: 'mobile.customers.create',
  customersEdit: 'mobile.customers.edit',
  customersDelete: 'mobile.customers.delete',
  customersLocation: 'mobile.customers.location',
  customersReceivePayment: 'mobile.customers.receive_payment',
  customersStatement: 'mobile.customers.statement',
  customersHistory: 'mobile.customers.history',
  customersChequeReturn: 'mobile.customers.cheque_return',
  expensesView: 'mobile.expenses.view',
  expensesCreate: 'mobile.expenses.create',
  expensesEdit: 'mobile.expenses.edit',
  expensesDelete: 'mobile.expenses.delete',

  sales: 'mobile.sales',
  salesCreateCustomer: 'mobile.sales.create_customer',
  salesDiscount: 'mobile.sales.discount',
  salesCredit: 'mobile.sales.credit',
  salesCheque: 'mobile.sales.cheque',
  salesBank: 'mobile.sales.bank',
  salesSplit: 'mobile.sales.split',
  salesReturn: 'mobile.sales.return',
  salesReturnWithoutBill: 'mobile.sales.return_without_bill',
  salesExchange: 'mobile.sales.exchange',
  salesHold: 'mobile.sales.hold',
  salesHoldDelete: 'mobile.sales.hold_delete',
  salesEdit: 'mobile.sales.edit',
  salesShareReceipt: 'mobile.sales.share_receipt',

  products: 'mobile.products',
  productsAdd: 'mobile.products.add',
  productsEdit: 'mobile.products.edit',
  productsHistory: 'mobile.products.history',
  productsBatches: 'mobile.products.batches',
  productsBatchDelete: 'mobile.products.batch_delete',
  productsStockAdjust: 'mobile.products.stock_adjust',
  productsTog: 'mobile.products.tog',
  productsAddLocation: 'mobile.products.add_location',
  purchasesView: 'mobile.purchases.view',
  purchasesCreate: 'mobile.purchases.create',
  purchasesPrint: 'mobile.purchases.print',

  reports: 'mobile.reports',
  reportsDayEnd: 'mobile.reports.day_end',
  reportsPrint: 'mobile.reports.print',
  reportsExport: 'mobile.reports.export',

  settings: 'mobile.settings',
  settingsCompany: 'mobile.settings.company',
  settingsInventory: 'mobile.settings.inventory',
  settingsOrders: 'mobile.settings.orders',
  settingsPrinter: 'mobile.settings.printer',
  settingsReceiptLayout: 'mobile.settings.receipt_layout',
  settingsNotifications: 'mobile.settings.notifications',
  settingsAlerts: 'mobile.settings.alerts',
  settingsEmployees: 'mobile.settings.employees',
  settingsServer: 'mobile.settings.server',
} as const;

export type MobilePermissionKey = (typeof MP)[keyof typeof MP] | `mobile.reports.${string}`;

/** Report screen ids (SystemReportType) map 1:1 to `mobile.reports.<id>`. */
export const reportPermission = (reportId: string): MobilePermissionKey =>
  `mobile.reports.${reportId}`;

/** Permission a sale payment method needs (same matching as the server), or null if always allowed. */
export const paymentMethodPermission = (method: string): MobilePermissionKey | null => {
  const m = method.trim().toLowerCase();
  if (m === 'split') return MP.salesSplit;
  if (m.includes('credit')) return MP.salesCredit;
  if (m.includes('cheque') || m.includes('check')) return MP.salesCheque;
  if (m.includes('bank')) return MP.salesBank;
  return null;
};

/** The Settings tab itself never locks — users must always reach profile & sign out. */
export const TAB_PERMISSION: Record<keyof MainTabParamList, MobilePermissionKey | null> = {
  Home: MP.home,
  Sales: MP.sales,
  Products: MP.products,
  Reports: MP.reports,
  Profile: null,
};

export const TAB_ORDER: (keyof MainTabParamList)[] = [
  'Home',
  'Sales',
  'Products',
  'Reports',
  'Profile',
];

/** Style for a locked custom button — it stays tappable to show the locked message. */
export const LOCKED_STYLE = { opacity: 0.4 } as const;

export const LOCKED_TITLE = 'Locked';
export const LOCKED_MESSAGE =
  "You don't have access to this feature. Contact your admin.";
