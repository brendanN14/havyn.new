/*
  # Add Communication Logging for Core PMS
  
  Adds communication logging and contact tracking to Core PMS workflow.
*/

-- Add communication tracking fields to ledger accounts
ALTER TABLE core_ledger_accounts 
  ADD COLUMN IF NOT EXISTS promise_to_pay_date date,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- Create communication logs table for Core PMS
CREATE TABLE IF NOT EXISTS core_communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES core_leases(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'in_person', 'note')),
  subject text,
  message text NOT NULL,
  status text CHECK (status IN ('sent', 'failed', 'delivered', 'read', 'pending', 'copied')),
  recipient_email text,
  recipient_phone text,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on communication logs
ALTER TABLE core_communication_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view communication logs for their leases
CREATE POLICY "Users can view communication logs for their leases"
  ON core_communication_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leases
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_leases.id = core_communication_logs.lease_id
      AND core_properties.user_id = auth.uid()
    )
  );

-- Policy: Users can insert communication logs for their leases
CREATE POLICY "Users can insert communication logs for their leases"
  ON core_communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_leases
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_leases.id = core_communication_logs.lease_id
      AND core_properties.user_id = auth.uid()
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- Policy: Users can update communication logs for their leases
CREATE POLICY "Users can update communication logs for their leases"
  ON core_communication_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_leases
      JOIN core_units ON core_units.id = core_leases.unit_id
      JOIN core_properties ON core_properties.id = core_units.property_id
      WHERE core_leases.id = core_communication_logs.lease_id
      AND core_properties.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_core_communication_logs_lease_id ON core_communication_logs(lease_id);
CREATE INDEX IF NOT EXISTS idx_core_communication_logs_created_at ON core_communication_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_communication_logs_direction ON core_communication_logs(direction);
CREATE INDEX IF NOT EXISTS idx_core_communication_logs_channel ON core_communication_logs(channel);

