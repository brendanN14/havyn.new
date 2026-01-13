/**
 * Shared financial calculation utilities for Core PMS
 * 
 * Sign Convention:
 * - Transactions: charges/fees are NEGATIVE, payments/credits are POSITIVE
 * - Balance: stored as the SUM of all transaction amounts
 *   - Negative balance (e.g., -400) = money is OWED by tenant
 *   - Positive balance (e.g., +200) = credit/prepayment
 *   - Zero balance = account is current
 */

export interface FinancialData {
  ledgerAccount?: {
    current_balance: number | null;
    days_past_due: number | null;
    last_payment_at: string | null;
  } | null;
  transactions?: Array<{
    amount: number;
    txn_date: string;
    txn_type: string;
    category: string;
  }> | null;
}

/**
 * Get the signed balance from ledger account or compute from transactions
 */
export function getSignedBalance(data: FinancialData): number {
  if (data.ledgerAccount?.current_balance !== undefined && data.ledgerAccount.current_balance !== null) {
    return Number(data.ledgerAccount.current_balance);
  }
  
  // Compute from transactions if available
  if (data.transactions && data.transactions.length > 0) {
    return data.transactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  }
  
  return 0;
}

/**
 * Get amount owed (always positive or zero)
 * Negative balance = money owed, so we convert to positive
 */
export function getAmountOwed(balanceSigned: number): number {
  return Math.max(0, -balanceSigned);
}

/**
 * Calculate days past due from transactions if not available in ledger account
 */
export function calculateDaysPastDueFromTransactions(
  transactions: Array<{ amount: number; txn_date: string; txn_type: string; category: string }>,
  balanceSigned: number
): number {
  if (balanceSigned >= 0) return 0; // No money owed
  
  // Find all unpaid rent charges (negative amounts with category='rent')
  const rentCharges = transactions
    .filter(t => 
      t.txn_type === 'charge' && 
      t.category === 'rent' && 
      Number(t.amount) < 0
    );
  
  if (rentCharges.length === 0) return 0;
  
  // Sort by date ascending to get earliest charge
  const sortedCharges = rentCharges.sort((a, b) => 
    new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime()
  );
  
  const earliestCharge = sortedCharges[0];
  if (!earliestCharge) return 0;
  
  const chargeDate = new Date(earliestCharge.txn_date);
  const today = new Date();
  const diffTime = today.getTime() - chargeDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Get delinquency status from financial data
 */
export function getDelinquencyStatus(data: FinancialData): {
  amountOwed: number;
  isDelinquent: boolean;
  daysPastDue: number;
  lastPaymentDate: string | null;
  balanceSigned: number;
} {
  const balanceSigned = getSignedBalance(data);
  const amountOwed = getAmountOwed(balanceSigned);
  
  // Get days_past_due from ledger account or calculate from transactions
  let daysPastDue = data.ledgerAccount?.days_past_due ?? null;
  
  if (daysPastDue === null && data.transactions) {
    daysPastDue = calculateDaysPastDueFromTransactions(data.transactions, balanceSigned);
  }
  
  const daysPastDueFinal = daysPastDue ?? 0;
  
  // Is delinquent if amount owed > 0 AND days past due > 0
  const isDelinquent = amountOwed > 0 && daysPastDueFinal > 0;
  
  return {
    amountOwed,
    isDelinquent,
    daysPastDue: daysPastDueFinal,
    lastPaymentDate: data.ledgerAccount?.last_payment_at || null,
    balanceSigned
  };
}

/**
 * Check if a lease is delinquent based on ledger account balance
 * This is a simple check for filtering queries
 */
export function isLeaseDelinquent(balance: number | null | undefined): boolean {
  if (balance === null || balance === undefined) return false;
  return Number(balance) < 0; // Negative balance = money owed
}

