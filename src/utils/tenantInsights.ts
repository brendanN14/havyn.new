// Client-side tenant insights calculation utility
// This can be called after ledger transactions are created/updated

import { supabase } from '../lib/supabase';

/**
 * Sign Convention:
 * - Transactions: charges/fees are NEGATIVE (e.g., -1200 for rent), payments/credits are POSITIVE (e.g., +800 for payment)
 * - Balance: stored as the SUM of all transaction amounts
 *   - Negative balance (e.g., -400) = money is OWED
 *   - Positive balance (e.g., +200) = credit/prepayment
 *   - Zero balance = account is current
 * - Display: we use Math.abs() to display amount, and check sign to determine if owed or credit
 */
export async function updateTenantInsightsForLease(leaseId: string) {
  try {
    // Get ledger account for lease
    const { data: ledgerAccount, error: accountError } = await supabase
      .from('core_ledger_accounts')
      .select('*')
      .eq('lease_id', leaseId)
      .single();

    if (accountError || !ledgerAccount) {
      console.error('Error fetching ledger account:', accountError);
      return;
    }

    // Recalculate balance from all transactions
    const { data: transactions } = await supabase
      .from('core_ledger_txns')
      .select('amount, txn_date, txn_type, category')
      .eq('ledger_account_id', ledgerAccount.id)
      .order('txn_date', { ascending: false });

    // Balance = sum of all amounts (negative = money owed, positive = credit)
    const balance = transactions?.reduce((sum, txn) => sum + Number(txn.amount || 0), 0) || 0;

    // Find last payment (positive amount or payment/credit type)
    const payments = transactions?.filter(t => 
      Number(t.amount) > 0 || t.txn_type === 'payment' || t.txn_type === 'credit'
    ).sort((a, b) => 
      new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime()
    ) || [];
    const lastPaymentAt = payments[0]?.txn_date || null;

    // Calculate days_past_due
    // For v1: If balance < 0 (money is owed), find earliest unpaid rent charge and calculate days from that date
    let daysPastDue = 0;
    if (balance < 0) { // Negative balance means money is owed
      // Find all rent charges (negative amounts with category='rent')
      const rentCharges = transactions?.filter(t => 
        t.txn_type === 'charge' && 
        t.category === 'rent' && 
        Number(t.amount) < 0
      ) || [];

      if (rentCharges.length > 0) {
        // Sort by date ascending to get earliest charge
        const sortedCharges = rentCharges.sort((a, b) => 
          new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime()
        );
        const earliestCharge = sortedCharges[0];

        if (earliestCharge) {
          const chargeDate = new Date(earliestCharge.txn_date);
          const today = new Date();
          const diffTime = today.getTime() - chargeDate.getTime();
          daysPastDue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        }
      }
    }

    // Determine category based on balance and days_past_due
    // Note: balance < 0 means money is owed, balance >= 0 means current or credit
    let category: 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent' = 'current';
    const reasons: string[] = [];

    const balanceOwed = Math.abs(balance);

    if (balance >= 0) {
      category = 'current';
      if (balance > 0) {
        reasons.push(`Account has credit of $${balance.toLocaleString()}`);
      } else {
        reasons.push('Account is current with no outstanding balance');
      }
    } else if (daysPastDue >= 30 || balanceOwed >= 2000) {
      category = 'severe_delinquent';
      reasons.push(`Balance overdue: $${balanceOwed.toLocaleString()}`);
      reasons.push(`Days past due: ${daysPastDue}`);
    } else if (daysPastDue >= 6) {
      category = 'delinquent';
      reasons.push(`Payment overdue for ${daysPastDue} days`);
      reasons.push(`Outstanding balance: $${balanceOwed.toLocaleString()}`);
    } else if (daysPastDue >= 1 || balance < 0) {
      category = 'at_risk';
      reasons.push(`Payment ${daysPastDue > 0 ? `${daysPastDue} days overdue` : 'pending'}`);
      reasons.push(`Balance: $${balanceOwed.toLocaleString()}`);
    }

    const recommendedAction = 
      category === 'severe_delinquent' ? 'Send formal notice and consider legal action' :
      category === 'delinquent' ? 'Send payment reminder and follow up' :
      category === 'at_risk' ? 'Send friendly payment reminder' :
      'Continue regular communication';

    const narrativeSummary = 
      category === 'severe_delinquent' 
        ? `Resident is severely delinquent with $${balanceOwed.toLocaleString()} outstanding for ${daysPastDue} days. Immediate action required.`
        : category === 'delinquent'
        ? `Resident has been overdue for ${daysPastDue} days with a balance of $${balanceOwed.toLocaleString()}. Follow-up needed.`
        : category === 'at_risk'
        ? `Resident has an outstanding balance of $${balanceOwed.toLocaleString()}. Monitor closely.`
        : balance > 0
        ? `Resident account has a credit balance of $${balance.toLocaleString()}.`
        : 'Resident account is current with no outstanding balance.';

    // Update ledger account (store balance as-is: negative = owed, positive = credit)
    await supabase
      .from('core_ledger_accounts')
      .update({
        current_balance: balance,
        days_past_due: daysPastDue,
        last_payment_at: lastPaymentAt ? new Date(lastPaymentAt).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', ledgerAccount.id);

    // Upsert tenant insight
    await supabase
      .from('core_tenant_insights')
      .upsert({
        lease_id: leaseId,
        category,
        score_band: category === 'severe_delinquent' ? 'high' :
                    category === 'delinquent' ? 'medium' :
                    'low',
        reasons,
        recommended_action: recommendedAction,
        narrative_summary: narrativeSummary,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'lease_id'
      });

  } catch (error) {
    console.error('Error updating tenant insights:', error);
  }
}
