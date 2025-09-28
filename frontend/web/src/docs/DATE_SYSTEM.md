# Date System Documentation

## Overview

The Personal Finance Manager uses a **unified date storage system** that ensures consistency across all languages while providing localized date display and input for users.

## Core Principles

### 1. **Single Source of Truth**
- **All dates are stored in Gregorian format** in the database (YYYY-MM-DDTHH:mm)
- **No mixed date formats** are stored in the database
- **Consistent backend processing** regardless of user language

### 2. **Language-Specific Display**
- **Persian users** see Persian dates in the UI (۱۴۰۳/۰۹/۰۷)
- **Other users** see Gregorian dates in the UI (2024-12-28)
- **Same underlying data** displayed differently based on language

### 3. **Automatic Conversion**
- **Persian dates are converted to Gregorian** before database storage
- **Gregorian dates are converted to Persian** for Persian users' display
- **Conversion is handled transparently** by the date conversion service

## How It Works

### Date Input Flow

```
User Input (Persian) → Date Conversion Service → Gregorian Storage → Database
     ↓
۱۴۰۳/۰۹/۰۷ ۱۲:۳۰ → 2024-12-28T12:30 → PostgreSQL
```

### Date Display Flow

```
Database → Gregorian Date → Date Conversion Service → User Display
     ↓
PostgreSQL → 2024-12-28T12:30 → ۱۴۰۳/۰۹/۰۷ ۱۲:۳۰ (Persian users)
```

### Example Scenarios

#### Scenario 1: Persian User Creates Expense
1. **User Input**: "۱۴۰۳/۰۹/۰۷ ۱۲:۳۰" (Persian)
2. **Conversion**: 2024-12-28T12:30 (Gregorian)
3. **Database Storage**: 2024-12-28T12:30
4. **Display to Persian User**: "۱۴۰۳/۰۹/۰۷ ۱۲:۳۰"
5. **Display to English User**: "2024-12-28 12:30"

#### Scenario 2: English User Creates Expense
1. **User Input**: "2024-12-28 12:30" (Gregorian)
2. **No Conversion Needed**: 2024-12-28T12:30 (Gregorian)
3. **Database Storage**: 2024-12-28T12:30
4. **Display to Persian User**: "۱۴۰۳/۰۹/۰۷ ۱۲:۳۰"
5. **Display to English User**: "2024-12-28 12:30"

## Key Benefits

### 1. **Data Consistency**
- All expenses have consistent date formats in the database
- No confusion about which calendar system was used
- Reliable date comparisons and sorting

### 2. **User Experience**
- Persian users can work with familiar Persian dates
- English users can work with familiar Gregorian dates
- No learning curve for date input

### 3. **System Reliability**
- Backend always receives consistent Gregorian dates
- No need for complex date parsing logic in backend
- Easy to implement date-based features

## Technical Implementation

### Date Conversion Service
The `dateConversionService` handles all date conversions:

```typescript
// Convert Persian input to Gregorian for storage
const result = dateConversionService.persianToGregorian("۱۴۰۳/۰۹/۰۷ ۱۲:۳۰", true);
// result.gregorianDate = "2024-12-28T12:30"

// Convert Gregorian from database to display format
const display = dateConversionService.gregorianToDisplay("2024-12-28T12:30", "fa", true);
// display.displayDate = "۱۴۰۳/۰۹/۰۷ ۱۲:۳۰"
```

### Conditional Date Picker
The `ConditionalDatePicker` component automatically chooses the right date picker:

```typescript
// For Persian users: Shows PersianDatePicker
// For other users: Shows standard HTML date input
const isPersian = currentLanguage === 'fa';
```

## Database Schema

All date fields in the database use the same format:

```sql
-- Example table structure
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    transaction_date TIMESTAMP NOT NULL, -- Always Gregorian
    created_at TIMESTAMP DEFAULT NOW(),  -- Always Gregorian
    updated_at TIMESTAMP DEFAULT NOW()   -- Always Gregorian
);
```

## API Responses

All API responses return dates in Gregorian format:

```json
{
  "id": 1,
  "amount": 100.00,
  "transaction_date": "2024-12-28T12:30:00Z", // Gregorian
  "created_at": "2024-12-28T10:00:00Z"        // Gregorian
}
```

The frontend converts these to the appropriate display format based on the user's language.

## Migration and Compatibility

### Existing Data
- All existing dates in the database are already in Gregorian format
- No migration needed for existing data
- System is backward compatible

### Future Changes
- Adding new date fields follows the same pattern
- All date operations use the date conversion service
- Consistent behavior across all components

## Best Practices

### For Developers
1. **Always use the date conversion service** for date operations
2. **Never store mixed date formats** in the database
3. **Test with both Persian and Gregorian inputs**
4. **Use consistent date formats** in API responses

### For Users
1. **Enter dates in your preferred format** (Persian or Gregorian)
2. **The system handles conversion automatically**
3. **All dates are stored consistently** regardless of input format
4. **Date comparisons work correctly** across different input methods

## Troubleshooting

### Common Issues
1. **Date not displaying correctly**: Check if date conversion service is being used
2. **Invalid date errors**: Ensure proper date format validation
3. **Timezone issues**: All dates are stored in UTC, converted for display

### Validation
The system validates date conversions to ensure consistency:

```typescript
const isValid = dateConversionService.validateConversion(
  originalInput, 
  convertedGregorian, 
  language
);
```

This ensures that the converted date represents the same moment in time as the original input.
