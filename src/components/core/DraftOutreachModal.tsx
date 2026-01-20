import React, { useState, useEffect } from 'react';
import { generateMessageTemplate, generateSMSMessage } from '../../utils/messageTemplates';
import { Modal, Button, Card, CardBody } from '../ui';

interface DraftOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyMessage?: (message: string) => void;
  lease: any;
  ledgerAccount: any;
  insight: any;
  transactions: any[];
}

export function DraftOutreachModal({
  isOpen,
  onClose,
  onCopyMessage,
  lease,
  ledgerAccount,
  insight,
  transactions,
}: DraftOutreachModalProps) {
  const [draftText, setDraftText] = useState<string>('');
  const [draftChannel, setDraftChannel] = useState<'email' | 'sms'>('email');
  const [error, setError] = useState<string | null>(null);

  // Helper to derive category from ledger account if insight is missing
  const deriveCategory = (balance: number, daysPastDue: number): 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent' => {
    if (insight?.category) {
      return insight.category as 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent';
    }
    
    // Derive from balance and days past due
    if (balance <= 0) {
      return 'current';
    } else if (daysPastDue >= 30 || balance >= 2000) {
      return 'severe_delinquent';
    } else if (daysPastDue >= 6) {
      return 'delinquent';
    } else if (daysPastDue >= 1 || balance > 0) {
      return 'at_risk';
    }
    return 'current';
  };

  // Generate draft when modal opens or data changes
  useEffect(() => {
    if (!isOpen || !lease || !lease.primary_resident) {
      setDraftText('');
      setError(null);
      return;
    }

    try {
      // Compute balance (with fallback to transactions)
      let balance = 0;
      if (ledgerAccount?.current_balance !== undefined && ledgerAccount.current_balance !== null) {
        balance = Math.abs(Number(ledgerAccount.current_balance));
      } else if (transactions.length > 0) {
        const computedBalance = transactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
        balance = Math.abs(computedBalance);
      }

      const daysPastDue = ledgerAccount?.days_past_due || 0;
      const category = deriveCategory(balance, daysPastDue);

      const params = {
        residentName: lease.primary_resident.full_name || 'Unknown',
        category,
        balance,
        daysPastDue,
        unitCode: lease.unit?.unit_code,
      };

      const draft = draftChannel === 'email'
        ? generateMessageTemplate(params, 'friendly')
        : generateSMSMessage(params);

      setDraftText(draft);
      setError(null);
    } catch (err: any) {
      console.error('[DraftOutreachModal] Error generating draft:', err);
      setError(`Failed to generate draft: ${err?.message || 'Unknown error'}`);
      setDraftText('');
    }
  }, [isOpen, lease, ledgerAccount, insight, transactions, draftChannel]);

  // Auto-select channel based on available contact info
  useEffect(() => {
    if (isOpen && lease?.primary_resident) {
      const hasEmail = !!lease.primary_resident.email;
      const hasPhone = !!lease.primary_resident.phone;

      if (hasEmail && !hasPhone) {
        setDraftChannel('email');
      } else if (!hasEmail && hasPhone) {
        setDraftChannel('sms');
      } else if (hasEmail && hasPhone) {
        // Default to email if both available
        setDraftChannel('email');
      }
    }
  }, [isOpen, lease]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (draftText) {
      navigator.clipboard.writeText(draftText);
      if (onCopyMessage) {
        onCopyMessage(draftText);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Draft Outreach"
      size="lg"
      footer={
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleCopy}
            disabled={!draftText || !!error}
          >
            Copy Message
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <Card className="border-status-danger">
            <CardBody>
              <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm">{error}</p>
            </CardBody>
          </Card>
        )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Channel
            </label>
            <select
              value={draftChannel}
              onChange={(e) => setDraftChannel(e.target.value as 'email' | 'sms')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message
            </label>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder={error ? 'Error generating message' : 'Loading...'}
            />
          </div>
      </div>
    </Modal>
  );
}
