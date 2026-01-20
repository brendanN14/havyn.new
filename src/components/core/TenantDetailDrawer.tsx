import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, AlertCircle, MessageSquare, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { updateTenantInsightsForLease } from '../../utils/tenantInsights';
import { logCommunication, updateLastContact, updatePromiseToPayDate, updateLedgerNotes, CommunicationLog } from '../../utils/communicationLogging';
import { generateMessageTemplate, generateSMSMessage } from '../../utils/messageTemplates';
import { TransactionModal } from './TransactionModal';
import { ActivityTimeline, Card, CardBody, Drawer, Tabs, Tab, Button, Spinner, Badge, Modal, getDelinquencyBadgeVariant, DataTable } from '../ui';

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
  const [activities, setActivities] = useState<any[]>([]);
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

  useEffect(() => {
    if (leaseId) {
      fetchActivitiesForLease();
    }
  }, [leaseId]);

  const fetchActivitiesForLease = async () => {
    if (!leaseId) return;
    try {
      const { fetchActivities: fetchActivitiesUtil } = await import('../../utils/activityLogging');
      const events = await fetchActivitiesUtil({ leaseId });
      setActivities(events);
    } catch (err) {
      console.error('[TenantDetailDrawer] Error fetching activities:', err);
    }
  };

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
      await fetchActivitiesForLease();
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
        await fetchActivitiesForLease();
      }
    } catch (err) {
      console.error('[TenantDetailDrawer] Error copying message:', err);
      setErrorMessage('Failed to copy message');
    }
  };

  if (loading) {
    return (
      <Drawer isOpen={true} onClose={onClose} size="md">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Drawer>
    );
  }

  if (!lease) {
    return null;
  }

  const balance = Number(ledgerAccount?.current_balance || 0);
  const balanceDisplay = Math.abs(balance);
  const isOwed = balance < 0;

  const drawerTitle = `${lease.primary_resident?.full_name || 'Tenant'} • ${lease.unit?.unit_code || 'N/A'}`;

  return (
    <>
      <Drawer
        isOpen={!!lease}
        onClose={onClose}
        title={drawerTitle}
        size="md"
      >
        {/* Messages */}
        {successMessage && (
          <Card className="border-status-success mb-4">
            <CardBody>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-status-success" />
                <p className="text-status-success-text dark:text-status-success-text-dark text-sm">{successMessage}</p>
              </div>
            </CardBody>
          </Card>
        )}
        {errorMessage && (
          <Card className="border-status-danger mb-4">
            <CardBody>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-status-danger" />
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm">{errorMessage}</p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value as Tab)}>
            <Tab value="ledger" label="Ledger" icon={<DollarSign className="w-4 h-4" />} />
            <Tab value="communications" label="Activity" icon={<FileText className="w-4 h-4" />} />
            <Tab value="insights" label="Insights" icon={<RefreshCw className="w-4 h-4" />} />
          </Tabs>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Ledger Snapshot */}
              <Card>
                <CardBody>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ledger Snapshot</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        isOwed 
                          ? 'text-status-danger dark:text-status-danger-text-dark' 
                          : 'text-status-success dark:text-status-success-text-dark'
                      }`}>
                        {isOwed ? '-' : '+'}${balanceDisplay.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Days Past Due</p>
                      <p className={`text-2xl font-bold mt-1 ${
                        (ledgerAccount?.days_past_due || 0) > 0
                          ? 'text-status-warning dark:text-status-warning-text-dark'
                          : 'text-gray-900 dark:text-white'
                      }`}>
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
                </CardBody>
              </Card>

              {/* Transaction Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransactionAction('rent');
                    setTransactionModalOpen(true);
                  }}
                >
                  Post Monthly Rent
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setTransactionAction('payment');
                    setTransactionModalOpen(true);
                  }}
                >
                  Record Payment
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransactionAction('charge');
                    setTransactionModalOpen(true);
                  }}
                >
                  Add Charge/Fee
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransactionAction('credit');
                    setTransactionModalOpen(true);
                  }}
                >
                  Add Credit/Refund
                </Button>
              </div>

              {/* Transaction History */}
              <Card>
                <CardBody>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction History</h3>
                  <DataTable
                    columns={[
                      {
                        key: 'date',
                        label: 'Date',
                        render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(value).toLocaleDateString()}</span>
                      },
                      {
                        key: 'type',
                        label: 'Type',
                        render: (value) => <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
                      },
                      {
                        key: 'category',
                        label: 'Category',
                        render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value || '-'}</span>
                      },
                      {
                        key: 'memo',
                        label: 'Memo',
                        render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value || '-'}</span>
                      },
                      {
                        key: 'amount',
                        label: 'Amount',
                        className: 'text-right',
                        render: (value) => (
                          <span className={`text-sm font-medium tabular-nums ${
                            value < 0 ? 'text-status-danger' : 'text-status-success'
                          }`}>
                            {value < 0 ? '-' : '+'}${Math.abs(value).toLocaleString()}
                          </span>
                        )
                      }
                    ]}
                    data={transactions.map(txn => ({
                      date: txn.txn_date,
                      type: txn.txn_type,
                      category: txn.category,
                      memo: txn.memo,
                      amount: txn.amount
                    }))}
                    emptyMessage="No transactions yet"
                  />
                </CardBody>
              </Card>
            </div>
          )}

          {activeTab === 'communications' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Timeline</h3>
                <Button
                  onClick={handleDraftMessage}
                >
                  <MessageSquare className="w-4 h-4" />
                  Draft Message
                </Button>
              </div>

              <Card>
                <CardBody>
                  <ActivityTimeline
                    events={activities}
                    emptyMessage="No activity recorded yet"
                  />
                </CardBody>
              </Card>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tenant Insights</h3>
                <Button
                  variant="secondary"
                  onClick={handleRefreshInsight}
                  disabled={refreshingInsight}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingInsight ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {insight ? (
                <Card>
                  <CardBody className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Category</p>
                      <Badge variant={getDelinquencyBadgeVariant(insight.category)}>
                        {insight.category?.replace('_', ' ')}
                      </Badge>
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
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Summary</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{insight.narrative_summary}</p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody>
                    <p className="text-gray-500 dark:text-gray-400">No insights available. Click "Refresh" to generate.</p>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>
      </Drawer>

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
        <Modal
          isOpen={messageModalOpen}
          onClose={() => setMessageModalOpen(false)}
          title="Draft Message"
          size="lg"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleCopyMessage}
                className="flex-1"
              >
                Copy & Mark Sent
              </Button>
              <Button
                onClick={handleSendMessage}
                className="flex-1"
              >
                Send & Log
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Channel</label>
              <select
                value={messageChannel}
                onChange={(e) => setMessageChannel(e.target.value as 'email' | 'sms' | 'both')}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
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
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

