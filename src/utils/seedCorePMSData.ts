/**
 * Utility function to seed Core PMS data with delinquency scenarios for the current user
 * This can be called from the browser console or a one-time setup page
 */

import { supabase } from '../lib/supabase';
import { updateTenantInsightsForLease } from './tenantInsights';

export async function seedCorePMSDataForCurrentUser() {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('You must be logged in to seed data');
    }

    console.log('Seeding Core PMS data with delinquencies for user:', user.id);

    // Check if property already exists
    const { data: existingProps } = await supabase
      .from('core_properties')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (existingProps && existingProps.length > 0) {
      console.log('Property already exists. Skipping seed.');
      return { success: false, message: 'Data already exists for this user' };
    }

    // Create property
    const { data: property, error: propError } = await supabase
      .from('core_properties')
      .insert({
        user_id: user.id,
        name: 'Sunset Apartments',
        address_line1: '1234 Sunset Boulevard',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90028'
      })
      .select()
      .single();

    if (propError) throw propError;
    console.log('Created property:', property.id);

    // Create 20 units with mixed statuses
    const unitCodes = Array.from({ length: 20 }, (_, i) => {
      const num = i + 1;
      return `10${num.toString().padStart(2, '0')}`;
    });
    
    const units = unitCodes.map((code, idx) => {
      let status: 'occupied' | 'vacant' | 'make-ready' = 'occupied';
      if (idx < 3) status = 'vacant';
      else if (idx === 3) status = 'make-ready';
      
      return {
        unit_code: code,
        beds: idx < 10 ? 1 : 2,
        baths: idx < 10 ? 1 : (idx < 15 ? 1.5 : 2),
        sqft: idx < 10 ? 650 : (idx < 15 ? 850 : 950),
        asking_rent: idx < 10 ? 1200 : (idx < 15 ? 1500 : 1700),
        status,
        showable: status === 'vacant' || status === 'make-ready',
        available_date: status === 'vacant' ? new Date().toISOString().split('T')[0] : null
      };
    });

    const { data: createdUnits, error: unitsError } = await supabase
      .from('core_units')
      .insert(units.map(u => ({ ...u, property_id: property.id })))
      .select();

    if (unitsError) throw unitsError;
    console.log('Created units:', createdUnits?.length);

    // Create 12 residents with email/phone (for draft outreach)
    const residentNames = [
      'John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Davis',
      'David Wilson', 'Jessica Martinez', 'Robert Taylor', 'Amanda Anderson',
      'James Thomas', 'Jennifer Jackson', 'Christopher White', 'Lisa Harris'
    ];
    
    const residents = residentNames.map((name, idx) => ({
      full_name: name,
      email: `${name.toLowerCase().replace(' ', '.')}@email.com`,
      phone: `555-${(1000 + idx).toString()}`,
      property_id: property.id,
      status: 'active' as const
    }));

    const { data: createdResidents, error: residentsError } = await supabase
      .from('core_residents')
      .insert(residents)
      .select();

    if (residentsError) throw residentsError;
    console.log('Created residents:', createdResidents?.length);

    // Create 12 active leases (one for each resident)
    const now = Date.now();
    const leases = createdResidents.slice(0, 12).map((resident, idx) => {
      const unit = createdUnits[idx + 3]; // Start from unit 104 (skip first 3 vacant)
      const leaseStart = new Date(now - (180 + idx * 30) * 24 * 60 * 60 * 1000);
      const leaseEnd = new Date(now + (180 - idx * 10) * 24 * 60 * 60 * 1000);
      
      return {
        unit_id: unit.id,
        primary_resident_id: resident.id,
        status: 'active' as const,
        lease_start: leaseStart.toISOString().split('T')[0],
        lease_end: leaseEnd.toISOString().split('T')[0],
        move_in_date: leaseStart.toISOString().split('T')[0],
        rent_amount: unit.asking_rent || 1200,
        deposit_amount: unit.asking_rent || 1200
      };
    });

      const { data: createdLeases, error: leasesError } = await supabase
        .from('core_leases')
        .insert(leases)
        .select();

      if (leasesError) throw leasesError;
      console.log('Created leases:', createdLeases?.length);

    // Create ledger accounts and transactions with delinquency scenarios
    if (createdLeases && createdUnits) {
      const today = new Date();
      
      for (let i = 0; i < createdLeases.length; i++) {
        const lease = createdLeases[i];
        const unit = createdUnits[i + 3];
        const rentAmount = unit.asking_rent || 1200;
        
        // Create ledger account
        const { data: ledgerAccount, error: ledgerError } = await supabase
          .from('core_ledger_accounts')
          .insert({
            lease_id: lease.id,
            current_balance: 0, // Will be updated after transactions
            days_past_due: 0,
            last_payment_at: null
          })
          .select()
          .single();

        if (ledgerError) {
          console.error(`Error creating ledger account for lease ${lease.id}:`, ledgerError);
          continue;
        }

        const transactions: any[] = [];
        
        // Scenario distribution:
        // 0-3: Current (balance 0)
        // 4-7: Mildly delinquent (7-14 days)
        // 8-10: Severe delinquent (30-60 days)
        // 11: Partial payment scenario
        
        if (i < 4) {
          // 4 Current accounts (balance 0)
          const rentDate = new Date(today);
          rentDate.setDate(rentDate.getDate() - 5);
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'charge',
            category: 'rent',
            amount: -rentAmount, // Negative for charge
            txn_date: rentDate.toISOString().split('T')[0],
            memo: 'Monthly rent',
            created_by: user.id
          });
          
          const paymentDate = new Date(rentDate);
          paymentDate.setDate(paymentDate.getDate() + 2);
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'payment',
            category: 'rent',
            amount: rentAmount, // Positive for payment
            txn_date: paymentDate.toISOString().split('T')[0],
            memo: 'Rent payment',
            created_by: user.id
          });
        } else if (i < 8) {
          // 4 Mildly delinquent (7-14 days past due)
          const daysPastDue = 7 + (i - 4) * 2; // 7, 9, 11, 13 days
          const rentDate = new Date(today);
          rentDate.setDate(rentDate.getDate() - daysPastDue);
          
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'charge',
            category: 'rent',
            amount: -rentAmount,
            txn_date: rentDate.toISOString().split('T')[0],
            memo: 'Monthly rent',
            created_by: user.id
          });
          
          // Add late fee for some
          if (i >= 6) {
            const lateFeeDate = new Date(rentDate);
            lateFeeDate.setDate(lateFeeDate.getDate() + 5);
            transactions.push({
              ledger_account_id: ledgerAccount.id,
              txn_type: 'charge',
              category: 'late_fee',
              amount: -50,
              txn_date: lateFeeDate.toISOString().split('T')[0],
              memo: 'Late fee',
              created_by: user.id
            });
          }
        } else if (i < 11) {
          // 3 Severe delinquent (30-60 days past due)
          const daysPastDue = 30 + (i - 8) * 15; // 30, 45, 60 days
          const rentDate = new Date(today);
          rentDate.setDate(rentDate.getDate() - daysPastDue);
          
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'charge',
            category: 'rent',
            amount: -rentAmount,
            txn_date: rentDate.toISOString().split('T')[0],
            memo: 'Monthly rent',
            created_by: user.id
          });
          
          // Add multiple months for severe
          if (i === 9) {
            const secondMonth = new Date(rentDate);
            secondMonth.setMonth(secondMonth.getMonth() + 1);
            transactions.push({
              ledger_account_id: ledgerAccount.id,
              txn_type: 'charge',
              category: 'rent',
              amount: -rentAmount,
              txn_date: secondMonth.toISOString().split('T')[0],
              memo: 'Monthly rent',
              created_by: user.id
            });
          }
          
          // Add late fees
          const lateFeeDate = new Date(rentDate);
          lateFeeDate.setDate(lateFeeDate.getDate() + 5);
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'charge',
            category: 'late_fee',
            amount: -50,
            txn_date: lateFeeDate.toISOString().split('T')[0],
            memo: 'Late fee',
            created_by: user.id
          });
        } else {
          // Partial payment scenario (i === 11)
          const rentDate = new Date(today);
          rentDate.setDate(rentDate.getDate() - 25);
          
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'charge',
            category: 'rent',
            amount: -rentAmount,
            txn_date: rentDate.toISOString().split('T')[0],
            memo: 'Monthly rent',
            created_by: user.id
          });
          
          // Partial payment (70% of rent)
          const paymentDate = new Date(rentDate);
          paymentDate.setDate(paymentDate.getDate() + 10);
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'payment',
            category: 'rent',
            amount: Math.floor(rentAmount * 0.7),
            txn_date: paymentDate.toISOString().split('T')[0],
            memo: 'Partial payment',
            created_by: user.id
          });
          
          // Credit applied (i === 11)
          const creditDate = new Date(paymentDate);
          creditDate.setDate(creditDate.getDate() + 5);
          transactions.push({
            ledger_account_id: ledgerAccount.id,
            txn_type: 'credit',
            category: 'misc',
            amount: 100,
            txn_date: creditDate.toISOString().split('T')[0],
            memo: 'Goodwill credit',
            created_by: user.id
          });
        }

        // Insert transactions
        if (transactions.length > 0) {
          const { error: txnError } = await supabase
            .from('core_ledger_txns')
            .insert(transactions);

          if (txnError) {
            console.error(`Error inserting transactions for lease ${lease.id}:`, txnError);
          } else {
            // Update tenant insights (this will recalculate balance and days_past_due)
            await updateTenantInsightsForLease(lease.id);
            console.log(`Created transactions and insights for lease ${i + 1}`);
          }
        }
      }
    }

    console.log('✅ Seeding completed successfully!');
    return { success: true, message: 'Data seeded successfully with delinquencies' };
  } catch (error: any) {
    console.error('❌ Error seeding data:', error);
    return { success: false, message: error.message || 'Failed to seed data' };
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).seedCorePMSData = seedCorePMSDataForCurrentUser;
}
