# Leasing Hub Non-Negotiables Verification Report

## 1) Unit Availability Status Reliability

### Status: ⚠️ PARTIAL - Needs Fixes

**Evidence:**
- **Schema exists**: `supabase/migrations/20250102000000_create_core_pms_schema.sql:74-89`
  - Fields: `status` (vacant/occupied/make-ready/reserved), `showable` (boolean, default true), `available_date` (date, nullable)
- **Validation missing**: No database constraints or application-level validation
- **Issues found**:
  - `BulkAddUnitsModal.tsx:54` - Sets `status: 'vacant'` and `showable: true` but doesn't set `available_date`
  - `CreateLeaseModal.tsx:110-113` - Updates unit to `status: 'occupied'` but doesn't set `showable: false`
  - No validation that occupied units must have `showable=false`
  - No validation that vacant/ready units must have `available_date`

**Files to fix:**
- `supabase/migrations/20250102000000_create_core_pms_schema.sql` - Add CHECK constraints
- `src/components/core/BulkAddUnitsModal.tsx` - Add available_date validation
- `src/components/core/CreateLeaseModal.tsx` - Set showable=false when creating lease
- `src/components/core/CoreUnitsPage.tsx` - Add health check banner

---

## 2) Lead Pipeline Strictness

### Status: ❌ FAIL - Missing Table

**Evidence:**
- **Table missing**: No `core_leads` table found in any migration
- **Required fields missing**: stage, owner_user_id, next_action_at, last_touch_at
- **Safeguards missing**: No validation logic exists

**Files to create:**
- `supabase/migrations/20260109000000_create_core_leads.sql` - New migration

---

## 3) Conversion Flow Integrity

### Status: ⚠️ PARTIAL - Needs Fixes

**Evidence:**
- **Conversion flow exists**: `src/components/core/CreateLeaseModal.tsx:54-122`
  - ✅ Creates resident (lines 65-80)
  - ✅ Creates lease (lines 83-96)
  - ✅ Creates ledger account (lines 100-107)
  - ❌ Updates unit status to 'occupied' but doesn't set `showable=false` (lines 110-113)
- **Integrity checks missing**: No validation that:
  - All active leases have ledger accounts
  - All occupied/reserved units have active leases
- **Fix utility missing**: No "Fix missing ledger accounts" utility

**Files to fix:**
- `src/components/core/CreateLeaseModal.tsx` - Set showable=false
- Create integrity check utility: `src/utils/integrityChecks.ts`
- Add admin utility: `src/utils/fixMissingLedgerAccounts.ts`

---

## 4) Communication/Tour/Application Event Logging

### Status: ⚠️ PARTIAL - Missing Tables

**Evidence:**
- **Communication logging exists**: `supabase/migrations/20260107000000_add_communication_logging.sql`
  - ✅ `core_communication_logs` table exists with proper fields
  - ✅ Supports log-only mode (status: 'copied', 'marked_sent')
- **Missing tables**:
  - ❌ `core_tours` - Not found
  - ❌ `core_applications` - Not found
  - ❌ `core_conversations` - Not found (but core_communication_logs covers this)
- **Activity Timeline missing**: No component exists

**Files to create:**
- `supabase/migrations/20260109000001_create_tours_applications.sql` - New migration
- `src/components/ui/ActivityTimeline.tsx` - New component

---

## Summary

| Non-Negotiable | Status | Priority |
|----------------|--------|----------|
| 1. Unit availability status | ⚠️ PARTIAL | HIGH |
| 2. Lead pipeline | ❌ FAIL | HIGH |
| 3. Conversion flow | ⚠️ PARTIAL | HIGH |
| 4. Event logging | ⚠️ PARTIAL | MEDIUM |

**Total fixes needed**: 4 migrations + 5 component fixes + 2 utilities



