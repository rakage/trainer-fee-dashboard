import { SupportedCurrency } from '@/types';

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
 * @returns Formatted string like "€123.45" or "¥12,345" or "-€123.45"
 */
export function formatAmount(amount: number, currency: SupportedCurrency): string {
  const info = CURRENCY_INFO[currency];
  const roundedAmount = info.decimals === 0 ? Math.round(amount) : amount;
  const isNegative = roundedAmount < 0;
  const absoluteAmount = Math.abs(roundedAmount);
  
  const formattedNumber = absoluteAmount.toLocaleString(info.locale, {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  });

  return isNegative ? `-${info.symbol}${formattedNumber}` : `${info.symbol}${formattedNumber}`;
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
