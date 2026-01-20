# Havyn Transition Plan: CSV Tool → PMS-First Platform

## 1. Target Architecture

**PMS-First with Leasing Hub**: Properties and Units are the foundational entities. Leases link tenants to units with start/end dates and rent terms. Transactions track rent charges (auto-generated monthly) and payments (Stripe or manual). Tenant Insights are **event-driven** - recalculated when transactions update balances, leases renew/expire, or communications occur. The Leasing Hub manages applicant flow (inquiry → application → approval → lease signing → move-in) and automatically creates leases upon move-in.

**Key Principles**:
- **Properties/Units** = Source of truth for physical assets
- **Leases** = Source of truth for tenant assignments and rent terms
- **Transactions** = Source of truth for financial activity (charges + payments)
- **Tenant Insights** = Derived/event-driven from above entities (not primary storage)
- **No CSV dependency** long-term (migrate existing CSV data to native tables)

## 2. Data Spine (Source of Truth Entities)

### Keep (Refactor)
- `tenant_insights_v2` → **Refactor** to be derived/computed from leases + transactions, not primary storage
  - Keep: id, tenant_score, recommendations, reasoning_summary, changes, created_at
  - **Remove** source data fields (rent_amount, past_due, delinquent_rent, aging buckets) - these come from transactions
  - **Add**: lease_id (foreign key), last_calculated_at, calculation_trigger

### Build (New Source of Truth)
1. **`properties`** - Property master data
   - id, name, address, city, state, zip, owner_name, management_company, created_at
   - **Ownership**: User-entered or imported from CSV initially

2. **`units`** - Unit master data  
   - id, property_id, unit_number, bedrooms, bathrooms, sqft, amenities, status (occupied/vacant/make-ready), created_at
   - **Ownership**: User-entered, updated via leasing workflow

3. **`leases`** - Lease agreements (source of truth for tenant assignments)
   - id, unit_id, tenant_name, tenant_email, tenant_phone, start_date, end_date, monthly_rent, security_deposit, status (active/expired/renewed), renewal_count, created_at, updated_at
   - **Ownership**: Created via Leasing Hub (applicant → lease signing), or imported from CSV during transition
   - **Key**: One active lease per unit at a time (enforced by status)

4. **`transactions`** - All financial activity (charges + payments)
   - id, lease_id, type (charge/payment/adjustment), amount, date, description, payment_method (stripe/manual/cash), stripe_payment_id, status (pending/cleared/failed), created_at
   - **Ownership**: 
     - Charges: Auto-generated monthly via scheduled job from leases
     - Payments: Stripe webhook or manual entry
   - **Key**: Negative amounts = charges, positive amounts = payments

5. **`applicants`** (Leasing Hub) - Prospective tenants
   - id, property_id, unit_id, name, email, phone, application_date, status (inquiry/applied/approved/rejected/signed), move_in_date, notes, created_at
   - **Ownership**: Created via leasing workflow

### Event-Driven Insight Calculation
**New Table**: `insight_calculation_queue`
- id, lease_id, trigger_type (transaction_updated/lease_updated/communication_logged), triggered_at, status (pending/processing/completed), calculated_at
- **Purpose**: Queue insight recalculations when source data changes

**Migration Path for tenant_insights_v2**:
- Keep existing insights as read-only historical records
- New insights calculated from leases + transactions (link via tenant_name + unit)
- Gradually deprecate CSV-generated insights as leases/transactions become source of truth

## 3. Ingestion Migration Strategy

