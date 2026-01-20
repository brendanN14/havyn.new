import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, CheckCircle, Calendar, StickyNote, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TenantDetailDrawer } from './TenantDetailDrawer';
import { updateLastContact, updatePromiseToPayDate, updateLedgerNotes } from '../../utils/communicationLogging';
import { getAmountOwed } from '../../utils/financialSummary';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, Modal, getDelinquencyBadgeVariant } from '../ui';

interface DelinquencyRecord {
  leaseId: string;
  unitId: string;
  residentName: string;
  residentEmail: string | null;
  residentPhone: string | null;
  unitCode: string;
  balance: number;
  daysPastDue: number;
  category: string;
  recommendedAction: string;
  lastContactAt: string | null;
  promiseToPayDate: string | null;
  lastPaymentAt: string | null;
}

type CategoryFilter = 'all' | 'current' | 'at_risk' | 'delinquent' | 'severe_delinquent';
type DaysPastDueBucket = 'all' | '0-5' | '6-29' | '30-59' | '60+';

export function PropertyScopedCollectionsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [allDelinquencies, setAllDelinquencies] = useState<DelinquencyRecord[]>([]);
  const [filteredDelinquencies, setFilteredDelinquencies] = useState<DelinquencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [daysPastDueFilter, setDaysPastDueFilter] = useState<DaysPastDueBucket>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Action modals
  const [promiseToPayModalOpen, setPromiseToPayModalOpen] = useState(false);
  const [promiseToPayLeaseId, setPromiseToPayLeaseId] = useState<string | null>(null);
  const [promiseToPayDate, setPromiseToPayDate] = useState('');
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesLeaseId, setNotesLeaseId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    if (propertyId && user?.id) {
      fetchDelinquencies();
    }
  }, [propertyId, user?.id]);

  // Apply filters whenever data or filters change
  useEffect(() => {
    applyFilters();
  }, [allDelinquencies, categoryFilter, daysPastDueFilter]);

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

  const fetchDelinquencies = async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);

    try {
      // Get all leases for this property with active status
      const { data: propertyUnits, error: unitsError } = await supabase
        .from('core_units')
        .select('id')
        .eq('property_id', propertyId);

      if (unitsError) throw unitsError;

      const unitIds = propertyUnits?.map(u => u.id) || [];

      if (unitIds.length === 0) {
        setAllDelinquencies([]);
        setLoading(false);
        return;
      }

      // Get active leases for these units
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select(`
          id,
          unit_id,
          primary_resident_id,
          status,
          unit:core_units(id, unit_code),
          primary_resident:core_residents(full_name, email, phone),
          ledger_account:core_ledger_accounts(
            current_balance,
            days_past_due,
            last_payment_at,
            last_contact_at,
            promise_to_pay_date
          )
        `)
        .in('unit_id', unitIds)
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      // Get insights for these leases
      const leaseIds = leases?.map(l => l.id) || [];
      const { data: insights } = await supabase
        .from('core_tenant_insights')
        .select('lease_id, category, recommended_action')
        .in('lease_id', leaseIds);

      const insightMap = new Map(insights?.map(i => [i.lease_id, i]) || []);

      // Format records - note: balance < 0 means money is owed (our sign convention)
      const records: DelinquencyRecord[] = leases
        ?.filter(lease => {
          const balance = Number(lease.ledger_account?.current_balance || 0);
          return balance < 0; // Negative balance = money owed
        })
        .map(lease => {
          const insight = insightMap.get(lease.id);
          const balance = Number(lease.ledger_account?.current_balance || 0);
          
          return {
            leaseId: lease.id,
            unitId: lease.unit_id,
            residentName: lease.primary_resident?.full_name || 'Unknown',
            residentEmail: lease.primary_resident?.email || null,
            residentPhone: lease.primary_resident?.phone || null,
            unitCode: lease.unit?.unit_code || 'Unknown',
            balance: getAmountOwed(balance), // Display absolute value
            daysPastDue: lease.ledger_account?.days_past_due || 0,
            category: insight?.category || 'unknown',
            recommendedAction: insight?.recommended_action || 'No action',
            lastContactAt: lease.ledger_account?.last_contact_at || null,
            promiseToPayDate: lease.ledger_account?.promise_to_pay_date || null,
            lastPaymentAt: lease.ledger_account?.last_payment_at || null
          };
        })
        .sort((a, b) => b.daysPastDue - a.daysPastDue) // Sort worst-first (highest days past due first)
        || [];

      setAllDelinquencies(records);
    } catch (err: any) {
      console.error('[PropertyScopedCollectionsPage] Error fetching delinquencies:', err);
      setError(err?.message || 'Failed to load delinquencies');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allDelinquencies];

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(r => r.category === categoryFilter);
    }

    // Days past due filter
    if (daysPastDueFilter !== 'all') {
      filtered = filtered.filter(r => {
        switch (daysPastDueFilter) {
          case '0-5':
            return r.daysPastDue >= 0 && r.daysPastDue <= 5;
          case '6-29':
            return r.daysPastDue >= 6 && r.daysPastDue <= 29;
          case '30-59':
            return r.daysPastDue >= 30 && r.daysPastDue <= 59;
          case '60+':
            return r.daysPastDue >= 60;
          default:
            return true;
        }
      });
    }

    setFilteredDelinquencies(filtered);
  };

  const handleMarkContacted = async (leaseId: string) => {
    try {
      const result = await updateLastContact(leaseId);
      if (result.success) {
        setSuccessMessage('Marked as contacted');
        fetchDelinquencies();
      } else {
        setErrorMessage(`Failed to mark as contacted: ${result.error}`);
      }
    } catch (err) {
      console.error('[PropertyScopedCollectionsPage] Error marking as contacted:', err);
      setErrorMessage('Failed to mark as contacted');
    }
  };

  const handleOpenPromiseToPay = (leaseId: string, currentDate: string | null) => {
    setPromiseToPayLeaseId(leaseId);
    setPromiseToPayDate(currentDate || '');
    setPromiseToPayModalOpen(true);
  };

  const handleSavePromiseToPay = async () => {
    if (!promiseToPayLeaseId) return;

    try {
      const result = await updatePromiseToPayDate(promiseToPayLeaseId, promiseToPayDate || null);
      if (result.success) {
        setSuccessMessage('Promise-to-pay date updated');
        setPromiseToPayModalOpen(false);
        setPromiseToPayLeaseId(null);
        setPromiseToPayDate('');
        fetchDelinquencies();
      } else {
        setErrorMessage(`Failed to update promise-to-pay: ${result.error}`);
      }
    } catch (err) {
      console.error('[PropertyScopedCollectionsPage] Error saving promise-to-pay:', err);
      setErrorMessage('Failed to update promise-to-pay');
    }
  };

  const handleOpenNotes = async (leaseId: string) => {
    setNotesLeaseId(leaseId);
    // Fetch existing notes
    const { data: ledgerAccount } = await supabase
      .from('core_ledger_accounts')
      .select('notes')
      .eq('lease_id', leaseId)
      .single();
    
    setNotesText(ledgerAccount?.notes || '');
    setNotesModalOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!notesLeaseId) return;

    try {
      const result = await updateLedgerNotes(notesLeaseId, notesText);
      if (result.success) {
        setSuccessMessage('Notes updated');
        setNotesModalOpen(false);
        setNotesLeaseId(null);
        setNotesText('');
        fetchDelinquencies();
      } else {
        setErrorMessage(`Failed to update notes: ${result.error}`);
      }
    } catch (err) {
      console.error('[PropertyScopedCollectionsPage] Error saving notes:', err);
      setErrorMessage('Failed to update notes');
    }
  };

  const handleRefresh = async () => {
    if (!propertyId) return;
    setRefreshing(true);
    try {
      await fetchDelinquencies();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-status-danger">
        <CardBody>
          <div className="flex items-start gap-3">
            <div>
              <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Error</p>
              <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        subtitle={`${filteredDelinquencies.length} delinquent account${filteredDelinquencies.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {successMessage && (
        <Card className="border-status-success">
          <CardBody>
            <p className="text-status-success-text dark:text-status-success-text-dark text-sm">{successMessage}</p>
          </CardBody>
        </Card>
      )}

      {errorMessage && (
        <Card className="border-status-danger">
          <CardBody>
            <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm">{errorMessage}</p>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Categories</option>
                <option value="current">Current</option>
                <option value="at_risk">At Risk</option>
                <option value="delinquent">Delinquent</option>
                <option value="severe_delinquent">Severe Delinquent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Days Past Due
              </label>
              <select
                value={daysPastDueFilter}
                onChange={(e) => setDaysPastDueFilter(e.target.value as DaysPastDueBucket)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="0-5">0-5 days</option>
                <option value="6-29">6-29 days</option>
                <option value="30-59">30-59 days</option>
                <option value="60+">60+ days</option>
              </select>
            </div>
          </div>
          </CardBody>
        </Card>
      )}

      {/* Delinquency Table */}
      <Card>
        <CardBody className="p-0">
          <DataTable
            columns={[
              {
                key: 'unit',
                label: 'Unit',
                render: (_, row) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/core/units/${row.unitId}`);
                    }}
                    className="h-auto p-0 font-normal"
                  >
                    {row.unit}
                  </Button>
                )
              },
              {
                key: 'resident',
                label: 'Resident',
                render: (value) => <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              },
              {
                key: 'balance',
                label: 'Amount Owed',
                className: 'text-right',
                render: (value) => (
                  <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    ${value.toLocaleString()}
                  </span>
                )
              },
              {
                key: 'daysPastDue',
                label: 'Days Past Due',
                render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
              },
              {
                key: 'category',
                label: 'Category',
                render: (value) => <Badge variant={getDelinquencyBadgeVariant(value)}>{String(value).replace('_', ' ')}</Badge>
              },
              {
                key: 'lastPayment',
                label: 'Last Payment',
                render: (value) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {value === 'Never' ? value : new Date(value).toLocaleDateString()}
                  </span>
                )
              },
              {
                key: 'promiseToPay',
                label: 'Promise-to-Pay',
                render: (value) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {value === '-' ? value : new Date(value).toLocaleDateString()}
                  </span>
                )
              },
              {
                key: 'lastContacted',
                label: 'Last Contacted',
                render: (value) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {value === 'Never' ? value : new Date(value).toLocaleDateString()}
                  </span>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (_, row) => (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLeaseId(row.leaseId);
                      }}
                      title="Open tenant drawer"
                    >
                      View
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkContacted(row.leaseId);
                      }}
                      title="Mark as contacted"
                      aria-label="Mark as contacted"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPromiseToPay(row.leaseId, row.promiseToPayDate);
                      }}
                      title="Set promise-to-pay date"
                      aria-label="Set promise-to-pay date"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNotes(row.leaseId);
                      }}
                      title="Log note"
                      aria-label="Log note"
                    >
                      <StickyNote className="w-4 h-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            data={filteredDelinquencies.map(record => ({
              unit: record.unitCode,
              unitId: record.unitId,
              resident: record.residentName,
              balance: record.balance,
              daysPastDue: `${record.daysPastDue} days`,
              category: record.category,
              lastPayment: record.lastPaymentAt ? record.lastPaymentAt : 'Never',
              promiseToPay: record.promiseToPayDate ? record.promiseToPayDate : '-',
              lastContacted: record.lastContactAt ? record.lastContactAt : 'Never',
              leaseId: record.leaseId,
              promiseToPayDate: record.promiseToPayDate
            }))}
            loading={loading}
            emptyMessage="All accounts are current"
            emptyIcon={<CheckCircle className="w-16 h-16 text-gray-400 dark:text-gray-500" />}
            stickyHeader
          />
        </CardBody>
      </Card>

      {/* Tenant Detail Drawer */}
      {selectedLeaseId && (
        <TenantDetailDrawer
          leaseId={selectedLeaseId}
          onClose={() => {
            setSelectedLeaseId(null);
            handleRefresh();
          }}
          onUpdate={() => {
            fetchDelinquencies();
          }}
        />
      )}

      {/* Promise-to-Pay Date Modal */}
      {promiseToPayModalOpen && (
        <Modal
          isOpen={promiseToPayModalOpen}
          onClose={() => {
            setPromiseToPayModalOpen(false);
            setPromiseToPayLeaseId(null);
            setPromiseToPayDate('');
          }}
          title="Set Promise-to-Pay Date"
          size="md"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setPromiseToPayModalOpen(false);
                  setPromiseToPayLeaseId(null);
                  setPromiseToPayDate('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePromiseToPay}
                className="flex-1"
              >
                Save
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Promise Date
              </label>
              <input
                type="date"
                value={promiseToPayDate}
                onChange={(e) => setPromiseToPayDate(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Notes Modal */}
      {notesModalOpen && (
        <Modal
          isOpen={notesModalOpen}
          onClose={() => {
            setNotesModalOpen(false);
            setNotesLeaseId(null);
            setNotesText('');
          }}
          title="Add Note"
          size="md"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setNotesModalOpen(false);
                  setNotesLeaseId(null);
                  setNotesText('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNotes}
                className="flex-1"
              >
                Save
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                placeholder="Add internal notes about this account..."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

