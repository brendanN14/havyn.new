# Core PMS 404 Error Fix Summary

## What Were the 404 Errors?

The 404 errors were occurring because:

1. **Missing Database Tables**: The `core_*` tables (`core_properties`, `core_units`, `core_leases`, `core_residents`, `core_ledger_accounts`, `core_ledger_txns`, `core_tenant_insights`) don't exist in your Supabase database yet.

2. **Complex Nested Joins**: The queries were using Supabase PostgREST nested join syntax (e.g., `property:core_properties!inner(user_id)`) which fails with 404 when tables don't exist.

3. **No Error Handling**: The components weren't catching or displaying these errors, so pages appeared blank.

## What Was Fixed?

### 1. Error Detection and Display
- Added proper error handling to detect when tables don't exist (error code `PGRST116` or "relation does not exist" messages)
- Added error banners to all Core PMS pages that clearly explain the issue and how to fix it
- Error messages now include instructions to run the migration file

### 2. Simplified Queries
- Replaced complex nested joins with simpler, sequential queries
- Queries now fetch data separately and join in JavaScript code
- This makes queries more resilient and easier to debug

### 3. Better UI States
- Added loading spinners while data is being fetched
- Added error banners with actionable error messages
- Improved empty states that guide users to create data

### Files Modified:
- `src/components/core/CoreDashboard.tsx` - Fixed stats, vacancy, and delinquency queries
- `src/components/core/CorePropertiesPage.tsx` - Fixed properties query
- `src/components/core/CoreUnitsPage.tsx` - Fixed units query
- `src/components/core/CoreLeasesPage.tsx` - Fixed leases query
- `src/components/core/CoreResidentsPage.tsx` - Fixed residents query

## How to Fix the 404 Errors

### Step 1: Run the Database Migration

The migration file is located at:
```
supabase/migrations/20250102000000_create_core_pms_schema.sql
```

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/20250102000000_create_core_pms_schema.sql`
4. Run the SQL script

**Option B: Using Supabase CLI** (if you have it set up)
```bash
supabase db push
```

### Step 2: Seed Sample Data (Optional)

After running the schema migration, you can seed sample data:

1. Go to Supabase SQL Editor
2. Copy and paste the contents of `supabase/migrations/20250102000001_seed_core_pms_data.sql`
3. **IMPORTANT**: The seed script uses the first user from `auth.users`. Make sure you're logged in as the user you want to seed data for.
4. Run the SQL script

### Step 3: Verify

After running the migrations:
1. Refresh your Core PMS pages (`/core/dashboard`, `/core/properties`, etc.)
2. The 404 errors should be gone
3. If you seeded data, you should see:
   - 1 property: "Sunset Apartments"
   - 25 units with mixed statuses
   - 12 active leases
   - Ledger accounts and transactions
   - Tenant insights

## Testing

After fixing, test these pages:
- ✅ `/core/dashboard` - Should show KPIs and previews
- ✅ `/core/properties` - Should list properties (or show empty state)
- ✅ `/core/units` - Should list units (or show empty state)
- ✅ `/core/leases` - Should list leases (or show empty state)
- ✅ `/core/residents` - Should list residents (or show empty state)

All pages should now:
- Show loading spinners while fetching
- Display clear error messages if tables are missing
- Show empty states with helpful guidance
- Display data correctly once tables exist





