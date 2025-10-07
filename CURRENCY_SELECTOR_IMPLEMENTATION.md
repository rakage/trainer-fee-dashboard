# Currency Selection Feature Implementation

## Overview
This document describes the implementation of the currency selection feature that allows users to view event reports with different currency symbols and formatting (EUR, JPY, USD, GBP, AUD, CAD, CHF). **Note: This feature changes only the display currency symbol and formatting - amounts are NOT converted.**

## Features Implemented

### 1. Currency Selection UI
- **Location**: Dashboard event selection card
- **Component**: `CurrencySelector` dropdown component
- **Position**: Added as a third column in the event details grid, next to trainer name and commission inputs
- **Default Behavior**: Automatically selects the event's native currency when an event is loaded

### 2. Supported Currencies
The following currencies are supported for display formatting:
- **EUR (€)**: Euro
- **JPY (¥)**: Japanese Yen
- **USD ($)**: US Dollar
- **GBP (£)**: British Pound
- **AUD (A$)**: Australian Dollar
- **CAD (C$)**: Canadian Dollar
- **CHF**: Swiss Franc

### 3. Frontend Display Updates
All monetary values in the dashboard are displayed with the selected currency symbol and formatting (amounts remain unchanged):

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
All export formats (Excel, CSV, PDF) use the selected currency for display:

#### Excel (XLSX) Export
- Header includes display currency information
- All monetary values formatted with selected currency symbol
- Summary table with selected currency
- Expenses section with selected currency
- Overview section with selected currency
- Trainer splits with selected currency

#### CSV Export
- Header includes display currency field
- Raw numbers remain unchanged
- Currency field indicates the display format

#### PDF Export
- Header includes display currency information
- Professional formatting with selected currency symbol
- All sections (summary, expenses, overview, splits) show selected currency
- Amounts remain in their original values

## Technical Implementation

### New Files Created

1. **`src/lib/currency.ts`**
   - Currency formatting utilities
   - Currency display information (symbols, locales, decimals)
   - Formatting functions for different currencies
   - Supported currency types

2. **`src/components/dashboard/currency-selector.tsx`**
   - Dropdown component for currency selection
   - Shows event's default currency
   - Displays message that amounts are not converted

### Modified Files

1. **`src/types/index.ts`**
   - Added `SupportedCurrency` type
   - Added `CurrencyConversion` interface
   - Updated `ExportRequest` to include `displayCurrency`

2. **`src/app/dashboard/dashboard-client.tsx`**
   - Added currency state management
   - Integrated CurrencySelector component
   - Updated ticket table to display with selected currency format
   - Updated totals row formatting
   - Passed displayCurrency to all child components

3. **`src/components/dashboard/overview-cards.tsx`**
   - Added displayCurrency prop
   - Updated formatting to use selected currency symbol
   - No conversion logic - amounts remain unchanged

4. **`src/components/dashboard/export-controls.tsx`**
   - Added displayCurrency prop
   - Passed displayCurrency to export API

5. **`src/app/api/events/[prodId]/export/route.ts`**
   - Updated all export functions to accept displayCurrency
   - Formats amounts with selected currency in XLSX export
   - Formats amounts with selected currency in CSV export
   - Formats amounts with selected currency in PDF export
   - Added currency information to export headers

## Currency Formatting Logic

### Formatting Only - No Conversion
**Important**: This feature only changes how currency is displayed. The actual amounts remain unchanged from the database values.

### Formatting Rules
- **EUR, USD, GBP, AUD, CAD, CHF**: 2 decimal places
- **JPY**: 0 decimal places (rounded to nearest whole number)
- Each currency uses its native locale for number formatting

## Usage Instructions

### For Users

1. **Select an Event**: Choose an event from the event picker
2. **Choose Currency**: Use the "Display Currency" dropdown to select your preferred currency symbol
3. **View Updated Display**: All currency symbols on the page update automatically (amounts stay the same)
4. **Export Reports**: Click any export button (Excel, CSV, PDF) to download reports with the selected currency format

### Currency Selection Tips
- The dropdown shows "(Event Default)" next to the event's native currency
- A helper text appears: "Changes how currency is displayed (amounts remain unchanged)"
- **Important**: This only changes the currency symbol/format, not the actual values
- Currency selection persists while viewing the same event
- Switching to a different event resets to that event's default currency

## Important Notes

### No Currency Conversion
- **This feature does NOT convert amounts between currencies**
- It only changes the currency symbol and number formatting
- All amounts remain in their original values from the database
- Example: If an event has €100, selecting USD will show $100 (not converted to actual USD value)

### Use Case
- This feature is useful for:
  - Displaying reports in a preferred currency format
  - Maintaining consistency in report appearance
  - Quick visual formatting without changing actual values
  
### Decimal Precision
- EUR, USD, GBP, AUD, CAD, CHF: 2 decimal places
- JPY: 0 decimal places (whole numbers only)
- Formatting follows locale conventions (e.g., comma vs period for decimals)

### Performance
- Formatting is lightweight and performed client-side
- No API calls or database queries needed
- Instant currency symbol updates

## Future Enhancements

### If Currency Conversion is Needed
If actual currency conversion is required in the future, consider:
1. **Live Exchange Rates**: Integrate with a currency exchange API (e.g., exchangerate-api.com)
2. **Historical Rates**: Store exchange rates with timestamps
3. **Conversion Toggle**: Allow users to choose between "format only" and "convert amounts"
4. **Dual Display**: Show both original and converted amounts
5. **Base Currency**: Set a base currency for all conversions
6. **Custom Rates**: Allow admin users to set manual exchange rates

### Other Improvements
1. **User Preferences**: Remember user's preferred display currency across sessions
2. **More Currencies**: Add support for additional currencies
3. **Real-time Updates**: Update formatting as user types in amount fields

## Testing Checklist

- [x] Currency selector appears in dashboard
- [x] Default currency matches event currency
- [x] All currencies are selectable
- [x] Overview cards update currency symbol when selection changes
- [x] Ticket table displays with selected currency format
- [x] Totals row shows selected currency symbol
- [x] Excel export uses selected currency format
- [x] CSV export includes selected currency
- [x] PDF export uses selected currency format
- [x] Export headers show currency information
- [x] TypeScript compilation passes
- [x] Amounts remain unchanged when currency changes
- [x] Only currency symbols and formatting change
- [ ] Manual testing with real events
- [ ] Verify JPY formatting (no decimals)
- [ ] Verify EUR/USD formatting (2 decimal places)
- [ ] Test all export formats download correctly

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

For questions or issues regarding the currency display feature, review:
1. Currency formatting logic in `src/lib/currency.ts`
2. Currency display information in `CURRENCY_INFO` constant
3. Export generation code in `src/app/api/events/[prodId]/export/route.ts`

To add new currencies or modify formatting, update the `CURRENCY_INFO` object in `src/lib/currency.ts`.
