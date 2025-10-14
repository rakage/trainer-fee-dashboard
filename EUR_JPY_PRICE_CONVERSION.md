# EUR to JPY Price Conversion Feature

## Overview
This feature manages the conversion rates between EUR and JPY for **ALL events held in Japan**. It is accessible through the Fee Parameters dashboard under the "Grace Price Conversion" tab (admin only).

## Purpose
The Grace Price Conversion table (formerly named for historical reasons) stores the price mapping for **all Japan events** where:
- Events are priced in EUR on the booking system (ticket sales platform)
- Need to be converted to JPY for financial reporting in Japan
- Requires tracking different price tiers (Repeater, Troupe, Early Bird, Regular, Rush, Free)
- The conversion is automatically matched using the `event_type_key` (also called `GraceKey` in the codebase)

**Important**: This is NOT specific to any trainer named "Grace" - it applies to all events in Japan regardless of the trainer.

## How It Works

### Form Fields
1. **Program**: Select the program type (Salsation, Choreology, Kid, Rootz, Natasha_Salsation)
2. **Category**: Select the event category (Instructor training, Workshops, Seminar, etc.)
3. **Venue**: Select the venue type:
   - **Venue**: For in-person events
   - **Online**: For online events
4. **Tier Level**: Select the pricing tier (Repeater, Troupe, Early Bird, Regular, Rush, Free)
5. **JPY Price**: Enter the price in Japanese Yen
6. **EUR Price**: Enter the price in Euros

### Event Type Key Generation (GraceKey)
The system automatically generates an `event_type_key` (also called `GraceKey` in the database queries) based on the form inputs. This key is used to match tickets from the Japan booking system with the correct EUR to JPY conversion rate.

**Format**: `{Program}-{Category}-{TierLevel}[-Online]`

**Examples**:
- Venue event: `Salsation-Instructor training-Early Bird`
- Online event: `Salsation-Workshops-Regular-Online` (automatically adds `-Online` suffix)

### How Ticket Matching Works

When processing ticket data from Japan events, the system generates a `GraceKey` from the ticket information:

```sql
-- From the ticket database query
case
    when Country = 'Japan' and Location = 'Venue' 
        then concat(Program, '-', Category, '-', TierLevel)
    when Country = 'Japan' and Location = 'Online' 
        then concat(Program, '-', Category, '-', TierLevel, '-', Location)
    else null
end as GraceKey
```

This `GraceKey` is then used to lookup the JPY price from the `grace_price_conversion` table using the `event_type_key` column.

**Example Flow**:
1. Ticket sold: Salsation Workshop Regular at a venue in Japan for €33
2. System generates `GraceKey`: `Salsation-Workshops-Regular`
3. Looks up in `grace_price_conversion` table where `event_type_key = 'Salsation-Workshops-Regular'`
4. Finds `jpy_price = 5632` and `eur_price = 33`
5. Uses these values for financial reporting in Japan

### Key Features
1. **Automatic Online Suffix**: When venue is set to "Online", the system automatically appends `-Online` to the event_type_key to match the ticket data format
2. **Unique Keys**: Each event_type_key must be unique in the database
3. **Upsert Logic**: If an entry with the same event_type_key exists, it will be updated; otherwise, a new entry is created
4. **Universal Application**: This applies to **ALL Japan events** regardless of trainer, program, or category

## Table Display
The Grace Price Conversion table shows:
- **Program**: The program name
- **Category**: The event category
- **Venue**: Venue or Online
- **Tier Level**: The pricing tier
- **Event Type Key**: The full generated key (useful for debugging and data integration)
- **JPY Price**: Price in Japanese Yen (formatted with ¥ symbol)
- **EUR Price**: Price in Euros (formatted with € symbol)
- **Actions**: Edit and Delete buttons

## Example Records

### Venue Events
```
Salsation | Instructor training | Venue | Early Bird | Salsation-Instructor training-Early Bird | ¥29,700 | €173.685
```

### Online Events
```
Salsation | Workshops | Online | Regular | Salsation-Workshops-Regular-Online | ¥5,632 | €33
```

## Usage

### Adding a New Conversion Rate
1. Navigate to Dashboard → Fee Parameters
2. Click on "Grace Price Conversion" tab
3. Fill in all required fields
4. Select appropriate venue (Venue or Online)
5. Click "Add Grace Price"
6. The event_type_key will be automatically generated with proper suffixes

### Editing an Existing Rate
1. Find the record in the table
2. Click "Edit" button
3. Modify the fields as needed
4. Click "Save"
5. The event_type_key will be regenerated based on new values

### Deleting a Rate
1. Find the record in the table
2. Click "Delete" button
3. Confirm the deletion

## Database Schema
```sql
CREATE TABLE grace_price_conversion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  event_type_key TEXT NOT NULL UNIQUE,
  venue TEXT,
  jpy_price REAL NOT NULL,
  eur_price REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

## Scripts

### Add New Records
Use the script: `scripts/add-grace-prices.js`
```javascript
node scripts/add-grace-prices.js
```

### Check Online Records
Use the script: `scripts/check-online-records.js`
```javascript
node scripts/check-online-records.js
```

## Notes
- This feature is admin-only
- All prices should be accurate and up-to-date
- The event_type_key is used to match events from external systems
- Always verify the venue selection to ensure proper -Online suffix
