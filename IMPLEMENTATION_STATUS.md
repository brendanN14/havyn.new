# Core PMS Implementation Status

## Part A: Navigation Entry Points ✅ COMPLETE

### Legacy Dashboard Entry Point
**Location**: `src/components/Dashboard.tsx` (lines ~1573-1610)
- Added prominent "Try Core PMS (Beta)" banner card at top of dashboard
- Includes buttons to navigate to `/core/dashboard`, `/core/properties`, `/core/units`
- Shows description and "New" badge

### Navigation Sidebar Entry
**Location**: `src/components/NavigationSidebar.tsx` (lines ~82-107)
- Added "Core PMS (Beta)" section with:
  - Core Dashboard link
  - Properties link  
  - Units link

### Back to Legacy Dashboard
**Location**: `src/components/core/CorePMSLayout.tsx` (lines ~19-24)
- Added "Back to Legacy Dashboard" link in Core PMS header
- Links back to `/dashboard`

## Part B: Core PMS Pages - IN PROGRESS

### ✅ Core Dashboard (`/core/dashboard`)
- Property selector (if multiple properties)
- KPI cards: Total Units, Vacant Units, Occupied Units, Active Leases, Total Balance Due
- Vacancy Board preview table (top 10 units)
- Delinquency preview table (top 10)
- Empty state guidance

### ⏳ Core Leases (`/core/leases`) - TO CREATE
- List leases with columns: unit_code, resident, status, lease_start, lease_end, rent, balance_due
- Create Lease flow (modal/page)
- Lease detail page with:
  - Lease summary
  - Resident info
  - Ledger section (transactions + running balance)
  - Actions: Post Monthly Rent, Add Charge/Credit, Record Payment

### ⏳ Core Residents (`/core/residents`) - TO CREATE
- List residents with: name, unit_code, lease status, balance_due, insight category
- Resident detail page

### ✅ Core Units (`/core/units`)
- Vacancy board view (already implemented)
- Shows "occupied by" resident if unit has active lease

## Part C: Tenant Insights v1 - TO IMPLEMENT

Need to create Edge Function or client-side function that:
- Calculates insights when ledger transactions are created/updated
- Updates `core_ledger_accounts` (current_balance, days_past_due)
- Upserts `core_tenant_insights` with category, reasons[], recommended_action

## Part D: Seed Data - TO CREATE

Need migration script that seeds:
- 1 property (Sunset Apartments)
- 20-30 units with mixed statuses
- 10-15 active leases with residents
- Ledger transactions (current, 10-20 days late, 30-60 days late)
- Edge cases: partial payment, credit applied

## Next Steps

1. Create `/core/leases` page with full CRUD
2. Create `/core/residents` page
3. Implement tenant insights calculation function
4. Create seed data migration
5. Update App.tsx routes for leases/residents





