# Migration Instructions - Leasing Hub Tables

## Problem

If you're seeing errors like:
- `relation "public.core_leads" does not exist`
- `relation "public.core_tours" does not exist`
- `relation "public.core_applications" does not exist`

This means the Leasing Hub database tables haven't been created yet.

## Solution: Run Migrations

You need to run the migration SQL files in your Supabase database.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Leads Migration

Copy and paste the contents of:
```
supabase/migrations/20260109000001_create_core_leads.sql
```

Click **Run** or press `Ctrl+Enter` (or `Cmd+Enter` on Mac).

### Step 3: Run the Tours & Applications Migration

Copy and paste the contents of:
```
supabase/migrations/20260109000002_create_tours_applications.sql
```

Click **Run** or press `Ctrl+Enter` (or `Cmd+Enter` on Mac).

### Step 4: Verify

After running both migrations, refresh your app and try:
- Creating a lead from the vacancy board
- Viewing the leads page
- The errors should be gone!

## Quick Copy-Paste (Leads Table)

If you want to run it quickly, here's the SQL:

```sql
CREATE TABLE IF NOT EXISTS core_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES core_properties(id) ON DELETE CASCADE NOT NULL,
  unit_id uuid REFERENCES core_units(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  stage text NOT NULL CHECK (stage IN ('inquiry', 'tour_scheduled', 'application', 'approved', 'lease_signed', 'moved_in', 'lost', 'nurture')),
  next_action_at timestamptz NOT NULL,
  last_touch_at timestamptz NOT NULL DEFAULT now(),
  first_name text,
  last_name text,
  email text,
  phone text,
  notes text,
  source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE core_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view leads for their properties"
  ON core_leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_leads.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can manage leads for their properties"
  ON core_leads FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_leads.property_id
      AND core_properties.user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_leads.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_core_leads_property_id ON core_leads(property_id);
CREATE INDEX IF NOT EXISTS idx_core_leads_unit_id ON core_leads(unit_id);
CREATE INDEX IF NOT EXISTS idx_core_leads_owner_user_id ON core_leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_core_leads_stage ON core_leads(stage);
CREATE INDEX IF NOT EXISTS idx_core_leads_next_action_at ON core_leads(next_action_at);
```

## Quick Copy-Paste (Tours & Applications)

```sql
CREATE TABLE IF NOT EXISTS core_tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES core_leads(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES core_units(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES core_leads(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES core_units(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  income_amount numeric(10,2),
  credit_score integer,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on tours
ALTER TABLE core_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view tours for their properties"
  ON core_tours FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leads
      JOIN core_properties ON core_properties.id = core_leads.property_id
      WHERE core_leads.id = core_tours.lead_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can manage tours for their properties"
  ON core_tours FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leads
      JOIN core_properties ON core_properties.id = core_leads.property_id
      WHERE core_leads.id = core_tours.lead_id
      AND core_properties.user_id = auth.uid()
    )
  );

-- Enable RLS on applications
ALTER TABLE core_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view applications for their properties"
  ON core_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leads
      JOIN core_properties ON core_properties.id = core_leads.property_id
      WHERE core_leads.id = core_applications.lead_id
      AND core_properties.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can manage applications for their properties"
  ON core_applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leads
      JOIN core_properties ON core_properties.id = core_leads.property_id
      WHERE core_leads.id = core_applications.lead_id
      AND core_properties.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_core_tours_lead_id ON core_tours(lead_id);
CREATE INDEX IF NOT EXISTS idx_core_tours_unit_id ON core_tours(unit_id);
CREATE INDEX IF NOT EXISTS idx_core_tours_scheduled_at ON core_tours(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_core_applications_lead_id ON core_applications(lead_id);
CREATE INDEX IF NOT EXISTS idx_core_applications_unit_id ON core_applications(unit_id);
CREATE INDEX IF NOT EXISTS idx_core_applications_status ON core_applications(status);
```

## Troubleshooting

### Error: "relation core_properties does not exist"
- Run the Core PMS schema migration first: `supabase/migrations/20250102000000_create_core_pms_schema.sql`

### Error: "permission denied"
- Make sure you're logged in as a user with appropriate permissions
- The RLS policies require you to own the property

### Tables still don't appear
- Refresh the Supabase dashboard
- Check the SQL Editor logs for any errors
- Make sure you ran both migration files in order

## Need Help?

If you continue to have issues:
1. Check the Supabase SQL Editor for error messages
2. Verify your connection to Supabase is working
3. Make sure all prerequisite tables exist (core_properties, core_units)



