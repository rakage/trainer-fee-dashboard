import { SupportedCurrency } from '@/types';

// Fixed exchange rates (base: EUR)
// In production, these should be fetched from an API or updated regularly
export const EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  EUR: 1.0,
  JPY: 163.5,  // 1 EUR = 163.5 JPY
  USD: 1.08,   // 1 EUR = 1.08 USD
  GBP: 0.83,   // 1 EUR = 0.83 GBP
  AUD: 1.63,   // 1 EUR = 1.63 AUD
  CAD: 1.48,   // 1 EUR = 1.48 CAD
  CHF: 0.94,   // 1 EUR = 0.94 CHF
};

// Currency display information
export const CURRENCY_INFO: Record<SupportedCurrency, { symbol: string; locale: string; decimals: number }> = {
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
  JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
  AUD: { symbol: 'A$', locale: 'en-AU', decimals: 2 },
  CAD: { symbol: 'C$', locale: 'en-CA', decimals: 2 },
  CHF: { symbol: 'CHF', locale: 'de-CH', decimals: 2 },
};

/**
 * Convert amount from one currency to another
 * @param amount - Amount in source currency
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: SupportedCurrency,
  toCurrency: SupportedCurrency
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Convert to EUR first (base currency), then to target
  const amountInEur = fromCurrency === 'EUR' ? amount : amount / EXCHANGE_RATES[fromCurrency];
  const convertedAmount = toCurrency === 'EUR' ? amountInEur : amountInEur * EXCHANGE_RATES[toCurrency];

  return convertedAmount;
}

/**
 * Format amount in specified currency
 * @param amount - Amount to format
 * @param currency - Currency to format in
 * @returns Formatted string
 */
export function formatCurrencyAmount(amount: number, currency: SupportedCurrency): string {
  const info = CURRENCY_INFO[currency];
  const roundedAmount = info.decimals === 0 ? Math.round(amount) : amount;

  return new Intl.NumberFormat(info.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(roundedAmount);
}

/**
 * Format amount with symbol prefix (for tables)
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted string like "€123.45" or "¥12,345"
 */
export function formatAmount(amount: number, currency: SupportedCurrency): string {
  const info = CURRENCY_INFO[currency];
  const roundedAmount = info.decimals === 0 ? Math.round(amount) : amount;
  const formattedNumber = roundedAmount.toLocaleString(info.locale, {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  });

  return `${info.symbol}${formattedNumber}`;
}

/**
 * Get currency symbol
 * @param currency - Currency code
 * @returns Currency symbol
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_INFO[currency].symbol;
}

/**
 * Get all supported currencies as options for select dropdown
 * @returns Array of currency options
 */
export function getCurrencyOptions(): Array<{ value: SupportedCurrency; label: string }> {
  return [
    { value: 'EUR', label: 'EUR (€) - Euro' },
    { value: 'JPY', label: 'JPY (¥) - Japanese Yen' },
    { value: 'USD', label: 'USD ($) - US Dollar' },
    { value: 'GBP', label: 'GBP (£) - British Pound' },
    { value: 'AUD', label: 'AUD (A$) - Australian Dollar' },
    { value: 'CAD', label: 'CAD (C$) - Canadian Dollar' },
    { value: 'CHF', label: 'CHF - Swiss Franc' },
  ];
}
