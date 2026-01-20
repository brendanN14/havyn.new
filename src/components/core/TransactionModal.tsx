import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Spinner } from '../ui';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ledgerAccountId: string;
  leaseId: string;
  actionType: 'rent' | 'payment' | 'charge' | 'credit';
  leaseRentAmount?: number;
}

const CATEGORIES = {
  rent: ['rent'],
  payment: ['rent', 'deposit', 'misc'],
  charge: ['rent', 'late_fee', 'utilities', 'misc'],
  credit: ['deposit', 'refund', 'misc']
};

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  ledgerAccountId,
  leaseId,
  actionType,
  leaseRentAmount = 0
}: TransactionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    txn_date: new Date().toISOString().split('T')[0],
    amount: actionType === 'rent' ? leaseRentAmount : '',
    category: actionType === 'rent' ? 'rent' : '',
    memo: actionType === 'rent' ? 'Monthly rent charge' : ''
  });

  // Get txn_type based on action
  const getTxnType = () => {
    switch (actionType) {
      case 'rent':
      case 'charge':
        return 'charge';
      case 'payment':
        return 'payment';
      case 'credit':
        return 'credit';
      default:
        return 'charge';
    }
  };

  // Get title based on action
  const getTitle = () => {
    switch (actionType) {
      case 'rent':
        return 'Post Monthly Rent';
      case 'payment':
        return 'Record Payment';
      case 'charge':
        return 'Add Charge/Fee';
      case 'credit':
        return 'Add Credit/Refund';
      default:
        return 'Add Transaction';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    // Validation
    const amount = parseFloat(formData.amount.toString());
    if (isNaN(amount) || amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (!formData.category) {
      setError('Please select a category');
      return;
    }

    // Check for duplicate monthly rent (idempotency)
    if (actionType === 'rent') {
      const monthYear = formData.txn_date.slice(0, 7); // YYYY-MM
      const { data: existingRent } = await supabase
        .from('core_ledger_txns')
        .select('id')
        .eq('ledger_account_id', ledgerAccountId)
        .eq('txn_type', 'charge')
        .eq('category', 'rent')
        .gte('txn_date', `${monthYear}-01`)
        .lt('txn_date', `${monthYear}-32`)
        .maybeSingle();

      if (existingRent) {
        setError(`Monthly rent already posted for ${new Date(formData.txn_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Sign convention: charges/fees are NEGATIVE, payments/credits are POSITIVE
      // This matches the existing code in LeaseDetailModal (line 80: amount: -lease.rent_amount)
      const signedAmount = (actionType === 'rent' || actionType === 'charge') 
        ? -Math.abs(amount)  // Negative for charges
        : Math.abs(amount);   // Positive for payments/credits

      // Insert transaction
      const { error: insertError } = await supabase
        .from('core_ledger_txns')
        .insert({
          ledger_account_id: ledgerAccountId,
          txn_type: getTxnType(),
          category: formData.category,
          amount: signedAmount,
          txn_date: formData.txn_date,
          memo: formData.memo || null,
          created_by: user.id
        });

      if (insertError) {
        console.error('[TransactionModal] Error inserting transaction:', insertError);
        setError(insertError.message || 'Failed to create transaction');
        setLoading(false);
        return;
      }

      // Update ledger account balance and insights
      await updateLedgerAccountAndInsights(ledgerAccountId, leaseId);

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'other',
        title: `${getTxnType() === 'charge' ? 'Charge' : getTxnType() === 'payment' ? 'Payment' : 'Credit'} recorded`,
        description: `${formData.category || 'Transaction'} - $${Math.abs(amount).toLocaleString()}`,
        leaseId,
        metadata: { txn_type: getTxnType(), category: formData.category, amount: signedAmount }
      }, user.id);

      // Reset form and close
      setFormData({
        txn_date: new Date().toISOString().split('T')[0],
        amount: actionType === 'rent' ? leaseRentAmount : '',
        category: actionType === 'rent' ? 'rent' : '',
        memo: actionType === 'rent' ? 'Monthly rent charge' : ''
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[TransactionModal] Unexpected error:', err);
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateLedgerAccountAndInsights = async (ledgerAccountId: string, leaseId: string) => {
    // Use the existing tenant insights utility which handles balance calculation correctly
    const { updateTenantInsightsForLease } = await import('../../utils/tenantInsights');
    await updateTenantInsightsForLease(leaseId);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      size="md"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                Processing...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 bg-status-danger-bg dark:bg-status-danger-bg-dark/30 border border-status-danger dark:border-status-danger-bg-dark rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-status-danger dark:text-status-danger-text-dark flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-status-danger-text dark:text-status-danger-text-dark font-medium">Error</p>
            <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date <span className="text-status-danger">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.txn_date}
              onChange={(e) => setFormData({ ...formData, txn_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                disabled={actionType === 'rent'}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category <span className="text-status-danger">*</span>
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={actionType === 'rent'}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent disabled:opacity-50"
            >
              <option value="">Select category</option>
              {CATEGORIES[actionType].map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Memo
            </label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent"
              placeholder="Optional note about this transaction"
            />
          </div>

      </form>
    </Modal>
  );
}


