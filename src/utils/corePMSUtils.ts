// Utility functions for Core PMS

export function calculateDaysPastDue(lastPaymentAt: string | null, currentBalance: number): number {
  if (currentBalance <= 0) return 0;
  if (!lastPaymentAt) return 0;
  
  const lastPayment = new Date(lastPaymentAt);
  const now = new Date();
  const diffTime = now.getTime() - lastPayment.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

export function calculateTenantInsight(
  currentBalance: number,
  daysPastDue: number
): {
  category: 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent';
  reasons: string[];
  recommended_action: string;
} {
  let category: 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent' = 'current';
  const reasons: string[] = [];
  let recommended_action = 'No action needed';

  if (currentBalance <= 0) {
    category = 'current';
    reasons.push('Account is current with no outstanding balance');
    recommended_action = 'Continue regular communication';
  } else if (daysPastDue >= 30 || currentBalance >= 2000) {
    category = 'severe_delinquent';
    reasons.push(`Balance overdue for ${daysPastDue} days`);
    reasons.push(`Current balance: $${currentBalance.toLocaleString()}`);
    recommended_action = 'Send formal notice and consider legal action';
  } else if (daysPastDue >= 6) {
    category = 'delinquent';
    reasons.push(`Payment overdue for ${daysPastDue} days`);
    reasons.push(`Outstanding balance: $${currentBalance.toLocaleString()}`);
    recommended_action = 'Send payment reminder and follow up';
  } else if (daysPastDue >= 1 || currentBalance > 0) {
    category = 'at_risk';
    reasons.push(`Payment ${daysPastDue > 0 ? `${daysPastDue} days overdue` : 'pending'}`);
    if (currentBalance > 0) {
      reasons.push(`Balance: $${currentBalance.toLocaleString()}`);
    }
    recommended_action = 'Send friendly payment reminder';
  }

  return { category, reasons, recommended_action };
}







