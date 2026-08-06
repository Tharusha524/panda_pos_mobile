/** Default ISO currency for all mobile amounts */
export const DEFAULT_CURRENCY = 'LKR';

const CURRENCY_ALIASES: Record<string, string> = {
  rs: 'LKR',
  'rs.': 'LKR',
  rupee: 'LKR',
  rupees: 'LKR',
  lkr: 'LKR',
  'sri lankan rupee': 'LKR',
  'sri lanka rupee': 'LKR',
  usd: 'USD',
  '$': 'USD',
  dollar: 'USD',
  dollars: 'USD',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  gbp: 'GBP',
  pound: 'GBP',
  aed: 'AED',
  sar: 'SAR',
  inr: 'INR',
};

/** Normalize backend / legacy labels to a valid ISO 4217 code */
export const resolveCurrencyCode = (code?: string | null): string => {
  if (!code?.trim()) {
    return DEFAULT_CURRENCY;
  }
  const trimmed = code.trim();
  const alias = CURRENCY_ALIASES[trimmed.toLowerCase()];
  if (alias) {
    return alias;
  }
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return DEFAULT_CURRENCY;
};

const localeForCurrency = (currency: string): string =>
  currency === 'LKR' ? 'en-LK' : 'en-US';

export const formatCurrency = (
  value?: number | null,
  currency?: string | null,
): string => {
  const code = resolveCurrencyCode(currency);
  const amount = value ?? 0;
  try {
    return new Intl.NumberFormat(localeForCurrency(code), {
      style: 'currency',
      currency: code,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
    }).format(amount);
  }
};

/** Symbol or code for labels — e.g. "Rs.", "$", "LKR" */
export const getCurrencyLabel = (currency?: string | null): string => {
  const code = resolveCurrencyCode(currency);
  try {
    const parts = new Intl.NumberFormat(localeForCurrency(code), {
      style: 'currency',
      currency: code,
    }).formatToParts(0);
    const symbol = parts.find(part => part.type === 'currency')?.value?.trim();
    return symbol && symbol !== code ? symbol : code;
  } catch {
    return code;
  }
};

/** Receipt / Bluetooth print lines — same localized currency as on-screen prices */
export const formatPrintAmount = (
  value?: number | null,
  currency?: string | null,
): string => formatCurrency(value, currency);

/** Plain "1,234.56" with no currency code/symbol — for receipt layouts that omit it. */
export const formatPlainAmount = (value?: number | null): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

export const formatNumber = (value?: number | null): string => {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
};

/**
 * Parse a backend timestamp correctly. Laravel/Carbon sends "YYYY-MM-DD HH:mm:ss" in
 * UTC with no timezone marker. JS treats a date-TIME string with no offset as LOCAL
 * time, not UTC — silently throwing every displayed/relative time off by the device's
 * UTC offset (e.g. ~5.5h for Sri Lanka). Force UTC only when there's a time component
 * and no explicit marker already; leave date-only or already-tagged strings untouched.
 */
export const parseBackendTimestamp = (dateStr: string): Date => {
  const isoCandidate = dateStr.trim().replace(' ', 'T');
  const hasTimeComponent = /T\d{2}:\d{2}/.test(isoCandidate);
  const hasTimezoneMarker = /Z$|[+-]\d{2}:?\d{2}$/.test(isoCandidate);
  const parseable =
    hasTimeComponent && !hasTimezoneMarker ? `${isoCandidate}Z` : isoCandidate;
  return new Date(parseable);
};

export const formatRelativeTime = (dateStr?: string | null): string => {
  if (!dateStr) {
    return '—';
  }
  const date = parseBackendTimestamp(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

export const computeRevenueChange = (
  chart: { sales_amount: number }[],
): string | undefined => {
  if (chart.length < 2) {
    return undefined;
  }
  const yesterday = chart[chart.length - 2]?.sales_amount ?? 0;
  const today = chart[chart.length - 1]?.sales_amount ?? 0;

  if (yesterday === 0) {
    return today > 0 ? 'New sales today' : undefined;
  }

  const pct = ((today - yesterday) / yesterday) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs yesterday`;
};
