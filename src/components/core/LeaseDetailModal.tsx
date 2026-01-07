import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Plus, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { updateTenantInsightsForLease } from '../../utils/tenantInsights';

interface LeaseDetailModalProps {
  leaseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeaseDetailModal({ leaseId, onClose, onUpdate }: LeaseDetailModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lease, setLease] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);

  useEffect(() => {
    fetchLeaseDetails();
  }, [leaseId]);

  const fetchLeaseDetails = async () => {
    setLoading(true);
    try {
      const { data: leaseData } = await supabase
        .from('core_leases')
        .select(`
          *,
          unit:core_units(unit_code),
          primary_resident:core_residents(*),
          ledger_account:core_ledger_accounts(*)
        `)
        .eq('id', leaseId)
        .single();

      if (leaseData) {
        setLease(leaseData);
        setLedgerAccount(leaseData.ledger_account);

        // Fetch transactions
        if (leaseData.ledger_account) {
          const { data: txns } = await supabase
            .from('core_ledger_txns')
            .select('*')
            .eq('ledger_account_id', leaseData.ledger_account.id)
            .order('txn_date', { ascending: false });

          setTransactions(txns || []);
        }
      }
    } catch (err) {
      console.error('Error fetching lease details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostMonthlyRent = async () => {
    if (!ledgerAccount || !user?.id) return;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const existingRent = transactions.find(
      t => t.txn_type === 'charge' && t.category === 'rent' && t.txn_date.startsWith(currentMonth)
    );

    if (existingRent) {
      alert('Monthly rent already posted for this month');
      return;
    }

    try {
      await supabase
        .from('core_ledger_txns')
        .insert({
          ledger_account_id: ledgerAccount.id,
          txn_type: 'charge',
          category: 'rent',
          amount: -lease.rent_amount, // Negative = charge
          txn_date: new Date().toISOString().split('T')[0],
          memo: 'Monthly rent charge',
          created_by: user.id
        });

      await updateTenantInsightsForLease(leaseId);
      fetchLeaseDetails();
      onUpdate();
    } catch (err) {
      console.error('Error posting rent:', err);
      alert('Failed to post monthly rent');
    }
  };

  const updateLedgerAndInsights = async (ledgerAccountId: string) => {
    // Recalculate balance from transactions
    const { data: allTxns } = await supabase
      .from('core_ledger_txns')
      .select('amount, txn_date')
      .eq('ledger_account_id', ledgerAccountId);

    const balance = allTxns?.reduce((sum, txn) => sum + Number(txn.amount), 0) || 0;

    // Get last payment date
    const payments = allTxns?.filter(t => t.amount > 0).sort((a, b) => 
      new Date(b.txn_date).getTime() - new Date(a.txn_date).getTime()
    );
    const lastPaymentAt = payments?.[0]?.txn_date || null;

    // Calculate days past due
    const daysPastDue = lastPaymentAt && balance > 0
      ? Math.floor((new Date().getTime() - new Date(lastPaymentAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Update ledger account
    await supabase
      .from('core_ledger_accounts')
      .update({
        current_balance: balance,
        days_past_due: Math.max(0, daysPastDue),
        last_payment_at: lastPaymentAt
      })
      .eq('id', ledgerAccountId);

    // Update tenant insight
    const { data: account } = await supabase
      .from('core_ledger_accounts')
      .select('lease_id')
      .eq('id', ledgerAccountId)
      .single();

    if (account) {
      const category = balance <= 0 ? 'current' :
                      daysPastDue >= 30 ? 'severe_delinquent' :
                      daysPastDue >= 6 ? 'delinquent' : 'at_risk';

      await supabase
        .from('core_tenant_insights')
        .upsert({
          lease_id: account.lease_id,
          category,
          reasons: [
            balance > 0 ? `Balance: $${balance.toLocaleString()}` : 'Account current',
            daysPastDue > 0 ? `Days past due: ${daysPastDue}` : 'No past due'
          ],
          recommended_action: category === 'severe_delinquent' ? 'Send formal notice' :
                            category === 'delinquent' ? 'Send payment reminder' :
                            category === 'at_risk' ? 'Monitor closely' : 'No action needed',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'lease_id'
        });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
        </div>
      </div>
    );
  }

  if (!lease) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Lease Details - {lease.unit?.unit_code}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Lease Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Resident</h3>
              <p className="text-gray-600 dark:text-gray-400">{lease.primary_resident?.full_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">{lease.primary_resident?.email}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Lease Dates</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {new Date(lease.lease_start).toLocaleDateString()} - {new Date(lease.lease_end).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Ledger Summary */}
          {ledgerAccount && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Account Balance</h3>
                <div className="text-2xl font-bold">
                  <span className={ledgerAccount.current_balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                    ${Math.abs(Number(ledgerAccount.current_balance) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              {ledgerAccount.days_past_due > 0 && (
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {ledgerAccount.days_past_due} days past due
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handlePostMonthlyRent}
              className="flex items-center gap-2 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark"
            >
              <Calendar className="w-4 h-4" />
              Post Monthly Rent
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              onClick={() => alert('Add Charge/Credit feature coming soon')}
            >
              <Plus className="w-4 h-4" />
              Add Charge/Credit
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              onClick={() => alert('Record Payment feature coming soon')}
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
          </div>

          {/* Transactions */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Memo</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => (
                      <tr key={txn.id}>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(txn.txn_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {txn.txn_type}
                        </td>
                        <td className={`px-4 py-2 text-sm font-medium ${
                          txn.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          ${Math.abs(txn.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {txn.memo || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

