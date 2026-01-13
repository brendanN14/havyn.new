/*
  # Add Promise-to-Pay and Notice Logging Fields
  
  Adds promise-to-pay tracking and notice logging to leases/ledger accounts.
*/

-- Add promise-to-pay fields to ledger accounts (enhance existing promise_to_pay_date)
ALTER TABLE core_ledger_accounts 
  ADD COLUMN IF NOT EXISTS promise_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS promise_status text CHECK (promise_status IN ('pending', 'fulfilled', 'broken', 'cancelled'));

-- Add notice logging fields to ledger accounts
ALTER TABLE core_ledger_accounts 
  ADD COLUMN IF NOT EXISTS notice_type text CHECK (notice_type IN ('late_notice', 'pay_or_quit', 'eviction_notice', 'cure_or_quit', 'other')),
  ADD COLUMN IF NOT EXISTS notice_sent_date date,
  ADD COLUMN IF NOT EXISTS notice_method text CHECK (notice_method IN ('email', 'sms', 'mail', 'in_person', 'posted', 'other'));

-- Create index for promise status queries
CREATE INDEX IF NOT EXISTS idx_core_ledger_accounts_promise_status ON core_ledger_accounts(promise_status) WHERE promise_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_core_ledger_accounts_notice_sent_date ON core_ledger_accounts(notice_sent_date) WHERE notice_sent_date IS NOT NULL;

