/*
  # Create Core Leads Table for Leasing Hub
  
  Creates the leads table with required fields and validation.
*/

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

-- Enable RLS
ALTER TABLE core_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view leads for their properties
CREATE POLICY "Users can view leads for their properties"
  ON core_leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_properties
      WHERE core_properties.id = core_leads.property_id
      AND core_properties.user_id = auth.uid()
    )
  );

-- Policy: Users can manage leads for their properties
CREATE POLICY "Users can manage leads for their properties"
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

-- Add constraint: cannot move to next stage without next_action_at
-- This is enforced in application layer, but we add a trigger for safety
CREATE OR REPLACE FUNCTION check_lead_stage_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If stage is changing and next_action_at is not set, prevent update
  IF NEW.stage != OLD.stage AND NEW.next_action_at IS NULL THEN
    RAISE EXCEPTION 'Cannot move to next stage without setting next_action_at';
  END IF;
  
  -- Update last_touch_at on any change
  NEW.last_touch_at = now();
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_lead_stage_transition_trigger
  BEFORE UPDATE ON core_leads
  FOR EACH ROW
  EXECUTE FUNCTION check_lead_stage_transition();

-- Indexes
CREATE INDEX idx_core_leads_property_id ON core_leads(property_id);
CREATE INDEX idx_core_leads_unit_id ON core_leads(unit_id);
CREATE INDEX idx_core_leads_owner_user_id ON core_leads(owner_user_id);
CREATE INDEX idx_core_leads_stage ON core_leads(stage);
CREATE INDEX idx_core_leads_next_action_at ON core_leads(next_action_at);



