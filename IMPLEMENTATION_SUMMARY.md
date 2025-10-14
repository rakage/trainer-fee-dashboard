# Implementation Summary: EUR to JPY Price Conversion for Japan Events

## Clarification on "Grace Price Conversion"

The feature name "Grace Price Conversion" is **historical/legacy naming**. This feature is NOT specific to any trainer named Grace.

### What It Actually Does
This feature manages EUR to JPY price conversion for **ALL events held in Japan**, regardless of:
- Trainer name
- Program type
- Event category
- Venue type (Venue or Online)

## How the System Works

### 1. Ticket Data Processing
When tickets are sold for Japan events through the booking platform:
- Tickets are priced in **EUR** on the platform
- The system needs to convert these to **JPY** for financial reporting in Japan
- Each ticket has: Program, Category, Location (Venue/Online), TierLevel (Early Bird, Regular, etc.)

### 2. Automatic Key Generation
The system generates a `GraceKey` from ticket data:

**For Venue Events (in-person)**:
```
Format: {Program}-{Category}-{TierLevel}
Example: Salsation-Workshops-Regular
```

**For Online Events**:
```
Format: {Program}-{Category}-{TierLevel}-Online
Example: Salsation-Workshops-Regular-Online
```

### 3. Price Lookup
The `GraceKey` is used to look up the conversion in the `grace_price_conversion` table:
- Matches `GraceKey` with `event_type_key` column
- Retrieves both `jpy_price` and `eur_price`
- Uses these values for financial calculations

## Implementation Details

### Database Table
```sql
grace_price_conversion
├── id (Primary Key)
├── event_type (Display name)
├── event_type_key (Unique key for matching - the GraceKey)
├── venue (Venue or Online)
├── jpy_price (Price in Japanese Yen)
├── eur_price (Price in Euros)
├── created_at
└── updated_at
```

### Key Code Location
File: `src/lib/database.ts` (lines ~330-340)
```sql
case
    when Country = 'Japan' and Location = 'Venue' 
        then concat(Program, '-', Category, '-', TierLevel)
    when Country = 'Japan' and Location = 'Online' 
        then concat(Program, '-', Category, '-', TierLevel, '-', Location)
    else null
end as GraceKey
```

### Automatic -Online Suffix
The system automatically:
1. Detects when venue is "Online" in the form
2. Appends "-Online" to the `event_type_key`
3. Ensures consistency with ticket data format

**Implementation**: `src/app/dashboard/fee-params/page.tsx`
```javascript
let eventTypeKey = `${program}-${category}-${tierLevel}`;
if (venue === 'Online') {
  eventTypeKey = `${eventTypeKey}-Online`;
}
```

## Example Usage

### Scenario 1: Venue Workshop
**Ticket Sold**:
- Program: Salsation
- Category: Workshops
- TierLevel: Regular
- Location: Venue (in-person)
- Country: Japan
- Price: €33

**System Process**:
1. Generates `GraceKey`: `Salsation-Workshops-Regular`
2. Looks up in `grace_price_conversion` where `event_type_key = 'Salsation-Workshops-Regular'`
3. Finds: `jpy_price = 5632`, `eur_price = 33`
4. Uses these values for reporting

### Scenario 2: Online Workshop
**Ticket Sold**:
- Program: Salsation
- Category: Workshops
- TierLevel: Regular
- Location: Online
- Country: Japan
- Price: €33

**System Process**:
1. Generates `GraceKey`: `Salsation-Workshops-Regular-Online`
2. Looks up in `grace_price_conversion` where `event_type_key = 'Salsation-Workshops-Regular-Online'`
3. Finds: `jpy_price = 5632`, `eur_price = 33`
4. Uses these values for reporting

## Current Data Examples

### Venue Events
```
Salsation-Instructor training-Early Bird | Venue | ¥29,700 | €173.685
Salsation-Instructor training-Regular | Venue | ¥36,100 | €211.110
```

### Online Events
```
Salsation-Workshops-Regular-Online | Online | ¥5,632 | €33
Salsation-Workshops-Early Bird-Online | Online | ¥5,130 | €30
```

## Admin Access
Only users with **admin role** can:
- View the Grace Price Conversion tab
- Add new conversion rates
- Edit existing conversion rates
- Delete conversion rates

## Important Notes

1. **Universal Application**: This applies to ALL Japan events, not specific to any trainer
2. **Automatic Matching**: The system automatically matches tickets using the `GraceKey`
3. **Venue Detection**: The -Online suffix is automatically added based on venue selection
4. **Unique Keys**: Each `event_type_key` must be unique in the database
5. **Legacy Name**: "Grace" in the name is historical and not related to the functionality

## Files Modified/Created

### Modified Files
- `src/lib/sqlite.ts` - Added venue column, updated service methods
- `src/lib/database.ts` - Already had GraceKey logic (no changes needed)
- `src/app/dashboard/fee-params/page.tsx` - Added venue field, automatic -Online suffix
- `src/app/api/grace-price/route.ts` - Updated API to handle venue
- `scripts/seed-sqlite.js` - Updated seed data with venue

### Created Files
- `scripts/add-grace-prices.js` - Script to add new conversion rates
- `scripts/check-online-records.js` - Script to verify Online records
- `EUR_JPY_PRICE_CONVERSION.md` - Feature documentation
- `IMPLEMENTATION_SUMMARY.md` - This file

## Future Considerations

If you want to rename this feature to be more clear:
1. Consider renaming "Grace Price Conversion" to "Japan EUR/JPY Conversion"
2. Rename database table from `grace_price_conversion` to `japan_price_conversion`
3. Update all references in the codebase
4. Create migration script for existing data
