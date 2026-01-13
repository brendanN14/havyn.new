// Tenant summary utility for Core PMS
// Generates short summaries from ledger + promise/notice fields + last contact

export interface TenantSummaryParams {
  residentName: string;
  unitCode: string;
  balance: number;
  daysPastDue: number;
  category: string;
  lastPaymentAt: string | null;
  lastContactAt: string | null;
  promiseToPayDate: string | null;
  promiseAmount: number | null;
  promiseStatus: string | null;
  noticeType: string | null;
  noticeSentDate: string | null;
  noticeMethod: string | null;
}

/**
 * Generate a short tenant summary from ledger + promise/notice fields + last contact
 */
export function generateTenantSummary(params: TenantSummaryParams): string {
  const {
    residentName,
    unitCode,
    balance,
    daysPastDue,
    category,
    lastPaymentAt,
    lastContactAt,
    promiseToPayDate,
    promiseAmount,
    promiseStatus,
    noticeType,
    noticeSentDate,
    noticeMethod
  } = params;

  const balanceFormatted = `$${balance.toLocaleString()}`;
  const parts: string[] = [];

  // Basic info
  parts.push(`${residentName} (${unitCode}) has a balance of ${balanceFormatted}`);
  
  if (daysPastDue > 0) {
    parts.push(`${daysPastDue} days past due`);
  }

  // Category
  if (category && category !== 'current') {
    parts.push(`Status: ${category.replace('_', ' ')}`);
  }

  // Last payment
  if (lastPaymentAt) {
    const paymentDate = new Date(lastPaymentAt);
    const daysSincePayment = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`Last payment: ${daysSincePayment} days ago`);
  } else {
    parts.push('No payment history');
  }

  // Last contact
  if (lastContactAt) {
    const contactDate = new Date(lastContactAt);
    const daysSinceContact = Math.floor((Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`Last contacted: ${daysSinceContact} days ago`);
  } else {
    parts.push('Never contacted');
  }

  // Promise to pay
  if (promiseToPayDate) {
    const promiseDate = new Date(promiseToPayDate);
    const today = new Date();
    const isPastDue = promiseDate < today;
    const statusText = promiseStatus ? ` (${promiseStatus})` : '';
    const amountText = promiseAmount ? ` for $${promiseAmount.toLocaleString()}` : '';
    parts.push(`Promise to pay${amountText}: ${promiseDate.toLocaleDateString()}${statusText}${isPastDue ? ' (overdue)' : ''}`);
  }

  // Notice
  if (noticeType && noticeSentDate) {
    const noticeDate = new Date(noticeSentDate);
    const methodText = noticeMethod ? ` via ${noticeMethod}` : '';
    parts.push(`${noticeType.replace('_', ' ')} notice sent${methodText}: ${noticeDate.toLocaleDateString()}`);
  }

  return parts.join('. ') + '.';
}

