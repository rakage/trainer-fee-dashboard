# Currency Handling Implementation for Grace Events in Japan

## Overview
This document summarizes the changes made to implement JPY currency display for Grace trainer events in Japan, ensuring all totals, expenses, and trainer splits show amounts in JPY instead of EUR.

## Changes Made

### 1. Export Route Updates (`src/app/api/events/[prodId]/export/route.ts`)

#### PDF Export
- Added dynamic currency detection for Grace + Japan combination
- Added `formatAmount` helper function that formats amounts as JPY (¥) with Japanese locale or EUR (€) with German locale
- Updated all monetary displays in PDF HTML template:
  - Event summary table (ticket prices, totals, trainer fees)
  - Grand totals row
  - Expenses section
  - Overview section (trainer fee, cash sales, balance, receivable)
  - Trainer splits section

#### XLSX Export
- Added same currency detection logic as PDF
- Updated all worksheet cells containing monetary values to use `formatAmount` function
- Applied formatting to:
  - Summary data rows
  - Grand total row
  - Expenses data and totals
  - Overview section
  - Trainer splits data

### 2. Dashboard Components Updates

#### Overview Cards (`src/components/dashboard/overview-cards.tsx`)
- Already had proper currency support using `event.Currency` property
- Uses `formatCurrency` function with dynamic locale and currency options
- Displays JPY with Japanese locale (ja-JP) or EUR with German locale (de-DE)

#### Trainer Splits Editor (`src/components/dashboard/trainer-splits.tsx`)
- Added currency detection using `event.Currency` property
- Updated `formatCurrency` calls to use event-specific format options
- Applied to payable amount display in splits table

#### Expenses Editor (`src/components/dashboard/expenses-editor.tsx`)
- Added currency detection using `event.Currency` property
- Updated all `formatCurrency` calls to use event-specific format options
- Applied to:
  - Total expenses display
  - Margin calculation display
  - Trainer fee total display

#### Dashboard Page (`src/app/dashboard/page.tsx`)
- Updated hardcoded EUR symbols in tickets table footer
- Added dynamic currency formatting for:
  - Total price (grand total of all tickets)
  - Total trainer fee (grand total of all trainer fees)
- Uses same logic as individual ticket rows (JPY or EUR based on event currency)

### 3. Existing Currency Infrastructure

#### Database Service (`src/lib/database.ts`)
- Already had JPY conversion logic for Grace events in Japan
- Sets `event.Currency = 'JPY'` when trainer name contains 'grace' and country is Japan
- Converts ticket prices from EUR to JPY using stored conversion rates

#### Utils (`src/lib/utils.ts`)
- Already had `formatCurrency` function with dynamic locale and currency support
- Takes format options: `{ locale: string, currency: string }`
- Supports both EUR (de-DE locale) and JPY (ja-JP locale) formatting

## Implementation Logic

### Currency Detection
The system detects when to use JPY currency based on two criteria:
1. **Trainer Name**: Contains "grace" (case-insensitive)
2. **Country**: Contains "japan" (case-insensitive)

When both conditions are met:
- Currency is set to JPY (¥)
- Amounts are formatted with Japanese locale (ja-JP)
- Numbers are rounded (no decimals) and use Japanese number formatting

Otherwise:
- Currency remains EUR (€)
- Amounts are formatted with German locale (de-DE)
- Numbers show 2 decimal places

### Formatting Functions

#### In Export Routes
```javascript
const formatAmount = (amount: number) => {
  return isGrace && isJapan ? 
    `¥${Math.round(amount).toLocaleString('ja-JP')}` : 
    `€${amount.toFixed(2)}`;
};
```

#### In Components
```javascript
const formatOptions = { 
  locale: currency === 'JPY' ? 'ja-JP' : 'de-DE', 
  currency 
};
formatCurrency(amount, formatOptions)
```

## Files Modified

1. `src/app/api/events/[prodId]/export/route.ts` - Export functions (PDF, XLSX)
2. `src/components/dashboard/trainer-splits.tsx` - Trainer splits editor
3. `src/components/dashboard/expenses-editor.tsx` - Expenses editor  
4. `src/app/dashboard/page.tsx` - Dashboard main page totals

## Testing

The implementation has been built successfully and is ready for testing with Grace events in Japan. All monetary amounts should now display consistently in JPY across:

- Dashboard overview cards
- Tickets table and totals
- Expenses section
- Trainer splits section
- PDF exports
- XLSX exports

## Notes

- The CSV export function was not modified as it doesn't contain specific currency formatting
- The existing Grace price conversion system in the database continues to work as before
- All changes are backward compatible with existing EUR events
- The system automatically detects and applies the correct currency based on trainer and country