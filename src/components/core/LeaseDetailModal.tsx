import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Plus, Calendar, RefreshCw, AlertCircle, FileText, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TransactionModal } from './TransactionModal';
import { updateTenantInsightsForLease } from '../../utils/tenantInsights';
import { generateTenantSummary } from '../../utils/tenantSummary';
import { generateMessageTemplate, generateSMSMessage } from '../../utils/messageTemplates';

interface LeaseDetailModalProps {
  leaseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

type Tab = 'details' | 'ledger';

export function LeaseDetailModal({ leaseId, onClose, onUpdate }: LeaseDetailModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string>('');
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftText, setDraftText] = useState<string>('');
  const [draftChannel, setDraftChannel] = useState<'email' | 'sms'>('email');

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
          unit:core_units(id, unit_code, property_id),
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

  const handleSummarizeTenant = () => {
    if (!lease || !ledgerAccount) return;

    const balance = Math.abs(Number(ledgerAccount.current_balance || 0));
    const summary = generateTenantSummary({
      residentName: lease.primary_resident?.full_name || 'Unknown',
      unitCode: lease.unit?.unit_code || 'Unknown',
      balance,
      daysPastDue: ledgerAccount.days_past_due || 0,
      category: insight?.category || 'current',
      lastPaymentAt: ledgerAccount.last_payment_at || null,
      lastContactAt: ledgerAccount.last_contact_at || null,
      promiseToPayDate: ledgerAccount.promise_to_pay_date || null,
      promiseAmount: ledgerAccount.promise_amount ? Number(ledgerAccount.promise_amount) : null,
      promiseStatus: ledgerAccount.promise_status || null,
      noticeType: ledgerAccount.notice_type || null,
      noticeSentDate: ledgerAccount.notice_sent_date || null,
      noticeMethod: ledgerAccount.notice_method || null
    });

    setSummaryText(summary);
    setSummaryModalOpen(true);
  };

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

  // Helper to compute balance from transactions if ledger account balance is missing
  const getEffectiveBalance = async (): Promise<number> => {
    if (ledgerAccount?.current_balance !== undefined && ledgerAccount.current_balance !== null) {
      return Math.abs(Number(ledgerAccount.current_balance));
    }
    
    // Compute from transactions if available
    if (ledgerAccount?.id && transactions.length > 0) {
      const computedBalance = transactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
      return Math.abs(computedBalance);
    }
    
    return 0;
  };

  // Get disable reason for Draft Outreach button
  const getDraftOutreachDisabledReason = (): string | null => {
    if (!lease) return 'No lease data available';
    if (!lease.primary_resident) return 'No resident information';
    
    const hasEmail = !!lease.primary_resident.email;
    const hasPhone = !!lease.primary_resident.phone;
    
    if (!hasEmail && !hasPhone) {
      return 'No email or phone on file';
    }
    
    // Check if we have balance data (ledger account or transactions)
    if (!ledgerAccount && transactions.length === 0) {
      return 'No ledger data available';
    }
    
    return null; // Enabled
  };

  const handleDraftOutreach = async () => {
    if (!lease || !lease.primary_resident) {
      setErrorMessage('Cannot draft outreach: No lease or resident data');
      return;
    }

    try {
      const hasEmail = !!lease.primary_resident.email;
      const hasPhone = !!lease.primary_resident.phone;

      if (!hasEmail && !hasPhone) {
        setErrorMessage('Cannot draft outreach: No email or phone on file');
        return;
      }

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

      // Auto-select channel based on available contact info
      if (!hasEmail && hasPhone) {
        setDraftChannel('sms');
      } else if (hasEmail && !hasPhone) {
        setDraftChannel('email');
      }

      const params = {
        residentName: lease.primary_resident.full_name || 'Unknown',
          category,
        balance,
        daysPastDue,
        unitCode: lease.unit?.unit_code
      };

      const draft = draftChannel === 'email'
        ? generateMessageTemplate(params, 'friendly')
        : generateSMSMessage(params);

      setDraftText(draft);
      setDraftModalOpen(true);
    } catch (err: any) {
      console.error('[LeaseDetailModal] Error drafting outreach:', err);
      setErrorMessage(`Failed to draft outreach: ${err?.message || 'Unknown error'}`);
    }
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              {lease?.unit?.property_id && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/core/properties/${lease.unit.property_id}/leases`);
                    }}
                    className="hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Property
                  </button>
                  <span>/</span>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/core/properties/${lease.unit.property_id}/leases`);
                    }}
                    className="hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Leases
                  </button>
                  <span>/</span>
                  <span className="text-gray-900 dark:text-white">Lease Details</span>
                </div>
              )}
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lease Details</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-6">
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
          <div className="flex-1">
            {lease?.unit?.property_id && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/core/properties/${lease.unit.property_id}/leases`);
                  }}
                  className="hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Property
                </button>
                <span>/</span>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/core/properties/${lease.unit.property_id}/leases`);
                  }}
                  className="hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Leases
                </button>
                <span>/</span>
                <span className="text-gray-900 dark:text-white">Lease Details</span>
              </div>
            )}
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Lease Details - {lease.unit?.unit_code}
          </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-4">
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
                    {lease.unit?.id && (
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-medium">Unit:</span>{' '}
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/core/units/${lease.unit.id}`);
                          }}
                          className="text-havyn-primary dark:text-emerald-400 hover:underline flex items-center gap-1 inline"
                        >
                          <Home className="w-3 h-3" />
                          {lease.unit?.unit_code || 'Unknown'}
                        </button>
                      </p>
                    )}
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

                {/* AI Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSummarizeTenant}
                    disabled={!lease || !ledgerAccount}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    Summarize Tenant
                  </button>
                  {(() => {
                    const disableReason = getDraftOutreachDisabledReason();
                    const isDisabled = !!disableReason;
                    return (
                      <div className="relative group">
                        <button
                          onClick={handleDraftOutreach}
                          disabled={isDisabled}
                          title={disableReason || 'Draft outreach message'}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Draft Outreach
                        </button>
                        {isDisabled && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {disableReason}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
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

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Tenant Summary</h3>
                <button onClick={() => setSummaryModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{summaryText}</p>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Outreach Modal */}
      {draftModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Draft Outreach</h3>
                <button onClick={() => setDraftModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Channel</label>
                <select
                  value={draftChannel}
                  onChange={(e) => {
                    setDraftChannel(e.target.value as 'email' | 'sms');
                    // Regenerate draft when channel changes
                    if (lease && ledgerAccount && insight) {
                      const balance = Math.abs(Number(ledgerAccount.current_balance || 0));
                      const params = {
                        residentName: lease.primary_resident?.full_name || 'Unknown',
                        category: (insight.category || 'current') as 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent',
                        balance,
                        daysPastDue: ledgerAccount.days_past_due || 0,
                        unitCode: lease.unit?.unit_code
                      };
                      const draft = e.target.value === 'email'
                        ? generateMessageTemplate(params, 'friendly')
                        : generateSMSMessage(params);
                      setDraftText(draft);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</label>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setDraftModalOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(draftText);
                  setSuccessMessage('Message copied to clipboard');
                  setDraftModalOpen(false);
                }}
                className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Copy Message
              </button>
        </div>
      </div>
    </div>
      )}
    </>
  );
}
