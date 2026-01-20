import React, { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, Calendar, TrendingUp, Filter, MessageSquare, CheckCircle, StickyNote } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TenantDetailDrawer } from './TenantDetailDrawer';
import { updateLastContact, updatePromiseToPayDate, updateLedgerNotes } from '../../utils/communicationLogging';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, Modal, getDelinquencyBadgeVariant } from '../ui';

interface Property {
  id: string;
  name: string;
}

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

export function CoreInsightsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('property_id');
  
  const [properties, setProperties] = useState<Property[]>([]);
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
    if (!user?.id) return;
    fetchProperties();
  }, [user?.id]);

  useEffect(() => {
    if (propertyId) {
      fetchDelinquencies(propertyId);
    } else if (properties.length > 0) {
      fetchDelinquencies(properties[0].id);
    }
  }, [propertyId, properties]);

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

  const fetchProperties = async () => {
    if (!user?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('core_properties')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('does not exist')) {
          setError('Core PMS tables not found. Please ensure the Core PMS migration has been applied.');
        } else {
          setError('Failed to load properties');
        }
        return;
      }

      setProperties(data || []);
    } catch (err: any) {
      console.error('[CoreInsightsPage] Error fetching properties:', err);
      setError('Failed to load properties');
    }
  };

  const fetchDelinquencies = async (propId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Get all leases for this property with active status
      const { data: propertyUnits, error: unitsError } = await supabase
        .from('core_units')
        .select('id')
        .eq('property_id', propId);

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
            balance: Math.abs(balance), // Display absolute value
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
      console.error('[CoreInsightsPage] Error fetching delinquencies:', err);
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
        // Refresh data
        if (propertyId) {
          fetchDelinquencies(propertyId);
        } else if (properties.length > 0) {
          fetchDelinquencies(properties[0].id);
        }
      } else {
        setErrorMessage(`Failed to mark as contacted: ${result.error}`);
      }
    } catch (err) {
      console.error('[CoreInsightsPage] Error marking as contacted:', err);
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
      const result = await updatePromiseToPayDate(
        promiseToPayLeaseId,
        promiseToPayDate || null
      );
      if (result.success) {
        setSuccessMessage('Promise-to-pay date updated');
        setPromiseToPayModalOpen(false);
        if (propertyId) {
          fetchDelinquencies(propertyId);
        } else if (properties.length > 0) {
          fetchDelinquencies(properties[0].id);
        }
      } else {
        setErrorMessage(`Failed to update promise-to-pay date: ${result.error}`);
      }
    } catch (err) {
      console.error('[CoreInsightsPage] Error updating promise-to-pay date:', err);
      setErrorMessage('Failed to update promise-to-pay date');
    }
  };

  const handleOpenNotes = async (leaseId: string) => {
    // Fetch current notes
    try {
      const { data: ledgerAccount } = await supabase
        .from('core_ledger_accounts')
        .select('notes')
        .eq('lease_id', leaseId)
        .single();
      
      setNotesLeaseId(leaseId);
      setNotesText(ledgerAccount?.notes || '');
      setNotesModalOpen(true);
    } catch (err) {
      console.error('[CoreInsightsPage] Error fetching notes:', err);
      setNotesLeaseId(leaseId);
      setNotesText('');
      setNotesModalOpen(true);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesLeaseId) return;
    try {
      const result = await updateLedgerNotes(notesLeaseId, notesText);
      if (result.success) {
        setSuccessMessage('Notes saved');
        setNotesModalOpen(false);
        if (propertyId) {
          fetchDelinquencies(propertyId);
        } else if (properties.length > 0) {
          fetchDelinquencies(properties[0].id);
        }
      } else {
        setErrorMessage(`Failed to save notes: ${result.error}`);
      }
    } catch (err) {
      console.error('[CoreInsightsPage] Error saving notes:', err);
      setErrorMessage('Failed to save notes');
    }
  };

  const handleRefresh = async () => {
    if (!propertyId && properties.length === 0) return;
    setRefreshing(true);
    try {
      await fetchDelinquencies(propertyId || properties[0].id);
    } finally {
      setRefreshing(false);
    }
  };

  const selectedProperty = properties.find(p => p.id === (propertyId || properties[0]?.id));
  const totalDelinquent = filteredDelinquencies.reduce((sum, d) => sum + d.balance, 0);
  const avgDaysPastDue = filteredDelinquencies.length > 0
    ? Math.round(filteredDelinquencies.reduce((sum, d) => sum + d.daysPastDue, 0) / filteredDelinquencies.length)
    : 0;

  const propertySelector = properties.length > 1 ? (
    <select
      value={propertyId || properties[0]?.id || ''}
      onChange={(e) => navigate(`/core/financial?property_id=${e.target.value}`)}
      className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
    >
      {properties.map(prop => (
        <option key={prop.id} value={prop.id}>{prop.name}</option>
      ))}
    </select>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights & Delinquency"
        subtitle="Manage delinquent accounts and tenant communications"
        actions={
          <>
            {propertySelector}
            <Button
              variant={showFilters || categoryFilter !== 'all' || daysPastDueFilter !== 'all' ? 'primary' : 'secondary'}
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
              {refreshing ? (
                <Spinner size="sm" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Card className="border-status-danger dark:border-status-danger">
          <CardBody>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger dark:text-status-danger-text-dark" />
              <div>
                <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Error</p>
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {successMessage && (
        <Card className="border-status-success dark:border-status-success">
          <CardBody>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-status-success dark:text-status-success-text-dark" />
              <p className="text-status-success-text dark:text-status-success-text-dark">{successMessage}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {errorMessage && (
        <Card className="border-status-danger dark:border-status-danger">
          <CardBody>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger dark:text-status-danger-text-dark" />
              <p className="text-status-danger-text dark:text-status-danger-text-dark">{errorMessage}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                >
                  <option value="all">All Categories</option>
                  <option value="at_risk">At Risk</option>
                  <option value="delinquent">Delinquent</option>
                  <option value="severe_delinquent">Severe Delinquent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Days Past Due
                </label>
                <select
                  value={daysPastDueFilter}
                  onChange={(e) => setDaysPastDueFilter(e.target.value as DaysPastDueBucket)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
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

      {/* Summary Cards */}
      {filteredDelinquencies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Delinquent</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    ${totalDelinquent.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {filteredDelinquencies.length} account{filteredDelinquencies.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-status-danger dark:text-status-danger-text-dark" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Delinquent Accounts</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {filteredDelinquencies.length}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {allDelinquencies.length} total
                  </p>
                </div>
                <AlertCircle className="w-12 h-12 text-status-warning dark:text-status-warning-text-dark" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Days Past Due</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {avgDaysPastDue}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Average</p>
                </div>
                <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Delinquency Table */}
      <Card>
        <CardBody className="p-0">
          <DataTable
            columns={[
              { key: 'residentName', label: 'Resident' },
              {
                key: 'unitCode',
                label: 'Unit',
                render: (value, row) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/core/units/${row.unitId}`)}
                    className="h-auto p-0 text-havyn-primary dark:text-emerald-400 hover:underline"
                  >
                    {value}
                  </Button>
                )
              },
              {
                key: 'balance',
                label: 'Balance',
                className: 'text-right',
                render: (value) => (
                  <span className="text-sm font-medium text-status-danger dark:text-status-danger-text-dark">
                    ${value.toLocaleString()}
                  </span>
                )
              },
              { key: 'daysPastDue', label: 'Days Past Due', render: (value) => `${value} days` },
              {
                key: 'category',
                label: 'Category',
                render: (value) => <Badge variant={getDelinquencyBadgeVariant(value)}>{value.replace('_', ' ')}</Badge>
              },
              { key: 'recommendedAction', label: 'Recommended Action', className: 'max-w-xs truncate' },
              {
                key: 'lastContactAt',
                label: 'Last Contact',
                render: (value) => value ? new Date(value).toLocaleDateString() : 'Never'
              },
              {
                key: 'promiseToPayDate',
                label: 'Promise to Pay',
                render: (value) => value ? new Date(value).toLocaleDateString() : '-'
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (_, row) => (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLeaseId(row.leaseId)}
                      title="View details"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkContacted(row.leaseId)}
                      title="Mark as contacted"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenPromiseToPay(row.leaseId, row.promiseToPayDate)}
                      title="Set promise to pay"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenNotes(row.leaseId)}
                      title="Add note"
                    >
                      <StickyNote className="w-4 h-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            data={filteredDelinquencies.map(r => ({
              ...r,
              actions: null // Placeholder for render function
            }))}
            loading={loading}
            emptyMessage={allDelinquencies.length === 0 ? 'All accounts are current. Great job!' : 'Try adjusting your filters to see more results.'}
            emptyIcon={<TrendingUp className="w-16 h-16 text-gray-400" />}
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
            if (propertyId) {
              fetchDelinquencies(propertyId);
            } else if (properties.length > 0) {
              fetchDelinquencies(properties[0].id);
            }
          }}
        />
      )}

      {/* Promise-to-Pay Date Modal */}
      {promiseToPayModalOpen && (
        <Modal
          isOpen={promiseToPayModalOpen}
          onClose={() => setPromiseToPayModalOpen(false)}
          title="Set Promise-to-Pay Date"
          size="md"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setPromiseToPayModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
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
                Promise-to-Pay Date
              </label>
              <input
                type="date"
                value={promiseToPayDate}
                onChange={(e) => setPromiseToPayDate(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to clear the promise-to-pay date
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Notes Modal */}
      {notesModalOpen && (
        <Modal
          isOpen={notesModalOpen}
          onClose={() => setNotesModalOpen(false)}
          title="Log Note"
          size="lg"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setNotesModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
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
                rows={8}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                placeholder="Add notes about this tenant..."
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

