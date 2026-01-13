// Message templates for Core PMS communication
// Uses insight category, balance, and days_past_due to generate contextual messages

export interface MessageTemplateParams {
  residentName: string;
  category: 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent';
  balance: number;
  daysPastDue: number;
  unitCode?: string;
}

/**
 * Generate a message template based on insight category and balance
 */
export function generateMessageTemplate(
  params: MessageTemplateParams,
  tone: 'friendly' | 'formal' | 'urgent' = 'friendly'
): string {
  const { residentName, category, balance, daysPastDue, unitCode } = params;
  const balanceFormatted = `$${balance.toLocaleString()}`;
  const unitText = unitCode ? ` (Unit ${unitCode})` : '';

  switch (category) {
    case 'severe_delinquent':
      if (tone === 'urgent') {
        return `Dear ${residentName}${unitText},

Our records show that your account has an outstanding balance of ${balanceFormatted} that is ${daysPastDue} days past due.

This matter requires immediate attention. Please contact our office today to discuss payment arrangements.

Failure to resolve this balance may result in further action.

Best regards,
Property Management`;
      } else if (tone === 'formal') {
        return `Dear ${residentName}${unitText},

This notice is regarding your outstanding account balance of ${balanceFormatted}, which is currently ${daysPastDue} days past due.

We strongly urge you to contact our office immediately to arrange payment or discuss payment options.

Best regards,
Property Management`;
      } else {
        return `Dear ${residentName}${unitText},

We wanted to reach out regarding your account balance of ${balanceFormatted}, which is ${daysPastDue} days past due.

We'd like to work with you to resolve this. Please contact our office to discuss payment arrangements.

Best regards,
Property Management`;
      }

    case 'delinquent':
      if (tone === 'formal') {
        return `Dear ${residentName}${unitText},

Your account shows an outstanding balance of ${balanceFormatted} that is ${daysPastDue} days past due.

Please contact our office to arrange payment or discuss payment options.

Best regards,
Property Management`;
      } else {
        return `Dear ${residentName}${unitText},

We wanted to follow up on your account balance of ${balanceFormatted}, which is ${daysPastDue} days past due.

Please contact our office to arrange payment.

Best regards,
Property Management`;
      }

    case 'at_risk':
      return `Dear ${residentName}${unitText},

We noticed your account has an outstanding balance of ${balanceFormatted}.

Please contact our office to arrange payment or discuss any concerns.

Best regards,
Property Management`;

    case 'current':
    default:
      return `Dear ${residentName}${unitText},

Thank you for your prompt payments. We appreciate your business.

Best regards,
Property Management`;
  }
}

/**
 * Generate SMS message (shorter, more direct)
 */
export function generateSMSMessage(params: MessageTemplateParams): string {
  const { residentName, category, balance, daysPastDue, unitCode } = params;
  const balanceFormatted = `$${balance.toLocaleString()}`;
  const unitText = unitCode ? ` (${unitCode})` : '';

  switch (category) {
    case 'severe_delinquent':
      return `Hi ${residentName}${unitText}, your account balance of ${balanceFormatted} is ${daysPastDue} days past due. Please contact us immediately to resolve.`;

    case 'delinquent':
      return `Hi ${residentName}${unitText}, your account balance of ${balanceFormatted} is ${daysPastDue} days past due. Please contact us to arrange payment.`;

    case 'at_risk':
      return `Hi ${residentName}${unitText}, your account shows a balance of ${balanceFormatted}. Please contact us to arrange payment.`;

    default:
      return `Hi ${residentName}${unitText}, please contact us regarding your account.`;
  }
}