### Phase 1: Dual-Write (Weeks 1-4)
**Keep CSV ingestion** for existing workflows, but **also** write to native tables:
- CSV upload → merge-data function → **BOTH** tenant_insights_v2 (existing) **AND** leases/transactions tables (new)
- CSV data interpreted as: current lease (active lease with today's date) + outstanding charges (past_due + delinquent_rent as transaction charges)
- **No breaking changes** - existing dashboard still works

### Phase 2: Native Entry UI (Weeks 5-6)
- Build Property/Unit management UI
- Build Lease creation/editing UI (replace CSV upload for new leases)
- **CSV still works** but new leases should use native entry

### Phase 3: Migration Tool (Week 7)
- One-time migration script to backfill leases/transactions from existing tenant_insights_v2 data
- **CSV becomes backup** - native entry is primary

### Phase 4: CSV Deprecation (Week 8+)
- Remove CSV upload from main workflow
- Keep CSV import as admin-only tool for bulk imports (if needed)

## 4. Milestones by Week (8-Week Plan)

### **Week 1: Foundation - Properties & Units**
**Deliverables**:
- Create `properties` table migration
- Create `units` table migration  
- Create Property management UI (list, create, edit properties)
- Create Unit management UI (list units by property, create, edit)
- Manual data entry: Add pilot property + all units

**Database Changes**:
```sql
CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  owner_name text,
  management_company text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  unit_number text NOT NULL,
  bedrooms integer,
  bathrooms numeric(3,1),
  sqft integer,
  amenities text[],
  status text DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'make-ready')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(property_id, unit_number)
);
```

**Frontend**: `src/components/PropertiesPage.tsx`, `src/components/UnitsPage.tsx`

**Success Criteria**: Can manually create 1 property with all its units in UI

---

### **Week 2: Leases - Source of Truth**
**Deliverables**:
- Create `leases` table migration
- Create Lease management UI (create, edit, list leases by property/unit)
- Link leases to units (dropdown in UI)
- Manual data entry: Create leases for current tenants in pilot property

**Database Changes**:
```sql
CREATE TABLE leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  tenant_name text NOT NULL,
  tenant_email text,
  tenant_phone text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric(10,2) NOT NULL,
  security_deposit numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'renewed', 'terminated')),
  renewal_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_leases_unit_id ON leases(unit_id);
CREATE INDEX idx_leases_status ON leases(status) WHERE status = 'active';
```

**Frontend**: `src/components/LeasesPage.tsx`, update Dashboard to show leases

**Success Criteria**: All current tenants have active leases in database

---

### **Week 3: Transactions - Financial Spine**
**Deliverables**:
- Create `transactions` table migration
- Create Transaction UI (list transactions by lease, manual entry)
- Link Stripe payments to transactions (update `create-checkout-session` to create transaction on payment)
- Manual data entry: Create outstanding charges (past_due) as transactions for existing leases

**Database Changes**:
```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES leases(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('charge', 'payment', 'adjustment')),
  amount numeric(10,2) NOT NULL, -- negative for charges, positive for payments
  date date NOT NULL,
  description text,
  payment_method text CHECK (payment_method IN ('stripe', 'manual', 'cash', 'ach')),
  stripe_payment_id text,
  status text DEFAULT 'cleared' CHECK (status IN ('pending', 'cleared', 'failed', 'refunded')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_transactions_lease_id ON transactions(lease_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
```

**Frontend**: `src/components/TransactionsPage.tsx`, update RentPaymentModal to link to transactions

**Backend**: Update `supabase/functions/create-checkout-session/index.ts` to create transaction record

**Success Criteria**: Stripe payments create transaction records, can manually enter charges/payments

---

### **Week 4: Dual-Write CSV Integration**
**Deliverables**:
- Update `merge-data` function to **also** create/update leases and transactions from CSV
- CSV parsing logic: Interpret CSV rows as lease data + outstanding charges
- **Keep existing** tenant_insights_v2 write for backward compatibility
- Migration script: One-time backfill of leases/transactions from existing CSV-generated insights

**Logic**:
```typescript
// In merge-data function, after merging CSV data:
for (const record of mergedRecords) {
  // Find or create lease
  const lease = await findOrCreateLease({
    property: record.property,
    unit: record.unit,
    tenant_name: record.tenant,
    monthly_rent: record.rentAmount,
    start_date: record.moveInDate,
    end_date: record.leaseEndDate
  });
  
  // Create outstanding charge transactions from past_due
  if (record.pastDue > 0) {
    await createTransaction({
      lease_id: lease.id,
      type: 'charge',
      amount: -record.pastDue, // negative = charge
      date: new Date(),
      description: 'Outstanding balance from CSV import'
    });
  }
}
```

**Success Criteria**: CSV upload creates both tenant_insights_v2 (existing) and leases/transactions (new), no breaking changes

---

### **Week 5: Event-Driven Insight Calculation**
**Deliverables**:
- Create `insight_calculation_queue` table
- Create Edge Function `calculate-insight` that computes insights from lease + transactions
- Trigger insight calculation when transaction created/updated (via database trigger or Edge Function hook)
- Update Dashboard to show insights computed from leases/transactions (not CSV)

**Database Changes**:
```sql
CREATE TABLE insight_calculation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES leases(id) ON DELETE CASCADE NOT NULL,
  trigger_type text NOT NULL,
  triggered_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  calculated_at timestamptz,
  error_message text
);

CREATE INDEX idx_insight_queue_pending ON insight_calculation_queue(status) WHERE status = 'pending';

-- Database trigger to queue insight calculation on transaction insert/update
CREATE OR REPLACE FUNCTION queue_insight_calculation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO insight_calculation_queue (lease_id, trigger_type)
  VALUES (NEW.lease_id, 'transaction_updated')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_insight_queue
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION queue_insight_calculation();
```

**Backend**: `supabase/functions/calculate-insight/index.ts` - processes queue, calls Lambda, stores in tenant_insights_v2

**Success Criteria**: When transaction created, insight automatically recalculated within 5 minutes

---

### **Week 6: Leasing Hub - Applicant Management**
**Deliverables**:
- Create `applicants` table
- Create Applicant workflow UI (inquiry → application → approval → lease signing)
- Move-in action: Convert approved applicant to active lease (creates lease, updates unit status)
- Application status tracking

**Database Changes**:
```sql
CREATE TABLE applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  unit_id uuid REFERENCES units(id),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  application_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'applied', 'approved', 'rejected', 'signed', 'moved_in')),
  move_in_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Frontend**: `src/components/LeasingHubPage.tsx`, applicant detail view with status progression

**Success Criteria**: Can create applicant, move through workflow stages, convert to lease on move-in

---

### **Week 7: Automated Rent Charges & Lease Expirations**
**Deliverables**:
- Scheduled Edge Function (or Supabase cron) to generate monthly rent charges from active leases
- Lease expiration alerts (30/60/90 days before end_date)
- Auto-expire leases (status → 'expired') when end_date passes
- Renewal workflow: Create new lease from expired lease

**Backend**: `supabase/functions/generate-rent-charges/index.ts`
- Runs on 1st of each month (or configurable schedule)
- For each active lease, create transaction charge for monthly_rent
- Skip if charge already exists for that month

**Frontend**: Lease expiration dashboard widget, renewal button on expired leases

**Success Criteria**: Rent charges auto-generated monthly, lease expiration alerts shown in dashboard

---

### **Week 8: CSV Deprecation & Polish**
**Deliverables**:
- Remove CSV upload from main Dashboard workflow (move to admin-only Settings page)
- Migration complete: All current tenants have leases + transactions
- Update all Dashboard views to source from leases/transactions (not tenant_insights_v2 source fields)
- Tenant Insights become fully derived/computed (event-driven)
- Documentation: User guide for native lease/transaction entry

**Frontend**: Remove FileUpload from main Dashboard, update Dashboard to query leases/transactions

**Success Criteria**: 
- No CSV dependency for day-to-day operations
- All insights computed from leases/transactions
- Pilot property fully migrated to native data entry

---

## 5. Risks + Mitigations

### **Risk 1: Breaking Existing CSV Workflows**
**Impact**: High - Users rely on CSV upload for insights
**Mitigation**: 
- Dual-write strategy (Week 4) ensures CSV still works during transition
- Keep CSV as admin tool even after deprecation
- Migration tool (Week 4) backfills leases/transactions from existing CSV data
- **Rollback plan**: Can revert to CSV-only if needed (leases/transactions tables are additive)

### **Risk 2: Data Migration Loss**
**Impact**: High - Losing existing tenant/lease data
**Mitigation**:
- Migration script creates leases from existing tenant_insights_v2 (Week 4)
- Keep tenant_insights_v2 as read-only historical archive
- Test migration on staging/copy of production data first
- Export CSV backup before migration

### **Risk 3: Lambda Dependency for Insights**
**Impact**: Medium - Event-driven insights still depend on external Lambda
**Mitigation**:
- Queue-based system (insight_calculation_queue) allows retry on failure
- Insights calculated asynchronously (no blocking UI)
- Fallback: Show "last calculated" timestamp, allow manual recalculation
- **Future**: Consider local scoring model to remove Lambda dependency

### **Risk 4: Complex Transaction Reconciliation**
**Impact**: Medium - Stripe payments must match transaction records
**Mitigation**:
- Webhook handler (Week 3) creates transactions automatically
- Manual reconciliation UI to match unmatched Stripe payments
- Transaction status tracking (pending/cleared/failed)
- **Deferred**: Full bank reconciliation not in scope

### **Risk 5: Lease Data Entry Errors**
**Impact**: Medium - Wrong rent amounts or dates create incorrect charges
**Mitigation**:
- Validation rules in Lease UI (end_date > start_date, monthly_rent > 0)
- Confirmation dialog before creating charges
- Edit/delete transactions (with audit trail)
- Unit tests for charge generation logic

### **Risk 6: Event-Driven Insight Performance**
**Impact**: Low-Medium - Many transactions trigger many insight recalculations
**Mitigation**:
- Queue system batches calculations
- Debounce: Only calculate once per lease per hour maximum
- Background processing (non-blocking)
- Monitor queue depth, scale if needed

### **Risk 7: Pilot Property Data Inconsistency**
**Impact**: Low - Single property should be manageable
**Mitigation**:
- Manual verification: Review all leases/transactions for pilot property
- Data validation UI shows warnings (e.g., "Lease expires in 30 days, no renewal")
- Test with real pilot property data before Week 4 dual-write

---

## Success Metrics

**Week 1-2**: Properties/Units/Leases created for pilot property
**Week 3-4**: All outstanding balances recorded as transactions, CSV dual-write working
**Week 5**: First event-driven insight calculated from lease + transactions
**Week 6**: First applicant converted to lease via Leasing Hub
**Week 7**: Automated rent charges generated for pilot property
**Week 8**: CSV upload removed from main workflow, pilot property fully on native entry

**End Goal**: Single property managed entirely via Properties → Units → Leases → Transactions, with event-driven insights and Leasing Hub workflow.







