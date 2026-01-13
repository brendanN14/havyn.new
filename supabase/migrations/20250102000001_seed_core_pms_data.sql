/*
  # Seed Core PMS Data for Testing

  Seeds sample data for Core PMS (Beta) testing:
  - 1 property: Sunset Apartments
  - 25 units with mixed statuses
  - 12 active leases with residents
  - Ledger accounts and transactions
  - Tenant insights
*/

-- Note: This seed script should be run after a user is created
-- Replace 'USER_ID_HERE' with actual user_id from auth.users

-- Get the first user (or specify user_id)
DO $$
DECLARE
  v_user_id uuid;
  v_property_id uuid;
  v_unit_ids uuid[] := ARRAY[]::uuid[];
  v_resident_ids uuid[] := ARRAY[]::uuid[];
  v_lease_ids uuid[] := ARRAY[]::uuid[];
  v_ledger_account_ids uuid[] := ARRAY[]::uuid[];
  i integer;
BEGIN
  -- Get first authenticated user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Please create a user first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding data for user: %', v_user_id;

  -- 1. Create Property
  INSERT INTO core_properties (user_id, name, address_line1, city, state, zip_code)
  VALUES (
    v_user_id,
    'Sunset Apartments',
    '1234 Sunset Boulevard',
    'Los Angeles',
    'CA',
    '90028'
  )
  RETURNING id INTO v_property_id;

  RAISE NOTICE 'Created property: %', v_property_id;

  -- 2. Create 25 Units (mixed statuses)
  INSERT INTO core_units (property_id, unit_code, beds, baths, sqft, asking_rent, status, showable)
  VALUES
    (v_property_id, '101', 1, 1, 650, 1200, 'occupied', true),
    (v_property_id, '102', 1, 1, 650, 1200, 'occupied', true),
    (v_property_id, '103', 2, 1, 850, 1500, 'occupied', true),
    (v_property_id, '104', 2, 1, 850, 1500, 'vacant', true),
    (v_property_id, '105', 2, 2, 950, 1700, 'occupied', true),
    (v_property_id, '201', 1, 1, 650, 1200, 'occupied', true),
    (v_property_id, '202', 1, 1, 650, 1200, 'vacant', true),
    (v_property_id, '203', 2, 1, 850, 1500, 'occupied', true),
    (v_property_id, '204', 2, 1, 850, 1500, 'make-ready', false),
    (v_property_id, '205', 2, 2, 950, 1700, 'occupied', true),
    (v_property_id, '301', 1, 1, 650, 1200, 'occupied', true),
    (v_property_id, '302', 1, 1, 650, 1200, 'vacant', true),
    (v_property_id, '303', 2, 1, 850, 1500, 'occupied', true),
    (v_property_id, '304', 2, 1, 850, 1500, 'reserved', true),
    (v_property_id, '305', 2, 2, 950, 1700, 'occupied', true),
    (v_property_id, '401', 1, 1, 650, 1200, 'vacant', true),
    (v_property_id, '402', 1, 1, 650, 1200, 'occupied', true),
    (v_property_id, '403', 2, 1, 850, 1500, 'occupied', true),
    (v_property_id, '404', 2, 1, 850, 1500, 'vacant', true),
    (v_property_id, '405', 2, 2, 950, 1700, 'occupied', true),
    (v_property_id, '501', 1, 1, 650, 1200, 'vacant', true),
    (v_property_id, '502', 1, 1, 650, 1200, 'vacant', true),
    (v_property_id, '503', 2, 1, 850, 1500, 'vacant', true),
    (v_property_id, '504', 2, 1, 850, 1500, 'vacant', true),
    (v_property_id, '505', 2, 2, 950, 1700, 'vacant', true)
  RETURNING id INTO v_unit_ids;

  RAISE NOTICE 'Created % units', array_length(v_unit_ids, 1);

  -- 3. Create Residents (12 for active leases)
  INSERT INTO core_residents (property_id, full_name, email, phone, status)
  VALUES
    (v_property_id, 'John Smith', 'john.smith@email.com', '555-0101', 'active'),
    (v_property_id, 'Sarah Johnson', 'sarah.j@email.com', '555-0102', 'active'),
    (v_property_id, 'Michael Chen', 'mchen@email.com', '555-0103', 'active'),
    (v_property_id, 'Emily Rodriguez', 'emily.r@email.com', '555-0104', 'active'),
    (v_property_id, 'David Williams', 'dwilliams@email.com', '555-0105', 'active'),
    (v_property_id, 'Jessica Brown', 'j.brown@email.com', '555-0106', 'active'),
    (v_property_id, 'Robert Taylor', 'rtaylor@email.com', '555-0107', 'active'),
    (v_property_id, 'Amanda Martinez', 'a.martinez@email.com', '555-0108', 'active'),
    (v_property_id, 'James Anderson', 'j.anderson@email.com', '555-0109', 'active'),
    (v_property_id, 'Lisa Thompson', 'lisa.t@email.com', '555-0110', 'active'),
    (v_property_id, 'Christopher Lee', 'clee@email.com', '555-0111', 'active'),
    (v_property_id, 'Maria Garcia', 'm.garcia@email.com', '555-0112', 'active')
  RETURNING id INTO v_resident_ids;

  RAISE NOTICE 'Created % residents', array_length(v_resident_ids, 1);

  -- 4. Create Leases (12 active leases)
  INSERT INTO core_leases (
    unit_id, primary_resident_id, status, lease_start, lease_end, move_in_date, 
    rent_amount, deposit_amount
  )
  VALUES
    -- Current tenants (paid up)
    (v_unit_ids[1], v_resident_ids[1], 'active', 
     CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '6 months',
     CURRENT_DATE - INTERVAL '6 months', 1200, 1200),
    (v_unit_ids[2], v_resident_ids[2], 'active',
     CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE + INTERVAL '12 months',
     CURRENT_DATE - INTERVAL '12 months', 1200, 1200),
    (v_unit_ids[3], v_resident_ids[3], 'active',
     CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '9 months',
     CURRENT_DATE - INTERVAL '3 months', 1500, 1500),
    
    -- 10-20 days late
    (v_unit_ids[5], v_resident_ids[4], 'active',
     CURRENT_DATE - INTERVAL '8 months', CURRENT_DATE + INTERVAL '4 months',
     CURRENT_DATE - INTERVAL '8 months', 1700, 1700),
    (v_unit_ids[6], v_resident_ids[5], 'active',
     CURRENT_DATE - INTERVAL '18 months', CURRENT_DATE + INTERVAL '6 months',
     CURRENT_DATE - INTERVAL '18 months', 1200, 1200),
    
    -- 30-60 days late
    (v_unit_ids[8], v_resident_ids[6], 'active',
     CURRENT_DATE - INTERVAL '24 months', CURRENT_DATE + INTERVAL '12 months',
     CURRENT_DATE - INTERVAL '24 months', 1500, 1500),
    (v_unit_ids[10], v_resident_ids[7], 'active',
     CURRENT_DATE - INTERVAL '15 months', CURRENT_DATE + INTERVAL '9 months',
     CURRENT_DATE - INTERVAL '15 months', 1700, 1700),
    
    -- More current tenants
    (v_unit_ids[11], v_resident_ids[8], 'active',
     CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '10 months',
     CURRENT_DATE - INTERVAL '2 months', 1200, 1200),
    (v_unit_ids[13], v_resident_ids[9], 'active',
     CURRENT_DATE - INTERVAL '9 months', CURRENT_DATE + INTERVAL '3 months',
     CURRENT_DATE - INTERVAL '9 months', 1500, 1500),
    (v_unit_ids[15], v_resident_ids[10], 'active',
     CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '6 months',
     CURRENT_DATE - INTERVAL '6 months', 1700, 1700),
    
    -- Edge cases: partial payment, credit
    (v_unit_ids[17], v_resident_ids[11], 'active',
     CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE + INTERVAL '12 months',
     CURRENT_DATE - INTERVAL '12 months', 1500, 1500),
    (v_unit_ids[18], v_resident_ids[12], 'active',
     CURRENT_DATE - INTERVAL '4 months', CURRENT_DATE + INTERVAL '8 months',
     CURRENT_DATE - INTERVAL '4 months', 1500, 1500)
  RETURNING id INTO v_lease_ids;

  RAISE NOTICE 'Created % leases', array_length(v_lease_ids, 1);

  -- 5. Create Ledger Accounts (create all with default, then update specific ones)
  INSERT INTO core_ledger_accounts (lease_id, current_balance, days_past_due, last_payment_at)
  SELECT id, 0, 0, CURRENT_DATE - INTERVAL '5 days'
  FROM unnest(v_lease_ids) AS id
  RETURNING id INTO v_ledger_account_ids;

  -- Update specific accounts with balances and past due
  UPDATE core_ledger_accounts 
  SET current_balance = 1700.00, days_past_due = 10, last_payment_at = CURRENT_DATE - INTERVAL '30 days'
  WHERE lease_id = v_lease_ids[4];

  UPDATE core_ledger_accounts 
  SET current_balance = 1200.00, days_past_due = 15, last_payment_at = CURRENT_DATE - INTERVAL '30 days'
  WHERE lease_id = v_lease_ids[5];

  UPDATE core_ledger_accounts 
  SET current_balance = 3000.00, days_past_due = 35, last_payment_at = CURRENT_DATE - INTERVAL '30 days'
  WHERE lease_id = v_lease_ids[6];

  UPDATE core_ledger_accounts 
  SET current_balance = 3400.00, days_past_due = 45, last_payment_at = CURRENT_DATE - INTERVAL '30 days'
  WHERE lease_id = v_lease_ids[7];

  UPDATE core_ledger_accounts 
  SET current_balance = 750.00, days_past_due = 12, last_payment_at = CURRENT_DATE - INTERVAL '30 days'
  WHERE lease_id = v_lease_ids[11];

  UPDATE core_ledger_accounts 
  SET current_balance = -200.00, days_past_due = 0, last_payment_at = CURRENT_DATE - INTERVAL '5 days'
  WHERE lease_id = v_lease_ids[12];

  -- Get ledger account IDs back
  SELECT array_agg(id) INTO v_ledger_account_ids
  FROM core_ledger_accounts
  WHERE lease_id = ANY(v_lease_ids);

  RAISE NOTICE 'Created % ledger accounts', array_length(v_ledger_account_ids, 1);

  -- 6. Create Ledger Transactions
  -- Current tenants: Monthly rent charges + payments
  INSERT INTO core_ledger_txns (ledger_account_id, txn_type, category, amount, txn_date, memo, created_by)
  SELECT 
    la.id,
    'charge',
    'rent',
    -1500.00,  -- Negative = charge
    date_trunc('month', CURRENT_DATE)::date,
    'Monthly rent charge',
    v_user_id
  FROM core_ledger_accounts la
  WHERE la.lease_id IN (v_lease_ids[1], v_lease_ids[2], v_lease_ids[3], v_lease_ids[8], v_lease_ids[9], v_lease_ids[10]);

  -- Delinquent tenants: Past charges
  INSERT INTO core_ledger_txns (ledger_account_id, txn_type, category, amount, txn_date, memo, created_by)
  VALUES
    -- 10 days late
    (v_ledger_account_ids[4], 'charge', 'rent', -1700.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Monthly rent', v_user_id),
    
    -- 15 days late
    (v_ledger_account_ids[5], 'charge', 'rent', -1200.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Monthly rent', v_user_id),
    
    -- 35 days late (2 months)
    (v_ledger_account_ids[6], 'charge', 'rent', -1500.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '2 months', 'Monthly rent', v_user_id),
    (v_ledger_account_ids[6], 'charge', 'rent', -1500.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Monthly rent', v_user_id),
    
    -- 45 days late (2 months)
    (v_ledger_account_ids[7], 'charge', 'rent', -1700.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '2 months', 'Monthly rent', v_user_id),
    (v_ledger_account_ids[7], 'charge', 'rent', -1700.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Monthly rent', v_user_id),
    
    -- Partial payment (paid half)
    (v_ledger_account_ids[11], 'charge', 'rent', -1500.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Monthly rent', v_user_id),
    (v_ledger_account_ids[11], 'payment', 'rent', 750.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '18 days', 'Partial payment', v_user_id),
    
    -- Credit applied
    (v_ledger_account_ids[12], 'charge', 'rent', -1500.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Monthly rent', v_user_id),
    (v_ledger_account_ids[12], 'payment', 'rent', 1500.00, date_trunc('month', CURRENT_DATE)::date - INTERVAL '1 month', 'Rent payment', v_user_id),
    (v_ledger_account_ids[12], 'credit', 'refund', 200.00, CURRENT_DATE - INTERVAL '5 days', 'Maintenance credit', v_user_id);

  -- 7. Create Tenant Insights
  INSERT INTO core_tenant_insights (lease_id, category, score_band, reasons, recommended_action, narrative_summary)
  SELECT 
    la.lease_id,
    CASE 
      WHEN la.days_past_due >= 30 OR la.current_balance >= 2000 THEN 'severe_delinquent'
      WHEN la.days_past_due >= 6 THEN 'delinquent'
      WHEN la.days_past_due >= 1 OR la.current_balance > 0 THEN 'at_risk'
      ELSE 'current'
    END,
    CASE 
      WHEN la.days_past_due >= 30 THEN 'high'
      WHEN la.days_past_due >= 6 THEN 'medium'
      WHEN la.current_balance > 0 THEN 'low'
      ELSE 'low'
    END,
    ARRAY[
      CASE WHEN la.current_balance > 0 THEN format('Balance: $%s', la.current_balance) ELSE 'Account current' END,
      CASE WHEN la.days_past_due > 0 THEN format('Days past due: %s', la.days_past_due) ELSE 'No past due' END
    ],
    CASE 
      WHEN la.days_past_due >= 30 THEN 'Send formal notice and consider legal action'
      WHEN la.days_past_due >= 6 THEN 'Send payment reminder and follow up'
      WHEN la.current_balance > 0 THEN 'Send friendly payment reminder'
      ELSE 'Continue regular communication'
    END,
    CASE 
      WHEN la.days_past_due >= 30 THEN format('Resident is severely delinquent with $%s outstanding for %s days. Immediate action required.', la.current_balance, la.days_past_due)
      WHEN la.days_past_due >= 6 THEN format('Resident has been overdue for %s days with a balance of $%s. Follow-up needed.', la.days_past_due, la.current_balance)
      WHEN la.current_balance > 0 THEN format('Resident has a small outstanding balance of $%s. Monitor closely.', la.current_balance)
      ELSE 'Resident account is current with no outstanding balance.'
    END
  FROM core_ledger_accounts la
  WHERE la.lease_id = ANY(v_lease_ids);

  RAISE NOTICE 'Seeding completed successfully!';
END $$;

