# Currency Selection Feature Implementation

## Overview
This document describes the implementation of the currency selection feature that allows users to view event reports in different currencies (EUR, JPY, USD, GBP, AUD, CAD, CHF) with automatic conversion.

## Features Implemented

### 1. Currency Selection UI
- **Location**: Dashboard event selection card
- **Component**: `CurrencySelector` dropdown component
- **Position**: Added as a third column in the event details grid, next to trainer name and commission inputs
- **Default Behavior**: Automatically selects the event's native currency when an event is loaded

### 2. Supported Currencies
The following currencies are supported with fixed exchange rates (base: EUR):
- **EUR (€)**: Euro - 1.0 (base)
- **JPY (¥)**: Japanese Yen - 163.5
- **USD ($)**: US Dollar - 1.08
- **GBP (£)**: British Pound - 0.83
- **AUD (A$)**: Australian Dollar - 1.63
- **CAD (C$)**: Canadian Dollar - 1.48
- **CHF**: Swiss Franc - 0.94

### 3. Frontend Display Updates
All monetary values in the dashboard are converted and displayed in the selected currency:

#### Overview Cards
- Trainer Fee
- Cash Sales
- Balance
- Payable Amount

#### Tickets Table
- Ticket Price (individual)
- Ticket Price Total
- Trainer Fee Amount
- Footer totals row

### 4. Export Functionality
All export formats (Excel, CSV, PDF) support currency conversion:

#### Excel (XLSX) Export
- Header includes display currency information
- All monetary values converted to selected currency
- Summary table with converted amounts
- Expenses section with converted amounts
- Overview section with converted amounts
- Trainer splits with converted amounts

#### CSV Export
- Header includes display currency field
- All monetary values converted to selected currency
- Raw numbers for easy import into other systems

#### PDF Export
- Header includes display currency information with conversion note
- Professional formatting with converted amounts
- All sections (summary, expenses, overview, splits) show converted values
- Visual indication when currency conversion was applied

## Technical Implementation

### New Files Created

1. **`src/lib/currency.ts`**
   - Currency conversion utilities
   - Exchange rate definitions
   - Currency formatting functions
   - Supported currency types

2. **`src/components/dashboard/currency-selector.tsx`**
   - Dropdown component for currency selection
   - Shows event's default currency
   - Displays conversion message when applicable

### Modified Files

1. **`src/types/index.ts`**
   - Added `SupportedCurrency` type
   - Added `CurrencyConversion` interface
   - Updated `ExportRequest` to include `displayCurrency`

2. **`src/app/dashboard/dashboard-client.tsx`**
   - Added currency state management
   - Integrated CurrencySelector component
   - Updated ticket table to show converted amounts
   - Updated totals row with conversion
   - Passed displayCurrency to all child components

3. **`src/components/dashboard/overview-cards.tsx`**
   - Added displayCurrency prop
   - Implemented currency conversion for all cards
   - Updated formatting to use new currency utilities

4. **`src/components/dashboard/export-controls.tsx`**
   - Added displayCurrency prop
   - Passed displayCurrency to export API

5. **`src/app/api/events/[prodId]/export/route.ts`**
   - Updated all export functions to accept displayCurrency
   - Implemented conversion in XLSX export
   - Implemented conversion in CSV export
   - Implemented conversion in PDF export
   - Added currency information to export headers

## Currency Conversion Logic

### Conversion Formula
```typescript
// Convert from source currency to EUR (base)
amountInEur = fromCurrency === 'EUR' ? amount : amount / EXCHANGE_RATES[fromCurrency]

// Convert from EUR to target currency
convertedAmount = toCurrency === 'EUR' ? amountInEur : amountInEur * EXCHANGE_RATES[toCurrency]
```

### Formatting Rules
- **EUR, USD, GBP, AUD, CAD, CHF**: 2 decimal places
- **JPY**: 0 decimal places (rounded to nearest whole number)
- Each currency uses its native locale for number formatting

## Usage Instructions

### For Users

1. **Select an Event**: Choose an event from the event picker
2. **Choose Currency**: Use the "Display Currency" dropdown to select your preferred currency
3. **View Converted Amounts**: All amounts on the page update automatically
4. **Export Reports**: Click any export button (Excel, CSV, PDF) to download reports in the selected currency

### Currency Selection Tips
- The dropdown shows "(Event Default)" next to the event's native currency
- A helper text appears when viewing converted amounts: "Event data is in [SOURCE], amounts will be converted to [TARGET]"
- Currency selection persists while viewing the same event
- Switching to a different event resets to that event's default currency

## Important Notes

### Exchange Rates
- Exchange rates are **fixed** in the code (`src/lib/currency.ts`)
- For production use, consider:
  - Integrating with a live exchange rate API (e.g., exchangerate-api.com, fixer.io)
  - Storing historical rates for accurate reporting
  - Adding a "last updated" timestamp for rates
  - Allowing admin users to manually update rates

### Decimal Precision
- All calculations use JavaScript number precision
- Currency conversion happens at display time, not at data storage time
- Original event data remains unchanged in the database

### Performance
- Conversion calculations are lightweight and performed client-side
- No additional API calls required (rates are hardcoded)
- Export generation includes conversion on-the-fly

## Future Enhancements

### Recommended Improvements
1. **Live Exchange Rates**: Integrate with a currency exchange API
2. **Historical Rates**: Store exchange rates with timestamps for accurate historical reporting
3. **User Preferences**: Remember user's preferred currency across sessions
4. **Currency Comparison**: Show original and converted amounts side-by-side
5. **Rate Alerts**: Notify when exchange rates change significantly
6. **Custom Rates**: Allow admin users to set custom conversion rates for specific events
7. **Multi-Currency Events**: Support events with mixed currency ticket sales

## Testing Checklist

- [x] Currency selector appears in dashboard
- [x] Default currency matches event currency
- [x] All currencies are selectable
- [x] Overview cards update when currency changes
- [x] Ticket table amounts convert correctly
- [x] Totals row converts correctly
- [x] Excel export includes converted amounts
- [x] CSV export includes converted amounts
- [x] PDF export includes converted amounts
- [x] Export headers show currency information
- [x] TypeScript compilation passes
- [ ] Manual testing with real events
- [ ] Verify JPY rounding (no decimals)
- [ ] Verify EUR/USD decimals (2 places)
- [ ] Test all export formats download correctly
- [ ] Verify conversion accuracy with calculator

## Related Files

### Dependencies
- **ExcelJS**: For Excel export generation
- **Puppeteer**: For PDF generation
- **csv-stringify**: For CSV generation

### Components Used
- **shadcn/ui Select**: For currency dropdown
- **shadcn/ui Card**: For overview cards display
- **shadcn/ui Label**: For form labels

## Support & Maintenance

For questions or issues regarding the currency selection feature, review:
1. Currency conversion logic in `src/lib/currency.ts`
2. Exchange rate values in `EXCHANGE_RATES` constant
3. Export generation code in `src/app/api/events/[prodId]/export/route.ts`

To update exchange rates, modify the `EXCHANGE_RATES` object in `src/lib/currency.ts`.
