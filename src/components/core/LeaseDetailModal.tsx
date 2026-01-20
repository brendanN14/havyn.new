import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Calendar, RefreshCw, AlertCircle, FileText, Home, Sparkles, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TransactionModal } from './TransactionModal';
import { updateTenantInsightsForLease } from '../../utils/tenantInsights';
import { SummarizeTenantModal } from './SummarizeTenantModal';
import { DraftOutreachModal } from './DraftOutreachModal';
import { Modal, Button, Badge, Card, CardBody, DataTable, Spinner, ActivityTimeline } from '../ui';
import { fetchActivities, logActivity } from '../../utils/activityLogging';

interface LeaseDetailModalProps {
  leaseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

type Tab = 'details' | 'ledger' | 'activity';

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
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchLeaseDetails();
  }, [leaseId]);

  useEffect(() => {
    if (leaseId) {
      fetchActivitiesForLease();
    }
  }, [leaseId]);

  const fetchActivitiesForLease = async () => {
    if (!leaseId) return;
    try {
      const events = await fetchActivities({ leaseId });
      setActivities(events);
    } catch (err) {
      console.error('[LeaseDetailModal] Error fetching activities:', err);
    }
  };

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

  const handleTransactionSuccess = async () => {
    setSuccessMessage('Transaction recorded successfully');
    await fetchLeaseDetails();
    await fetchActivitiesForLease();
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
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Loading..."
        size="2xl"
      >
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </Modal>
    );
  }

  if (!lease) {
    return null;
  }

  const balanceDisplay = getBalanceDisplay();

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Lease Details - ${lease.unit?.unit_code || ''}`}
        size="2xl"
        className="max-h-[90vh]"
      >
        {lease?.unit?.property_id && (
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/core/properties/${lease.unit.property_id}/leases`);
              }}
              className="h-auto p-0 text-xs"
            >
              Property
            </Button>
            <span>/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/core/properties/${lease.unit.property_id}/leases`);
              }}
              className="h-auto p-0 text-xs"
            >
              Leases
            </Button>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">Lease Details</span>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 -mx-6 px-6 mb-6">
          <nav className="flex space-x-8">
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
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'activity'
                    ? 'border-havyn-primary text-havyn-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Activity
              </button>
          </nav>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mb-4 bg-status-success-bg dark:bg-status-success-bg-dark/30 border border-status-success dark:border-status-success-bg-dark rounded-lg p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-status-success-text dark:text-status-success-text-dark text-sm">{successMessage}</p>
            </div>
            <Button
              variant="icon"
              size="sm"
              onClick={() => setSuccessMessage(null)}
            >
              <AlertCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 bg-status-danger-bg dark:bg-status-danger-bg-dark/30 border border-status-danger dark:border-status-danger-bg-dark rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-status-danger dark:text-status-danger-text-dark flex-shrink-0" />
            <div className="flex-1">
              <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm">{errorMessage}</p>
            </div>
            <Button
              variant="icon"
              size="sm"
              onClick={() => setErrorMessage(null)}
            >
              <AlertCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Lease Summary */}
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardBody>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Resident</h3>
                    <p className="text-gray-600 dark:text-gray-400">{lease.primary_resident?.full_name || 'N/A'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{lease.primary_resident?.email || ''}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">{lease.primary_resident?.phone || ''}</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Lease Information</h3>
                    {lease.unit?.id && (
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-medium">Unit:</span>{' '}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onClose();
                            navigate(`/core/units/${lease.unit.id}`);
                          }}
                          className="inline-flex items-center gap-1 h-auto p-0"
                        >
                          <Home className="w-3 h-3" />
                          {lease.unit?.unit_code || 'Unknown'}
                        </Button>
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
                  </CardBody>
                </Card>
              </div>

              {/* Tenant Insight */}
              {insight && (
                <Card>
                  <CardBody>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tenant Insight</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefreshInsight}
                        disabled={refreshingInsight}
                      >
                        <RefreshCw className={`w-4 h-4 ${refreshingInsight ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Category:</span>{' '}
                        <Badge variant={insight.category ? `delinquency-${insight.category.replace('_', '-')}` as any : 'neutral'}>
                          {insight.category?.replace('_', ' ') || 'N/A'}
                        </Badge>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Recommended Action:</span> {insight.recommended_action || 'N/A'}
                      </p>
                      {insight.narrative_summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{insight.narrative_summary}</p>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* AI Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setSummaryModalOpen(true)}
                  disabled={!lease || !ledgerAccount}
                  title={!lease || !ledgerAccount ? 'No lease or ledger data available' : 'Summarize tenant'}
                >
                  <Sparkles className="w-4 h-4" />
                  Summarize Tenant
                </Button>
                {(() => {
                  let disableReason: string | null = null;
                  if (!lease) {
                    disableReason = 'No lease data available';
                  } else if (!lease.primary_resident) {
                    disableReason = 'No resident information';
                  } else {
                    const hasEmail = !!lease.primary_resident.email;
                    const hasPhone = !!lease.primary_resident.phone;
                    if (!hasEmail && !hasPhone) {
                      disableReason = 'No email or phone on file';
                    } else if (!ledgerAccount && transactions.length === 0) {
                      disableReason = 'No ledger data available';
                    }
                  }

                  return (
                    <Button
                      variant="secondary"
                      onClick={() => setDraftModalOpen(true)}
                      disabled={!!disableReason}
                      title={disableReason || 'Draft outreach message'}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Draft Outreach
                    </Button>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Ledger Summary */}
              {ledgerAccount ? (
                <Card>
                  <CardBody>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Current Balance</p>
                        <p className={`text-2xl font-bold ${
                          balanceDisplay.isOwed 
                            ? 'text-status-danger dark:text-status-danger-text-dark' 
                            : 'text-status-success dark:text-status-success-text-dark'
                        }`}>
                          {balanceDisplay.isOwed ? '-' : ''}${balanceDisplay.amount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Days Past Due</p>
                        <p className={`text-2xl font-bold ${
                          (ledgerAccount.days_past_due || 0) > 0
                            ? 'text-status-warning dark:text-status-warning-text-dark'
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
                  </CardBody>
                </Card>
              ) : (
                <Card className="border-status-warning dark:border-status-warning">
                  <CardBody>
                    <p className="text-status-warning-text dark:text-status-warning-text-dark text-sm">
                      No ledger account found. Creating one automatically...
                    </p>
                  </CardBody>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => openTransactionModal('rent')}
                >
                  <Calendar className="w-4 h-4" />
                  Post Monthly Rent
                </Button>
                <Button
                  variant="primary"
                  onClick={() => openTransactionModal('payment')}
                >
                  <DollarSign className="w-4 h-4" />
                  Record Payment
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openTransactionModal('charge')}
                >
                  <Plus className="w-4 h-4" />
                  Add Charge/Fee
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => openTransactionModal('credit')}
                >
                  <FileText className="w-4 h-4" />
                  Add Credit/Refund
                </Button>
              </div>

              {/* Transactions Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
                <DataTable
                  columns={[
                    { key: 'txn_date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
                    { key: 'txn_type', label: 'Type', render: (value) => <Badge variant="neutral">{value}</Badge> },
                    { key: 'category', label: 'Category', render: (value) => value?.replace('_', ' ') || '-' },
                    {
                      key: 'amount',
                      label: 'Amount',
                      className: 'text-right',
                      render: (value) => {
                        const amount = Number(value || 0);
                        const isCharge = amount < 0;
                        return (
                          <span className={`text-sm font-medium ${
                            isCharge 
                              ? 'text-status-danger dark:text-status-danger-text-dark' 
                              : 'text-status-success dark:text-status-success-text-dark'
                          }`}>
                            {isCharge ? '-' : '+'}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        );
                      }
                    },
                    { key: 'memo', label: 'Memo', render: (value) => value || '-' },
                    { key: 'created_by', label: 'Created By', render: () => user?.email || '-' }
                  ]}
                  data={transactions}
                  emptyMessage="No transactions yet. Record a payment or post rent to get started."
                />
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6">
              <Card>
                <CardBody>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Timeline</h3>
                  <ActivityTimeline
                    events={activities}
                    emptyMessage="No activity recorded yet"
                  />
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </Modal>

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

      {/* Summarize Tenant Modal */}
      {summaryModalOpen && lease && ledgerAccount && (
        <SummarizeTenantModal
          isOpen={summaryModalOpen}
          onClose={() => setSummaryModalOpen(false)}
          lease={lease}
          ledgerAccount={ledgerAccount}
          insight={insight}
        />
      )}

      {/* Draft Outreach Modal */}
      {draftModalOpen && lease && (
        <DraftOutreachModal
          isOpen={draftModalOpen}
          onClose={() => setDraftModalOpen(false)}
          onCopyMessage={(message) => {
            setSuccessMessage('Message copied to clipboard');
            setDraftModalOpen(false);
          }}
          lease={lease}
          ledgerAccount={ledgerAccount}
          insight={insight}
          transactions={transactions}
        />
      )}
    </>
  );
}
