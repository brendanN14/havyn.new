# Leasing Hub Non-Negotiables - Final Verification Report

## ✅ 1) Unit Availability Status Reliability

### Status: ✅ PASS

**Evidence:**
- **Schema**: `supabase/migrations/20250102000000_create_core_pms_schema.sql:74-89`
  - Fields: `status`, `showable`, `available_date` ✅
- **Database Constraint**: `supabase/migrations/20260109000000_fix_unit_availability_validation.sql`
  - CHECK constraint: occupied units must have `showable=false` ✅
  - Function: `fix_unit_availability()` for auto-fix ✅
- **Validation in UI**:
  - `src/components/core/BulkAddUnitsModal.tsx:57` - Sets `available_date` for vacant units ✅
  - `src/components/core/CreateLeaseModal.tsx:112` - Sets `showable=false` when creating lease ✅
- **Health Check**:
  - `src/utils/integrityChecks.ts:96-131` - `checkInvalidUnitStatus()` function ✅
  - `src/components/core/CoreUnitsPage.tsx:64-100` - Health check banner with auto-fix ✅

**Files:**
- ✅ `supabase/migrations/20260109000000_fix_unit_availability_validation.sql`
- ✅ `src/components/core/BulkAddUnitsModal.tsx`
- ✅ `src/components/core/CreateLeaseModal.tsx`
- ✅ `src/components/core/CoreUnitsPage.tsx`
- ✅ `src/utils/integrityChecks.ts`

---

## ⚠️ 2) Lead Pipeline Strictness

### Status: ⚠️ PARTIAL - Missing UI Enforcement

**Evidence:**
- **Table exists**: `supabase/migrations/20260109000001_create_core_leads.sql` ✅
  - Required fields: `stage`, `owner_user_id`, `next_action_at`, `last_touch_at` ✅
- **Database Safeguards**:
  - Trigger: `check_lead_stage_transition()` prevents stage change without `next_action_at` ✅
  - RLS policies exist ✅
- **Missing UI Enforcement**:
  - ❌ No auto-assign `owner_user_id` if missing
  - ❌ No "Idle" badge when `now > next_action_at`
  - ❌ No UI component for lead management

**Files:**
- ✅ `supabase/migrations/20260109000001_create_core_leads.sql`
- ❌ Missing: Lead management UI component
- ❌ Missing: Auto-assign owner_user_id logic
- ❌ Missing: "Idle" badge display

---

## ✅ 3) Conversion Flow Integrity

### Status: ✅ PASS

**Evidence:**
- **Conversion Flow**: `src/components/core/CreateLeaseModal.tsx:54-122`
  - ✅ Creates resident (lines 65-80)
  - ✅ Creates lease (lines 83-96)
  - ✅ Creates ledger account (lines 100-107)
  - ✅ Updates unit status to 'occupied' and `showable=false` (lines 110-113)
- **Integrity Checks**: `src/utils/integrityChecks.ts`
  - ✅ `checkMissingLedgerAccounts()` - Verifies all active leases have ledger accounts
  - ✅ `checkOccupiedUnitsWithoutLeases()` - Verifies occupied/reserved units have leases
  - ✅ `checkInvalidUnitStatus()` - Verifies unit status consistency
- **Fix Utility**: `src/utils/integrityChecks.ts:149-173`
  - ✅ `fixMissingLedgerAccounts()` - Safe utility to create missing ledger accounts

**Files:**
- ✅ `src/components/core/CreateLeaseModal.tsx`
- ✅ `src/utils/integrityChecks.ts`

---

## ⚠️ 4) Communication/Tour/Application Event Logging

### Status: ⚠️ PARTIAL - Missing Activity Timeline Component

**Evidence:**
- **Tables exist**:
  - ✅ `core_communication_logs` - `supabase/migrations/20260107000000_add_communication_logging.sql`
  - ✅ `core_tours` - `supabase/migrations/20260109000002_create_tours_applications.sql`
  - ✅ `core_applications` - `supabase/migrations/20260109000002_create_tours_applications.sql`
  - ✅ Supports log-only mode (status: 'copied', 'marked_sent')
- **Missing**:
  - ❌ `core_messages` table (but `core_communication_logs` covers this)
  - ❌ `core_conversations` table (but `core_communication_logs` covers this)
  - ❌ Activity Timeline component
- **Partial Implementation**:
  - ✅ `TenantDetailDrawer.tsx` has communication timeline (lines 433-479) but not reusable

**Files:**
- ✅ `supabase/migrations/20260107000000_add_communication_logging.sql`
- ✅ `supabase/migrations/20260109000002_create_tours_applications.sql`
- ❌ Missing: Reusable `ActivityTimeline` component

---

## Summary

| Non-Negotiable | Status | Missing Items |
|----------------|--------|---------------|
| 1. Unit availability status | ✅ PASS | None |
| 2. Lead pipeline | ⚠️ PARTIAL | UI enforcement (auto-assign, Idle badge) |
| 3. Conversion flow | ✅ PASS | None |
| 4. Event logging | ⚠️ PARTIAL | Activity Timeline component |

**Remaining Work:**
1. Create reusable `ActivityTimeline` component
2. Add lead management UI with auto-assign and "Idle" badge
3. (Optional) Create `core_messages` and `core_conversations` tables if needed (currently covered by `core_communication_logs`)



