// Integrity check utilities for Core PMS
import { supabase } from '../lib/supabase';

export interface IntegrityIssue {
  type: 'missing_ledger_account' | 'occupied_no_lease' | 'invalid_unit_status';
  leaseId?: string;
  unitId?: string;
  description: string;
}

/**
 * Check for missing ledger accounts for active leases
 */
export async function checkMissingLedgerAccounts(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  const { data: leases, error } = await supabase
    .from('core_leases')
    .select('id, unit_id')
    .eq('status', 'active');

  if (error) {
    console.error('[IntegrityCheck] Error fetching leases:', error);
    return issues;
  }

  if (!leases || leases.length === 0) return issues;

  const leaseIds = leases.map(l => l.id);

  const { data: ledgerAccounts } = await supabase
    .from('core_ledger_accounts')
    .select('lease_id')
    .in('lease_id', leaseIds);

  const ledgerLeaseIds = new Set(ledgerAccounts?.map(la => la.lease_id) || []);

  leases.forEach(lease => {
    if (!ledgerLeaseIds.has(lease.id)) {
      issues.push({
        type: 'missing_ledger_account',
        leaseId: lease.id,
        unitId: lease.unit_id,
        description: `Active lease ${lease.id} is missing a ledger account`
      });
    }
  });

  return issues;
}

/**
 * Check for occupied/reserved units without active leases
 */
export async function checkOccupiedUnitsWithoutLeases(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  const { data: units, error } = await supabase
    .from('core_units')
    .select('id, unit_code, status')
    .in('status', ['occupied', 'reserved']);

  if (error) {
    console.error('[IntegrityCheck] Error fetching units:', error);
    return issues;
  }

  if (!units || units.length === 0) return issues;

  const unitIds = units.map(u => u.id);

  const { data: leases } = await supabase
    .from('core_leases')
    .select('unit_id')
    .in('unit_id', unitIds)
    .eq('status', 'active');

  const leasedUnitIds = new Set(leases?.map(l => l.unit_id) || []);

  units.forEach(unit => {
    if (!leasedUnitIds.has(unit.id)) {
      issues.push({
        type: 'occupied_no_lease',
        unitId: unit.id,
        description: `Unit ${unit.unit_code} is ${unit.status} but has no active lease`
      });
    }
  });

  return issues;
}

/**
 * Check for invalid unit status combinations
 */
export async function checkInvalidUnitStatus(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  const { data: units, error } = await supabase
    .from('core_units')
    .select('id, unit_code, status, showable, available_date');

  if (error) {
    console.error('[IntegrityCheck] Error fetching units:', error);
    return issues;
  }

  if (!units || units.length === 0) return issues;

  units.forEach(unit => {
    // Check: occupied units should have showable=false
    if (unit.status === 'occupied' && unit.showable === true) {
      issues.push({
        type: 'invalid_unit_status',
        unitId: unit.id,
        description: `Unit ${unit.unit_code} is occupied but showable=true`
      });
    }

    // Check: vacant/make-ready/reserved units should have available_date
    if (['vacant', 'make-ready', 'reserved'].includes(unit.status) && !unit.available_date) {
      issues.push({
        type: 'invalid_unit_status',
        unitId: unit.id,
        description: `Unit ${unit.unit_code} is ${unit.status} but missing available_date`
      });
    }
  });

  return issues;
}

/**
 * Run all integrity checks
 */
export async function runAllIntegrityChecks(): Promise<IntegrityIssue[]> {
  const [ledgerIssues, leaseIssues, statusIssues] = await Promise.all([
    checkMissingLedgerAccounts(),
    checkOccupiedUnitsWithoutLeases(),
    checkInvalidUnitStatus()
  ]);

  return [...ledgerIssues, ...leaseIssues, ...statusIssues];
}

/**
 * Fix missing ledger accounts (safe operation)
 */
export async function fixMissingLedgerAccounts(): Promise<{ fixed: number; errors: string[] }> {
  const issues = await checkMissingLedgerAccounts();
  const errors: string[] = [];
  let fixed = 0;

  for (const issue of issues) {
    if (issue.type === 'missing_ledger_account' && issue.leaseId) {
      const { error } = await supabase
        .from('core_ledger_accounts')
        .insert({
          lease_id: issue.leaseId,
          current_balance: 0,
          days_past_due: 0
        });

      if (error) {
        errors.push(`Failed to create ledger account for lease ${issue.leaseId}: ${error.message}`);
      } else {
        fixed++;
      }
    }
  }

  return { fixed, errors };
}



