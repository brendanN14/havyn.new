/*
  # Core PMS Schema - Havyn 2.0

  Creates the foundational tables for Core PMS (Beta) with minimal PMS spine.
  All tables prefixed with `core_` to separate from existing CSV/Insights system.
*/

-- Create user profiles table for roles
CREATE TABLE IF NOT EXISTS core_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'property_manager' CHECK (role IN ('platform_admin', 'property_manager', 'leasing_agent', 'owner_readonly')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE core_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON core_user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON core_user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_core_user_profiles_user_id ON core_user_profiles(user_id);
CREATE INDEX idx_core_user_profiles_role ON core_user_profiles(role);

-- Create properties table
CREATE TABLE IF NOT EXISTS core_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'USA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on properties
ALTER TABLE core_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own properties"
  ON core_properties FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own properties"
  ON core_properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties"
  ON core_properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties"
  ON core_properties FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_core_properties_user_id ON core_properties(user_id);

-- Create units table
CREATE TABLE IF NOT EXISTS core_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES core_properties(id) ON DELETE CASCADE NOT NULL,
  unit_code text NOT NULL,
  beds integer,
  baths numeric(3,1),
  sqft integer,
  asking_rent numeric(10,2),
  status text DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'make-ready', 'reserved')),
  available_date date,
  showable boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, unit_code)
);

-- Enable RLS on units
ALTER TABLE core_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view units of their properties"
  ON core_units FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_units.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert units to their properties"
  ON core_units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_units.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update units of their properties"
  ON core_units FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_units.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete units of their properties"
  ON core_units FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_units.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE INDEX idx_core_units_property_id ON core_units(property_id);
CREATE INDEX idx_core_units_status ON core_units(status);

-- Create residents table
CREATE TABLE IF NOT EXISTS core_residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES core_properties(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospective')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on residents
ALTER TABLE core_residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view residents of their properties"
  ON core_residents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_residents.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert residents to their properties"
  ON core_residents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_residents.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update residents of their properties"
  ON core_residents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_residents.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE INDEX idx_core_residents_property_id ON core_residents(property_id);
CREATE INDEX idx_core_residents_status ON core_residents(status);

-- Create leases table
CREATE TABLE IF NOT EXISTS core_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES core_units(id) ON DELETE CASCADE NOT NULL,
  primary_resident_id uuid REFERENCES core_residents(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'pending')),
  lease_start date NOT NULL,
  lease_end date NOT NULL,
  move_in_date date,
  move_out_date date,
  rent_amount numeric(10,2) NOT NULL,
  deposit_amount numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (lease_end >= lease_start)
);

-- Enable RLS on leases
ALTER TABLE core_leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leases of their properties"
  ON core_leases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_units
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_units.id = core_leases.unit_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert leases to their units"
  ON core_leases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_units
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_units.id = core_leases.unit_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update leases of their units"
  ON core_leases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_units
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_units.id = core_leases.unit_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE INDEX idx_core_leases_unit_id ON core_leases(unit_id);
CREATE INDEX idx_core_leases_primary_resident_id ON core_leases(primary_resident_id);
CREATE INDEX idx_core_leases_status ON core_leases(status);

-- Create ledger accounts table
CREATE TABLE IF NOT EXISTS core_ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES core_leases(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_balance numeric(10,2) DEFAULT 0,
  days_past_due integer DEFAULT 0,
  last_payment_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on ledger accounts
ALTER TABLE core_ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ledger accounts of their leases"
  ON core_ledger_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leases
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_leases.id = core_ledger_accounts.lease_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage ledger accounts of their leases"
  ON core_ledger_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leases
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_leases.id = core_ledger_accounts.lease_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE INDEX idx_core_ledger_accounts_lease_id ON core_ledger_accounts(lease_id);

-- Create ledger transactions table
CREATE TABLE IF NOT EXISTS core_ledger_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_account_id uuid REFERENCES core_ledger_accounts(id) ON DELETE CASCADE NOT NULL,
  txn_type text NOT NULL CHECK (txn_type IN ('charge', 'payment', 'credit', 'fee', 'refund', 'reversal')),
  category text,
  amount numeric(10,2) NOT NULL,
  txn_date date NOT NULL,
  memo text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on ledger transactions
ALTER TABLE core_ledger_txns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions of their ledger accounts"
  ON core_ledger_txns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_ledger_accounts
      JOIN core_leases ON core_leases.id = core_ledger_accounts.lease_id
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_ledger_accounts.id = core_ledger_txns.ledger_account_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transactions to their ledger accounts"
  ON core_ledger_txns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_ledger_accounts
      JOIN core_leases ON core_leases.id = core_ledger_accounts.lease_id
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_ledger_accounts.id = core_ledger_txns.ledger_account_id
      AND core_properties.user_id = auth.uid()
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE INDEX idx_core_ledger_txns_ledger_account_id ON core_ledger_txns(ledger_account_id);
CREATE INDEX idx_core_ledger_txns_txn_date ON core_ledger_txns(txn_date DESC);
CREATE INDEX idx_core_ledger_txns_txn_type ON core_ledger_txns(txn_type);

-- Create tenant insights table (event-driven insights)
CREATE TABLE IF NOT EXISTS core_tenant_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES core_leases(id) ON DELETE CASCADE NOT NULL,
  category text,
  score_band text CHECK (score_band IN ('low', 'medium', 'high')),
  reasons text[],
  recommended_action text,
  narrative_summary text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on tenant insights
ALTER TABLE core_tenant_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights of their leases"
  ON core_tenant_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leases
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_leases.id = core_tenant_insights.lease_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE INDEX idx_core_tenant_insights_lease_id ON core_tenant_insights(lease_id);
CREATE INDEX idx_core_tenant_insights_updated_at ON core_tenant_insights(updated_at DESC);





