# Console Logging Guide - JPY Conversion

## Where to See Console Logs

Console logs in Next.js server-side code (like `src/lib/database.ts`) appear in the **SERVER TERMINAL**, not in the browser console.

### To see the logs:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Keep the terminal window visible** where you ran `npm run dev`

3. **Load an event in your browser** (navigate to an event in Japan)

4. **Look at the terminal window** - you'll see the console logs there

## What Logs to Expect

When you load a Japan event, you'll see output like this in your terminal:

```
=== JPY CONVERSION ATTEMPT ===
Event: Salsation Instructor Training - Tokyo
Country: Japan
Venue/Location: Venue
Generated event_type_key: Salsation-Instructor training-Regular
EUR Unit Price: 211.11

--- Database Lookup ---
Looking for: Salsation-Instructor training-Regular
Available keys in database (18 total):
  - Salsation-Instructor training-Repeater (JPY: ¥19,400, EUR: €113.449)
  - Salsation-Instructor training-Troupe (JPY: ¥19,400, EUR: €113.449)
  - Salsation-Instructor training-Early Bird (JPY: ¥29,700, EUR: €173.685)
  - Salsation-Instructor training-Regular (JPY: ¥36,100, EUR: €211.11)
  - Salsation-Instructor training-Rush (JPY: ¥42,600, EUR: €249.12)
  ... more entries ...

Match found: Salsation-Instructor training-Regular
✓ MATCH FOUND - Converted to JPY: ¥36,100
=== END JPY CONVERSION ===
```

## Log Details Explained

### 1. Event Information
- **Event**: The product name from the database
- **Country**: Should be "Japan" or "JP"
- **Venue/Location**: Either "Venue" or "Online"
- **Generated event_type_key**: The key generated from the event data to match against the database
- **EUR Unit Price**: The original price in EUR before conversion

### 2. Database Lookup
- **Looking for**: The event_type_key being searched
- **Available keys**: All conversion rates stored in the database
- **Match found/No match**: Whether a matching conversion was found

### 3. Conversion Result
- **✓ MATCH FOUND**: Successfully converted to JPY with the amount
- **✗ NO MATCH**: No conversion rate found in the database

## Common Issues

### Issue: No logs appear
**Cause**: Looking at browser console instead of terminal
**Solution**: Check the terminal window where `npm run dev` is running

### Issue: Shows "NO MATCH"
**Possible causes:**
1. Event_type_key doesn't match any database entry
2. The program/category/tier level combination isn't in the database
3. Online events need "-Online" suffix in the database

**Solution**: 
- Check the "Generated event_type_key" in the logs
- Compare it with "Available keys in database"
- Add missing conversion rates in the Fee Parameters page

### Issue: Event not in Japan but conversion attempted
**Cause**: Country field contains "japan" or "jp" (case-insensitive)
**Solution**: Verify the Country field in your event data

## Adding Missing Conversion Rates

If you see "NO MATCH" in the logs:

1. Note the `Generated event_type_key` from the logs
2. Go to **Dashboard → Fee Parameters → Grace Price Conversion** tab
3. Add a new entry with:
   - Program (e.g., "Salsation")
   - Category (e.g., "Instructor training")
   - Venue (e.g., "Venue" or "Online")
   - Tier Level (e.g., "Regular")
   - JPY Price
   - EUR Price
4. The system will automatically generate the correct event_type_key

## Event Type Key Generation Rules

The event_type_key is generated as:
```
{Program}-{Category}-{TierLevel}
```

For online events:
```
{Program}-{Category}-{TierLevel}-Online
```

Special case - Free tier:
```
{Program}-{Category}-
```

### Examples:
- Venue event: `Salsation-Instructor training-Regular`
- Online event: `Salsation-Workshops-Regular-Online`
- Free event: `Choreology-Instructor training-`
