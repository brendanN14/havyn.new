# Financial Ledger UI v1 - Implementation Summary

## Overview
Implemented Financial Ledger UI v1 for Core PMS, allowing property managers to record transactions, track balances, and manage delinquencies.

## Sign Convention
**Transaction Amounts:**
- **Charges/Fees (rent, late_fee, utilities, etc.)**: Stored as **NEGATIVE** values (e.g., -1200.00)
- **Payments/Credits**: Stored as **POSITIVE** values (e.g., +800.00)

**Balance:**
- **Balance** = Sum of all transaction amounts
- **Negative balance** (e.g., -400) = Money is **owed** by resident
- **Positive balance** (e.g., +200) = **Credit/prepayment** on account
- **Zero balance** = Account is **current**

**Display:**
- Always display absolute value of balance: `Math.abs(balance)`
- Color coding: Red for money owed (balance < 0), Green for credit (balance > 0)

## New/Updated Components

### 1. **TransactionModal** (`src/components/core/TransactionModal.tsx`)
**New component** - Modal for creating ledger transactions.

**Actions:**
- `rent`: Post Monthly Rent (pre-filled with lease rent amount)
- `payment`: Record Payment
- `charge`: Add Charge/Fee
- `credit`: Add Credit/Refund

**Features:**
- Form validation (amount > 0, category required, date required)
- Duplicate monthly rent prevention (idempotency check)
- Automatic balance and insights update after transaction
- Error handling with user-friendly messages

**Form Fields:**
- Date (default: today)
- Amount (positive number, required)
- Category (rent, late_fee, utilities, deposit, misc - varies by action)
- Memo (optional)

### 2. **LeaseDetailModal** (`src/components/core/LeaseDetailModal.tsx`)
**Updated component** - Enhanced with tabbed interface (Details & Ledger tabs).

**Ledger Tab Features:**
- Current balance display (with color coding)
- Days past due
- Last payment date
- Transaction history table (sortable by date, newest first)
- Action buttons:
  - Post Monthly Rent
  - Record Payment
  - Add Charge/Fee
  - Add Credit/Refund
- "Refresh Insight" button on Details tab

**Transaction Table Columns:**
- Date
- Type (charge, payment, credit)
- Category
- Amount (color coded: red for charges, green for payments)
- Memo
- Created By (user email)

### 3. **CoreFinancialPage** (`src/components/core/CoreFinancialPage.tsx`)
**New component** - Property-level financial management page.

**Features:**
- Delinquency table (all accounts with balance < 0)
- Summary cards:
  - Total Delinquent (sum of all balances)
  - Delinquent Accounts (count)
  - Avg Days Past Due
- Property selector (multi-property support)
- Quick actions: "View Lease" button opens LeaseDetailModal
- Empty state when no delinquencies
- Refresh button

**Delinquency Table Columns:**
- Resident
- Unit
- Balance
- Days Past Due
- Insight Category
- Last Payment
- Actions (View Lease)

**Route:** `/core/financial`

### 4. **tenantInsights Utility** (`src/utils/tenantInsights.ts`)
**Updated utility** - Fixed balance calculation and days_past_due logic.

**Changes:**
- Corrected sign convention handling (balance < 0 = money owed)
- Improved days_past_due calculation (based on earliest unpaid rent charge)
- Enhanced insight category determination
- Better narrative summaries

**Insight Categories:**
- `current`: Balance >= 0
- `at_risk`: Balance < 0, days_past_due < 6
- `delinquent`: Balance < 0, days_past_due >= 6 and < 30
- `severe_delinquent`: Balance < 0, days_past_due >= 30 OR balance >= 2000

## Updated Routes

### App.tsx
Added route for Financial page:
```tsx
<Route path="financial" element={<CoreFinancialPage />} />
```

## Balance & Insight Updates

### Immediate Updates
After posting a transaction:
1. **Transaction is inserted** into `core_ledger_txns`
2. **Balance is recalculated** from all transactions (sum of amounts)
3. **Days past due is recalculated** based on earliest unpaid rent charge
4. **Ledger account is updated** in `core_ledger_accounts`:
   - `current_balance`
   - `days_past_due`
   - `last_payment_at`
5. **Tenant insight is updated** in `core_tenant_insights`:
   - `category`
   - `score_band`
   - `reasons[]`
   - `recommended_action`
   - `narrative_summary`
   - `updated_at`

### Days Past Due Calculation (v1)
**Algorithm:**
1. If balance < 0 (money owed):
   - Find all rent charges (txn_type='charge', category='rent', amount < 0)
   - Sort by date (ascending)
   - Calculate days from earliest charge date to today
2. If balance >= 0:
   - Days past due = 0

**Note:** This is a simplified v1 implementation. Future versions may track payment allocation to specific charges.

## User Experience

### Loading States
- Spinner while fetching data
- Disabled buttons during transaction processing
- Loading indicators in tables

### Error Handling
- Error banners with clear messages
- Form validation errors
- Supabase error details logged to console
- User-friendly error messages displayed

### Success Feedback
- Success message banner (auto-dismisses after 3 seconds)
- Automatic refresh of data after transaction
- Modal closes after successful transaction

### Empty States
- "No transactions yet" message in transaction table
- "No delinquencies" message on Financial page
- Helpful guidance text

## Database Requirements

### Existing Tables (No Changes Required)
- `core_ledger_accounts` (already has RLS policies)
- `core_ledger_txns` (already has RLS policies)
- `core_tenant_insights` (already has RLS policies)

### RLS Policies
All tables have appropriate RLS policies that ensure users can only access data for their own properties.

## Testing Recommendations

### Test Cases
1. **Post Monthly Rent:**
   - Verify amount matches lease rent amount
   - Verify duplicate prevention works (try posting twice in same month)
   - Verify balance updates correctly

2. **Record Payment:**
   - Verify positive amount is stored
   - Verify balance decreases (becomes less negative or becomes positive)
   - Verify last_payment_at updates

3. **Add Charge/Fee:**
   - Verify negative amount is stored
   - Verify balance increases (becomes more negative)
   - Verify category options work

4. **Add Credit/Refund:**
   - Verify positive amount is stored
   - Verify balance decreases
   - Verify credit balance displays correctly

5. **Days Past Due:**
   - Create rent charge dated 45 days ago
   - Verify days_past_due = 45
   - Record payment
   - Verify days_past_due updates or resets appropriately

6. **Insight Updates:**
   - Post transaction
   - Verify insight category updates immediately
   - Click "Refresh Insight" button
   - Verify insight updates

7. **Delinquency Table:**
   - Create multiple leases with different balances
   - Verify only negative balances appear
   - Verify sorting (by days_past_due, highest first)
   - Verify summary cards calculate correctly

## Limitations (v1)

1. **No Payment Allocation:** Payments are not allocated to specific charges
2. **No Bank Reconciliation:** No bank account integration
3. **No Payment Methods:** No tracking of payment method (check, ACH, etc.)
4. **No Recurring Charges:** Manual rent posting required each month
5. **No Receipts/Invoices:** No document generation
6. **Simple Days Past Due:** Based on earliest charge, not payment allocation

## Future Enhancements (Not in v1)

- Payment allocation to specific charges
- Recurring charge automation
- Payment method tracking
- Receipt/invoice generation
- Bank reconciliation
- Payment reminders/notifications
- Financial reports (rent roll, aging reports, P&L)
- Multi-currency support
- Split payments across multiple leases
- Payment plans/installments

