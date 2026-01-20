# Leasing Hub Non-Negotiables - Verification Checklist

## ✅ 1) Unit Availability Status Reliability

### Database Schema
- [x] `core_units` table has: `status`, `showable`, `available_date`
- [x] CHECK constraint: occupied units must have `showable=false`
- [x] Function: `fix_unit_availability()` exists

### Application Validation
- [x] `BulkAddUnitsModal` sets `available_date` for vacant units
- [x] `CreateLeaseModal` sets `showable=false` when creating lease
- [x] Health check utility: `checkInvalidUnitStatus()`
- [x] Health check banner in `/core/units` with auto-fix button

**Files:**
- `supabase/migrations/20260109000000_fix_unit_availability_validation.sql`
- `src/components/core/BulkAddUnitsModal.tsx:57`
- `src/components/core/CreateLeaseModal.tsx:112`
- `src/components/core/CoreUnitsPage.tsx:64-100`
- `src/utils/integrityChecks.ts:96-131`

**Status: ✅ PASS**

---

## ⚠️ 2) Lead Pipeline Strictness

### Database Schema
- [x] `core_leads` table exists
- [x] Required fields: `stage`, `owner_user_id`, `next_action_at`, `last_touch_at`
- [x] Trigger: prevents stage transition without `next_action_at`
- [x] RLS policies exist

### UI Enforcement
- [ ] Auto-assign `owner_user_id` if missing (with toast)
- [ ] "Idle" badge when `now > next_action_at`
- [ ] Lead management UI component

**Files:**
- `supabase/migrations/20260109000001_create_core_leads.sql`

**Status: ⚠️ PARTIAL** - Database complete, UI enforcement pending

---

## ✅ 3) Conversion Flow Integrity

### Conversion Flow
- [x] Creates resident record (or links existing)
- [x] Creates lease record linked to unit + resident
- [x] Creates ledger account linked to lease
- [x] Updates unit status to 'occupied' and `showable=false`

### Integrity Checks
- [x] Check: All active leases have ledger accounts
- [x] Check: All occupied/reserved units have active leases
- [x] Fix utility: `fixMissingLedgerAccounts()`

**Files:**
- `src/components/core/CreateLeaseModal.tsx:54-122`
- `src/utils/integrityChecks.ts:14-173`

**Status: ✅ PASS**

---

## ⚠️ 4) Communication/Tour/Application Event Logging

### Database Tables
- [x] `core_communication_logs` exists
- [x] `core_tours` exists
- [x] `core_applications` exists
- [x] Supports log-only mode (status: 'copied', 'marked_sent')

### Activity Timeline
- [x] Reusable `ActivityTimeline` component created
- [ ] Integrated into lead/resident/lease detail views

**Files:**
- `supabase/migrations/20260107000000_add_communication_logging.sql`
- `supabase/migrations/20260109000002_create_tours_applications.sql`
- `src/components/ui/ActivityTimeline.tsx` ✅ NEW

**Status: ⚠️ PARTIAL** - Component created, integration pending

---

## Summary

| Item | Status | Notes |
|------|--------|-------|
| 1. Unit availability | ✅ PASS | Complete |
| 2. Lead pipeline | ⚠️ PARTIAL | Database done, UI pending |
| 3. Conversion flow | ✅ PASS | Complete |
| 4. Event logging | ⚠️ PARTIAL | Tables done, ActivityTimeline created, integration pending |

**Ready for Leasing Hub:** Core data model and validation are in place. UI components can be built on this foundation.



