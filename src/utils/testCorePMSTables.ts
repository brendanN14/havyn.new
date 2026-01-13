/**
 * Utility to test if Core PMS tables exist
 * Call this from browser console: window.testCorePMSTables()
 */

import { supabase } from '../lib/supabase';

export async function testCorePMSTables() {
  const results: { [key: string]: { exists: boolean; error?: string; count?: number } } = {};

  const tables = [
    'core_user_profiles',
    'core_properties',
    'core_units',
    'core_residents',
    'core_leases',
    'core_ledger_accounts',
    'core_ledger_txns',
    'core_tenant_insights'
  ];

  console.log('🔍 Testing Core PMS tables...\n');

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results[table] = { exists: false, error: error.message };
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        results[table] = { exists: true, count: count || 0 };
        console.log(`✅ ${table}: EXISTS (${count || 0} rows)`);
      }
    } catch (err: any) {
      results[table] = { exists: false, error: err.message };
      console.log(`❌ ${table}: ${err.message}`);
    }
  }

  const allExist = Object.values(results).every(r => r.exists);
  
  console.log('\n' + '='.repeat(50));
  if (allExist) {
    console.log('✅ All Core PMS tables exist!');
  } else {
    console.log('❌ Some tables are missing. Please run the migration.');
  }
  console.log('='.repeat(50));

  return results;
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).testCorePMSTables = testCorePMSTables;
}




