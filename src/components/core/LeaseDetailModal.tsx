import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Plus, Calendar, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TransactionModal } from './TransactionModal';
import { updateTenantInsightsForLease } from '../../utils/tenantInsights';

interface LeaseDetailModalProps {
  leaseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

type Tab = 'details' | 'ledger';

export function LeaseDetailModal({ leaseId, onClose, onUpdate }: LeaseDetailModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('ledger');
  const [loading, setLoading] = useState(true);
  const [refreshingInsight, setRefreshingInsight] = useState(false);
  const [lease, setLease] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionAction, setTransactionAction] = useState<'rent' | 'payment' | 'charge' | 'credit'>('payment');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaseDetails();
  }, [leaseId]);

  // Auto-dismiss messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const fetchLeaseDetails = async () => {
    setLoading(true);
    try {
      const { data: leaseData, error: leaseError } = await supabase
        .from('core_leases')
        .select(`
          *,
          unit:core_units(unit_code),
          primary_resident:core_residents(*),
          ledger_account:core_ledger_accounts(*)
        `)
        .eq('id', leaseId)
        .single();

      if (leaseError) {
        console.error('[LeaseDetailModal] Error fetching lease:', leaseError);
        setErrorMessage('Failed to load lease details');
        return;
      }

      if (leaseData) {
        setLease(leaseData);
        setLedgerAccount(leaseData.ledger_account);

        // Fetch transactions if ledger account exists
        if (leaseData.ledger_account) {
          const { data: txns, error: txnError } = await supabase
            .from('core_ledger_txns')
            .select('*')
            .eq('ledger_account_id', leaseData.ledger_account.id)
            .order('txn_date', { ascending: false })
            .order('created_at', { ascending: false });

          if (txnError) {
            console.error('[LeaseDetailModal] Error fetching transactions:', txnError);
            setErrorMessage(`Failed to load transactions: ${txnError.message}`);
          } else {
            console.log('[LeaseDetailModal] Fetched transactions:', txns?.length || 0);
          setTransactions(txns || []);
          }
        } else {
          console.warn('[LeaseDetailModal] No ledger account found for lease:', leaseId);
          // Create ledger account if it doesn't exist
          const { data: newAccount, error: createError } = await supabase
            .from('core_ledger_accounts')
            .insert({
              lease_id: leaseId,
              current_balance: 0,
              days_past_due: 0
            })
            .select()
            .single();

          if (!createError && newAccount) {
            setLedgerAccount(newAccount);
            console.log('[LeaseDetailModal] Created ledger account:', newAccount.id);
          }
        }

        // Fetch tenant insight
        const { data: insightData } = await supabase
          .from('core_tenant_insights')
          .select('*')
          .eq('lease_id', leaseId)
          .maybeSingle();

        setInsight(insightData);
      }
    } catch (err) {
      console.error('[LeaseDetailModal] Unexpected error:', err);
      setErrorMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionSuccess = () => {
    setSuccessMessage('Transaction recorded successfully');
    fetchLeaseDetails();
    onUpdate();
  };

  const handleRefreshInsight = async () => {
    if (!leaseId) return;
    
    setRefreshingInsight(true);
    try {
      await updateTenantInsightsForLease(leaseId);
      setSuccessMessage('Insight refreshed successfully');
      
      // Refetch insight
      const { data: insightData } = await supabase
        .from('core_tenant_insights')
        .select('*')
        .eq('lease_id', leaseId)
        .maybeSingle();

      setInsight(insightData);
      
      // Also refresh lease details to get updated ledger account
      fetchLeaseDetails();
    } catch (err) {
      console.error('[LeaseDetailModal] Error refreshing insight:', err);
      setErrorMessage('Failed to refresh insight');
    } finally {
      setRefreshingInsight(false);
    }
  };

  const openTransactionModal = (action: 'rent' | 'payment' | 'charge' | 'credit') => {
    setTransactionAction(action);
    setTransactionModalOpen(true);
  };

  const getBalanceDisplay = () => {
    if (!ledgerAccount) return { amount: 0, isOwed: false };
    const balance = Number(ledgerAccount.current_balance || 0);
    // Balance is stored as: negative = money owed, positive = credit
    return { amount: Math.abs(balance), isOwed: balance < 0 };
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

  const balanceDisplay = getBalanceDisplay();

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Lease Details - {lease.unit?.unit_code}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'details'
                    ? 'border-havyn-primary text-havyn-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'ledger'
                    ? 'border-havyn-primary text-havyn-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Ledger
              </button>
            </nav>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mx-6 mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-green-800 dark:text-green-200 text-sm">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-800 dark:text-red-200 text-sm">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Lease Summary */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Resident</h3>
                    <p className="text-gray-600 dark:text-gray-400">{lease.primary_resident?.full_name || 'N/A'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{lease.primary_resident?.email || ''}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">{lease.primary_resident?.phone || ''}</p>
            </div>
            <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Lease Information</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Start:</span> {new Date(lease.lease_start).toLocaleDateString()}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">End:</span> {new Date(lease.lease_end).toLocaleDateString()}
                    </p>
              <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Rent:</span> ${Number(lease.rent_amount || 0).toLocaleString()}/month
              </p>
            </div>
          </div>

                {/* Tenant Insight */}
                {insight && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Tenant Insight</h3>
                      <button
                        onClick={handleRefreshInsight}
                        disabled={refreshingInsight}
                        className="text-sm text-havyn-primary dark:text-emerald-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${refreshingInsight ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span className="font-medium">Category:</span> {insight.category?.replace('_', ' ') || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span className="font-medium">Recommended Action:</span> {insight.recommended_action || 'N/A'}
                    </p>
                    {insight.narrative_summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{insight.narrative_summary}</p>
                    )}
                </div>
                )}
              </div>
            )}

            {activeTab === 'ledger' && (
              <div className="space-y-6">
                {/* Ledger Summary */}
                {ledgerAccount ? (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Current Balance</p>
                        <p className={`text-2xl font-bold ${
                          balanceDisplay.isOwed 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {balanceDisplay.isOwed ? '-' : ''}${balanceDisplay.amount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Days Past Due</p>
                        <p className={`text-2xl font-bold ${
                          (ledgerAccount.days_past_due || 0) > 0
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {ledgerAccount.days_past_due || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Last Payment</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {ledgerAccount.last_payment_at
                            ? new Date(ledgerAccount.last_payment_at).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                      No ledger account found. Creating one automatically...
                    </p>
            </div>
          )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
            <button
                    onClick={() => openTransactionModal('rent')}
                    className="flex items-center gap-2 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Post Monthly Rent
            </button>
            <button
                    onClick={() => openTransactionModal('payment')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
                  <button
                    onClick={() => openTransactionModal('charge')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Charge/Fee
                  </button>
                  <button
                    onClick={() => openTransactionModal('credit')}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Add Credit/Refund
                  </button>
          </div>

                {/* Transactions Table */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Memo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Created By
                          </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.length === 0 ? (
                    <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                              No transactions yet. Record a payment or post rent to get started.
                      </td>
                    </tr>
                  ) : (
                          transactions.map((txn) => {
                            const amount = Number(txn.amount || 0);
                            const isCharge = amount < 0;
                            
                            return (
                              <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(txn.txn_date).toLocaleDateString()}
                        </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="px-2 py-1 text-xs font-medium rounded-full capitalize bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                          {txn.txn_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                  {txn.category?.replace('_', ' ') || '-'}
                        </td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                                  isCharge 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-green-600 dark:text-green-400'
                                }`}>
                                  {isCharge ? '-' : '+'}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {txn.memo || '-'}
                        </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                  {user?.email || '-'}
                                </td>
                      </tr>
                            );
                          })
                  )}
                </tbody>
              </table>
            </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      {transactionModalOpen && ledgerAccount && (
        <TransactionModal
          isOpen={transactionModalOpen}
          onClose={() => setTransactionModalOpen(false)}
          onSuccess={handleTransactionSuccess}
          ledgerAccountId={ledgerAccount.id}
          leaseId={leaseId}
          actionType={transactionAction}
          leaseRentAmount={Number(lease.rent_amount || 0)}
        />
      )}
    </>
  );
}
