/**
 * Utility to check if required tables exist and create them if missing
 * This is a fallback for when migrations haven't been run
 */

import { supabase } from '../lib/supabase';

export async function checkAndCreateLeadsTable(): Promise<{ exists: boolean; created?: boolean; error?: string }> {
  try {
    // Try to query the table - if it fails, the table doesn't exist
    const { error: checkError } = await supabase
      .from('core_leads')
      .select('id')
      .limit(1);

    // If no error, table exists
    if (!checkError) {
      return { exists: true };
    }

    // If error is "relation does not exist", create the table
    if (checkError.message?.includes('does not exist') || checkError.code === '42P01') {
      console.log('[checkAndCreateTables] core_leads table does not exist, creating...');
      
      // Run the migration SQL
      const migrationSQL = `
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

        -- Policy: Users can manage leads for their properties
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

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_core_leads_property_id ON core_leads(property_id);
        CREATE INDEX IF NOT EXISTS idx_core_leads_unit_id ON core_leads(unit_id);
        CREATE INDEX IF NOT EXISTS idx_core_leads_owner_user_id ON core_leads(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_core_leads_stage ON core_leads(stage);
        CREATE INDEX IF NOT EXISTS idx_core_leads_next_action_at ON core_leads(next_action_at);
      `;

      // Note: Supabase client doesn't support raw SQL execution directly
      // This would need to be run via a database function or admin API
      // For now, we'll return an error asking user to run migration manually
      
      return {
        exists: false,
        created: false,
        error: 'Table core_leads does not exist. Please run the migration in Supabase SQL Editor:\nsupabase/migrations/20260109000001_create_core_leads.sql'
      };
    }

    // Other error
    return { exists: false, error: checkError.message };
  } catch (err: any) {
    return { exists: false, error: err.message || 'Unknown error' };
  }
}

export async function checkAndCreateToursApplicationsTables(): Promise<{ exists: boolean; created?: boolean; error?: string }> {
  try {
    // Check core_tours
    const { error: toursError } = await supabase
      .from('core_tours')
      .select('id')
      .limit(1);

    // Check core_applications
    const { error: appsError } = await supabase
      .from('core_applications')
      .select('id')
      .limit(1);

    if (!toursError && !appsError) {
      return { exists: true };
    }

    // One or both tables don't exist
    const missingTables = [];
    if (toursError?.message?.includes('does not exist') || toursError?.code === '42P01') {
      missingTables.push('core_tours');
    }
    if (appsError?.message?.includes('does not exist') || appsError?.code === '42P01') {
      missingTables.push('core_applications');
    }

    if (missingTables.length > 0) {
      return {
        exists: false,
        created: false,
        error: `Tables ${missingTables.join(', ')} do not exist. Please run the migration in Supabase SQL Editor:\nsupabase/migrations/20260109000002_create_tours_applications.sql`
      };
    }

    return { exists: true };
  } catch (err: any) {
    return { exists: false, error: err.message || 'Unknown error' };
  }
}



