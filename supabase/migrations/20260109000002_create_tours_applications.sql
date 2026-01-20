/*
  # Create Tours and Applications Tables for Leasing Hub
  
  Creates tables for tracking tours and applications as part of the leasing pipeline.
*/

-- Create tours table
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

-- Create applications table
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

CREATE POLICY "Users can view tours for their properties"
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

CREATE POLICY "Users can manage tours for their properties"
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

CREATE POLICY "Users can view applications for their properties"
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

CREATE POLICY "Users can manage applications for their properties"
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
CREATE INDEX idx_core_tours_lead_id ON core_tours(lead_id);
CREATE INDEX idx_core_tours_unit_id ON core_tours(unit_id);
CREATE INDEX idx_core_tours_scheduled_at ON core_tours(scheduled_at);
CREATE INDEX idx_core_applications_lead_id ON core_applications(lead_id);
CREATE INDEX idx_core_applications_unit_id ON core_applications(unit_id);
CREATE INDEX idx_core_applications_status ON core_applications(status);



