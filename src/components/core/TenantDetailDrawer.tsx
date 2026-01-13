import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, RefreshCw, AlertCircle, MessageSquare, Mail, Phone, Calendar, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { updateTenantInsightsForLease } from '../../utils/tenantInsights';
import { logCommunication, updateLastContact, updatePromiseToPayDate, updateLedgerNotes, CommunicationLog } from '../../utils/communicationLogging';
import { generateMessageTemplate, generateSMSMessage } from '../../utils/messageTemplates';
import { TransactionModal } from './TransactionModal';

interface TenantDetailDrawerProps {
  leaseId: string;
  onClose: () => void;
  onUpdate: () => void;
}

type Tab = 'ledger' | 'communications' | 'insights';

export function TenantDetailDrawer({ leaseId, onClose, onUpdate }: TenantDetailDrawerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('ledger');
  const [loading, setLoading] = useState(true);
  const [refreshingInsight, setRefreshingInsight] = useState(false);
  const [lease, setLease] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionAction, setTransactionAction] = useState<'rent' | 'payment' | 'charge' | 'credit'>('payment');
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageChannel, setMessageChannel] = useState<'email' | 'sms' | 'both'>('both');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTenantDetails();
  }, [leaseId]);

  // Auto-dismiss messages
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

  const fetchTenantDetails = async () => {
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
        console.error('[TenantDetailDrawer] Error fetching lease:', leaseError);
        setErrorMessage('Failed to load tenant details');
        return;
      }

      if (leaseData) {
        setLease(leaseData);
        setLedgerAccount(leaseData.ledger_account);

        // Fetch transactions
        if (leaseData.ledger_account) {
          const { data: txns, error: txnError } = await supabase
            .from('core_ledger_txns')
            .select('*')
            .eq('ledger_account_id', leaseData.ledger_account.id)
            .order('txn_date', { ascending: false })
            .order('created_at', { ascending: false });

          if (!txnError) {
            setTransactions(txns || []);
          }
        }

        // Fetch insight
        const { data: insightData } = await supabase
          .from('core_tenant_insights')
          .select('*')
          .eq('lease_id', leaseId)
          .single();

        setInsight(insightData);

        // Fetch communications
        const { data: comms, error: commError } = await supabase
          .from('core_communication_logs')
          .select('*')
          .eq('lease_id', leaseId)
          .order('created_at', { ascending: false });

        if (!commError) {
          setCommunications(comms || []);
        }
      }
    } catch (err: any) {
      console.error('[TenantDetailDrawer] Error fetching tenant details:', err);
      setErrorMessage('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshInsight = async () => {
    if (!leaseId) return;
    setRefreshingInsight(true);
    try {
      await updateTenantInsightsForLease(leaseId);
      await fetchTenantDetails();
      setSuccessMessage('Insight refreshed successfully');
    } catch (err: any) {
      console.error('[TenantDetailDrawer] Error refreshing insight:', err);
      setErrorMessage('Failed to refresh insight');
    } finally {
      setRefreshingInsight(false);
    }
  };

  const handleDraftMessage = () => {
    if (!insight || !lease?.primary_resident) return;

    const balance = Math.abs(Number(ledgerAccount?.current_balance || 0));
    const daysPastDue = ledgerAccount?.days_past_due || 0;
    const category = insight.category || 'delinquent';

    const template = generateMessageTemplate({
      residentName: lease.primary_resident.full_name || 'Resident',
      category: category as any,
      balance,
      daysPastDue,
      unitCode: lease.unit?.unit_code
    });

    setMessageText(template);
    setMessageModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !leaseId || !user?.id) return;

    try {
      // Always log the communication first
      const logResult = await logCommunication({
        leaseId,
        direction: 'outbound',
        channel: messageChannel === 'both' ? 'email' : messageChannel, // Use email as primary for 'both'
        message: messageText,
        status: 'copied', // Default to copied if API not stable
        recipientEmail: lease?.primary_resident?.email || undefined,
        recipientPhone: lease?.primary_resident?.phone || undefined,
        userId: user.id
      });

      // Try to send via API (optional - if it fails, still log as 'copied')
      try {
        // For now, we'll just log it. In production, you'd call the send-notification function here
        // and update the log status based on the result
        console.log('[TenantDetailDrawer] Message would be sent via API');
      } catch (sendError) {
        console.error('[TenantDetailDrawer] Error sending message:', sendError);
        // Still logged as 'copied' above
      }

      // Update last contact
      await updateLastContact(leaseId);

      setSuccessMessage('Message logged successfully');
      setMessageModalOpen(false);
      setMessageText('');
      await fetchTenantDetails();
      onUpdate();
    } catch (err: any) {
      console.error('[TenantDetailDrawer] Error logging message:', err);
      setErrorMessage('Failed to log message');
    }
  };

  const handleCopyMessage = async () => {
    if (!messageText.trim()) return;

    try {
      await navigator.clipboard.writeText(messageText);
      setSuccessMessage('Message copied to clipboard');
      
      // Log the communication
      if (leaseId && user?.id) {
        await logCommunication({
          leaseId,
          direction: 'outbound',
          channel: messageChannel === 'both' ? 'email' : messageChannel,
          message: messageText,
          status: 'copied',
          recipientEmail: lease?.primary_resident?.email || undefined,
          recipientPhone: lease?.primary_resident?.phone || undefined,
          userId: user.id
        });

        await updateLastContact(leaseId);
        await fetchTenantDetails();
      }
    } catch (err) {
      console.error('[TenantDetailDrawer] Error copying message:', err);
      setErrorMessage('Failed to copy message');
    }
  };

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
        <div className="fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
          </div>
        </div>
      </>
    );
  }

  if (!lease) {
    return null;
  }

  const balance = Number(ledgerAccount?.current_balance || 0);
  const balanceDisplay = Math.abs(balance);
  const isOwed = balance < 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {lease.primary_resident?.full_name || 'Tenant'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {lease.unit?.unit_code} • {lease.primary_resident?.email || 'No email'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
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
                onClick={() => setActiveTab('communications')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'communications'
                    ? 'border-havyn-primary text-havyn-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Communications
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'insights'
                    ? 'border-havyn-primary text-havyn-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Insights
              </button>
            </nav>
          </div>
        </div>

        {/* Messages */}
        <div className="px-6 pt-4">
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-green-800 dark:text-green-200">{successMessage}</p>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Ledger Snapshot */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ledger Snapshot</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
                    <p className={`text-2xl font-bold mt-1 ${isOwed ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {isOwed ? '-' : '+'}${balanceDisplay.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Days Past Due</p>
                    <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                      {ledgerAccount?.days_past_due || 0}
                    </p>
                  </div>
                </div>
                {ledgerAccount?.last_payment_at && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Payment</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {new Date(ledgerAccount.last_payment_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Transaction Actions */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setTransactionAction('rent');
                    setTransactionModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Post Monthly Rent
                </button>
                <button
                  onClick={() => {
                    setTransactionAction('payment');
                    setTransactionModalOpen(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Record Payment
                </button>
                <button
                  onClick={() => {
                    setTransactionAction('charge');
                    setTransactionModalOpen(true);
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Add Charge/Fee
                </button>
                <button
                  onClick={() => {
                    setTransactionAction('credit');
                    setTransactionModalOpen(true);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Add Credit/Refund
                </button>
              </div>

              {/* Transaction History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
                {transactions.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Memo</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {transactions.map((txn) => (
                          <tr key={txn.id}>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(txn.txn_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{txn.txn_type}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{txn.category || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{txn.memo || '-'}</td>
                            <td className={`px-4 py-3 text-sm text-right font-medium ${
                              txn.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                              {txn.amount < 0 ? '-' : '+'}${Math.abs(txn.amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'communications' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Communication Timeline</h3>
                <button
                  onClick={handleDraftMessage}
                  className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Draft Message
                </button>
              </div>

              {communications.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No communications yet</p>
              ) : (
                <div className="space-y-4">
                  {communications.map((comm) => (
                    <div key={comm.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {comm.channel === 'email' && <Mail className="w-4 h-4 text-gray-400" />}
                          {comm.channel === 'sms' && <Phone className="w-4 h-4 text-gray-400" />}
                          {comm.channel === 'note' && <FileText className="w-4 h-4 text-gray-400" />}
                          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {comm.direction} {comm.channel}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(comm.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {comm.subject && (
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{comm.subject}</p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{comm.message}</p>
                      {comm.status && (
                        <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                          comm.status === 'sent' || comm.status === 'copied'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {comm.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tenant Insights</h3>
                <button
                  onClick={handleRefreshInsight}
                  disabled={refreshingInsight}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingInsight ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {insight ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Category</p>
                    <span className={`inline-block mt-1 px-3 py-1 text-sm font-medium rounded-full ${
                      insight.category === 'current' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      insight.category === 'at_risk' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                      insight.category === 'delinquent' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}>
                      {insight.category?.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Recommended Action</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{insight.recommended_action}</p>
                  </div>
                  {insight.reasons && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Reasons</p>
                      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 mt-1 space-y-1">
                        {insight.reasons.map((reason: string, idx: number) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insight.narrative_summary && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Summary</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{insight.narrative_summary}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No insights available. Click "Refresh" to generate.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      {transactionModalOpen && ledgerAccount && (
        <TransactionModal
          leaseId={leaseId}
          ledgerAccountId={ledgerAccount.id}
          action={transactionAction}
          onClose={() => {
            setTransactionModalOpen(false);
            fetchTenantDetails();
            onUpdate();
          }}
        />
      )}

      {/* Message Modal */}
      {messageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Draft Message</h3>
                <button onClick={() => setMessageModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Channel</label>
                <select
                  value={messageChannel}
                  onChange={(e) => setMessageChannel(e.target.value as 'email' | 'sms' | 'both')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="both">Email + SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCopyMessage}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Copy & Mark Sent
                </button>
                <button
                  onClick={handleSendMessage}
                  className="flex-1 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Send & Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

