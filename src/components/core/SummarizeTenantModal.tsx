import React from 'react';
import { generateTenantSummary } from '../../utils/tenantSummary';
import { Modal, Button, Card, CardBody } from '../ui';

interface SummarizeTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: any;
  ledgerAccount: any;
  insight: any;
}

export function SummarizeTenantModal({
  isOpen,
  onClose,
  lease,
  ledgerAccount,
  insight,
}: SummarizeTenantModalProps) {
  if (!isOpen) return null;

  try {
    const balance = Math.abs(Number(ledgerAccount?.current_balance || 0));
    const summary = generateTenantSummary({
      residentName: lease?.primary_resident?.full_name || 'Unknown',
      unitCode: lease?.unit?.unit_code || 'Unknown',
      balance,
      daysPastDue: ledgerAccount?.days_past_due || 0,
      category: insight?.category || 'current',
      lastPaymentAt: ledgerAccount?.last_payment_at || null,
      lastContactAt: ledgerAccount?.last_contact_at || null,
      promiseToPayDate: ledgerAccount?.promise_to_pay_date || null,
      promiseAmount: ledgerAccount?.promise_amount ? Number(ledgerAccount.promise_amount) : null,
      promiseStatus: ledgerAccount?.promise_status || null,
      noticeType: ledgerAccount?.notice_type || null,
      noticeSentDate: ledgerAccount?.notice_sent_date || null,
      noticeMethod: ledgerAccount?.notice_method || null,
    });

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Tenant Summary"
        size="lg"
        footer={
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{summary}</p>
      </Modal>
    );
  } catch (error) {
    console.error('[SummarizeTenantModal] Error generating summary:', error);
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Tenant Summary"
        size="lg"
        footer={
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <Card className="border-status-danger">
          <CardBody>
            <p className="text-status-danger-text dark:text-status-danger-text-dark">
              Error generating summary. Please try again or contact support.
            </p>
          </CardBody>
        </Card>
      </Modal>
    );
  }
}
