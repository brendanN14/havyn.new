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

/**
 * Seed leads, tours, and applications for existing properties
 * This creates a full leasing workflow demo
 */
export async function seedLeasingHubDataForCurrentUser() {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('You must be logged in to seed data');
    }

    console.log('Seeding Leasing Hub data for user:', user.id);

    // Get user's first property
    const { data: properties, error: propError } = await supabase
      .from('core_properties')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (propError) throw propError;
    if (!properties || properties.length === 0) {
      throw new Error('No property found. Please create a property first.');
    }

    const propertyId = properties[0].id;

    // Get vacant/ready units
    const { data: units, error: unitsError } = await supabase
      .from('core_units')
      .select('id, unit_code, asking_rent')
      .eq('property_id', propertyId)
      .in('status', ['vacant', 'make-ready'])
      .limit(10);

    if (unitsError) throw unitsError;
    if (!units || units.length === 0) {
      console.log('No vacant/ready units found. Creating demo leads without unit assignments.');
    }

    // Create 8-10 leads with varying stages
    const leadNames = [
      { first: 'Alex', last: 'Thompson', email: 'alex.thompson@email.com', phone: '555-1001', source: 'Zillow' },
      { first: 'Maria', last: 'Garcia', email: 'maria.garcia@email.com', phone: '555-1002', source: 'Apartments.com' },
      { first: 'Kevin', last: 'Lee', email: 'kevin.lee@email.com', phone: '555-1003', source: 'Referral' },
      { first: 'Rachel', last: 'Brown', email: 'rachel.brown@email.com', phone: '555-1004', source: 'Facebook' },
      { first: 'Tom', last: 'Wilson', email: 'tom.wilson@email.com', phone: '555-1005', source: 'Walk-in' },
      { first: 'Sophie', last: 'Martinez', email: 'sophie.martinez@email.com', phone: '555-1006', source: 'Craigslist' },
      { first: 'Chris', last: 'Anderson', email: 'chris.anderson@email.com', phone: '555-1007', source: 'Zillow' },
      { first: 'Emma', last: 'Taylor', email: 'emma.taylor@email.com', phone: '555-1008', source: 'Website' },
    ];

    const now = new Date();
    const leads = leadNames.map((name, idx) => {
      const nextAction = new Date(now);
      nextAction.setHours(nextAction.getHours() + (idx * 2)); // Stagger next actions

      let stage: 'inquiry' | 'tour_scheduled' | 'application' | 'approved' = 'inquiry';
      if (idx >= 6) stage = 'approved'; // Last 2 are approved
      else if (idx >= 4) stage = 'application'; // Middle 2 are in application
      else if (idx >= 2) stage = 'tour_scheduled'; // Some have tours scheduled

      return {
        property_id: propertyId,
        unit_id: units && units[idx % units.length] ? units[idx % units.length].id : null,
        owner_user_id: user.id,
        stage,
        next_action_at: nextAction.toISOString(),
        last_touch_at: now.toISOString(),
        first_name: name.first,
        last_name: name.last,
        email: name.email,
        phone: name.phone,
        source: name.source,
        notes: idx === 0 ? 'Interested in unit with parking' : null,
      };
    });

    const { data: createdLeads, error: leadsError } = await supabase
      .from('core_leads')
      .insert(leads)
      .select();

    if (leadsError) throw leadsError;
    console.log('Created leads:', createdLeads?.length);

    // Create tours for leads in tour_scheduled or application stage
    const tourLeads = createdLeads?.filter(l => ['tour_scheduled', 'application'].includes(l.stage)) || [];
    const tours = tourLeads.map((lead, idx) => {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + (idx + 1)); // Schedule over next few days
      scheduledAt.setHours(14 + idx); // Afternoon times

      let status: 'scheduled' | 'completed' | 'no_show' = 'scheduled';
      if (lead.stage === 'application') {
        status = idx % 2 === 0 ? 'completed' : 'scheduled'; // Some completed
      }

      return {
        lead_id: lead.id,
        unit_id: lead.unit_id,
        scheduled_at: scheduledAt.toISOString(),
        completed_at: status === 'completed' ? scheduledAt.toISOString() : null,
        status,
        notes: status === 'completed' ? 'Tour completed, interested in unit' : null,
        created_by: user.id,
      };
    });

    if (tours.length > 0) {
      const { data: createdTours, error: toursError } = await supabase
        .from('core_tours')
        .insert(tours)
        .select();

      if (toursError) throw toursError;
      console.log('Created tours:', createdTours?.length);
    }

    // Create applications for leads in application or approved stage
    const appLeads = createdLeads?.filter(l => ['application', 'approved'].includes(l.stage)) || [];
    const applications = appLeads.map((lead, idx) => {
      const submittedAt = new Date(now);
      submittedAt.setDate(submittedAt.getDate() - (idx + 1)); // Submitted in past few days

      let status: 'pending' | 'approved' | 'rejected' = 'pending';
      if (lead.stage === 'approved') {
        status = 'approved';
      }

      return {
        lead_id: lead.id,
        unit_id: lead.unit_id,
        status,
        submitted_at: submittedAt.toISOString(),
        reviewed_at: status === 'approved' ? submittedAt.toISOString() : null,
        income_amount: 4500 + (idx * 500), // Varying incomes
        credit_score: 650 + (idx * 20), // Varying credit scores
        notes: status === 'approved' ? 'Application approved, ready for lease conversion' : 'Application pending review',
        created_by: user.id,
      };
    });

    if (applications.length > 0) {
      const { data: createdApps, error: appsError } = await supabase
        .from('core_applications')
        .insert(applications)
        .select();

      if (appsError) throw appsError;
      console.log('Created applications:', createdApps?.length);
    }

    // Log activities
    const { logActivity } = await import('./activityLogging');
    for (const lead of createdLeads || []) {
      await logActivity({
        type: 'note',
        title: 'Lead created',
        description: 'Demo lead created',
        leadId: lead.id,
      });
    }

    console.log('✅ Leasing Hub seeding completed successfully!');
    return { success: true, message: 'Leasing Hub data seeded successfully' };
  } catch (error: any) {
    console.error('❌ Error seeding Leasing Hub data:', error);
    return { success: false, message: error.message || 'Failed to seed Leasing Hub data' };
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).seedLeasingHubData = seedLeasingHubDataForCurrentUser;
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).seedCorePMSData = seedCorePMSDataForCurrentUser;
}
