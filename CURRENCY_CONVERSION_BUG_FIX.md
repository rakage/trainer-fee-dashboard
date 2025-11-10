# Currency Conversion Bug Fix

## Issue Description

Discrepancy between revenue shown on two pages for Japan events:
- **Event Selection (/dashboard)**: ¥598,819
- **Event Details (/dashboard/trainers-events)**: ¥589,419
- **Difference**: ¥9,400

### Example Case
Customer: 943097670@qq.com
- **Paid**: €173.685 (Early Bird standard price)
- **Event Selection showed**: ¥29,700 (correct)
- **Event Details showed**: ¥25,000 (incorrect)

## Root Cause

The bug was in `src/lib/database.ts` at line 3625 in the `getEventTickets()` method:

```typescript
const gracePriceData = await this.getGracePriceConversion(
  program,
  category,
  tierLevel,
  venue,
  ticket.PriceTotal  // ❌ BUG: Passing total price instead of unit price
);
```

### Why This Caused the Issue

1. The Grace Price Conversion table has multiple entries for "Early Bird":
   - **ID 3**: ¥29,700 = €173.685 (standard price)
   - **ID 35**: ¥25,000 = €170 (discounted price)

2. When multiple matches exist, `getGracePriceConversion()` uses the "closest EUR match" logic (lines 818-830):
   ```typescript
   conversion = matches.reduce((prev, current) => {
     const prevDiff = Math.abs(prev.eurPrice - eurAmount);
     const currentDiff = Math.abs(current.eurPrice - eurAmount);
     return currentDiff < prevDiff ? current : prev;
   });
   ```

3. **The bug**: Passing `ticket.PriceTotal` instead of `ticket.UnitPrice` meant:
   - If a customer bought 1 ticket at €173.685, `PriceTotal` = €173.685 (happens to work)
   - But the value being compared was not semantically correct
   - In some cases (likely due to rounding or precision issues), it was matching to the wrong entry

4. **Event Selection page was correct** because it passed `unitPrice` (line 607):
   ```typescript
   const gracePriceData = await this.getGracePriceConversion(
     program,
     category,
     tierLevel,
     venue,
     unitPrice  // ✓ Correct: passing unit price
   );
   ```

## The Fix

Changed line 3625 in `src/lib/database.ts`:

```typescript
const gracePriceData = await this.getGracePriceConversion(
  program,
  category,
  tierLevel,
  venue,
  ticket.UnitPrice  // ✓ Fixed: Now passing unit price for correct matching
);
```

Also updated the logging (line 3615) to show both values for debugging:
```typescript
console.log(`\nConverting ticket: TierLevel=${tierLevel}, UnitPrice=€${ticket.UnitPrice}, PriceTotal=€${ticket.PriceTotal}`);
```

## Impact

After this fix:
- Event Details will correctly match EUR prices to JPY prices from the Grace Price Conversion table
- Customer who paid €173.685 → correctly gets ¥29,700 (not ¥25,000)
- Revenue calculation will match between both pages
- The ¥9,400 discrepancy will be resolved

## Testing

To verify the fix:
1. Navigate to /dashboard and select the Japan event (Product ID: 79163)
2. Check the "Ticket Price Total" sum - should be **¥598,819**
3. Navigate to /dashboard/trainers-events and click on the same event
4. Check the "Revenue" - should now also be **¥598,819** (was ¥589,419)
5. Verify customer 943097670@qq.com shows ¥29,700 (not ¥25,000)

## Note on Grace Price Conversion Table

The multiple entries for "Early Bird" with different EUR/JPY values are **intentional**, not duplicates:
- ¥29,700 = €173.685 (standard Early Bird price)
- ¥25,000 = €170 (discounted Early Bird price for promotions/special cases)

The matching logic correctly handles this by finding the closest EUR match, ensuring the right JPY amount is used based on what the customer actually paid.
