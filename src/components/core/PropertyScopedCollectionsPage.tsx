import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DollarSign, Loader2, AlertCircle, Filter, MessageSquare, CheckCircle, Calendar, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TenantDetailDrawer } from './TenantDetailDrawer';
import { updateLastContact, updatePromiseToPayDate, updateLedgerNotes } from '../../utils/communicationLogging';
import { getAmountOwed } from '../../utils/financialSummary';

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
        <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
        <div>
          <p className="text-red-800 dark:text-red-200 font-semibold">Error</p>
          <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Collections</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredDelinquencies.length} delinquent account{filteredDelinquencies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 text-sm">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
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
        </div>
      )}

      {/* Delinquency Table */}
      {filteredDelinquencies.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">All accounts are current</h3>
          <p className="text-gray-600 dark:text-gray-400">
            No delinquent accounts for this property
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Resident
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount Owed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Days Past Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Promise-to-Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Contacted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDelinquencies.map((record) => (
                  <tr key={record.leaseId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => navigate(`/core/units/${record.unitId}`)}
                        className="text-havyn-primary dark:text-emerald-400 hover:underline"
                      >
                        {record.unitCode}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {record.residentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                      ${record.balance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.daysPastDue} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        record.category === 'current' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        record.category === 'at_risk' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                        record.category === 'delinquent' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      }`}>
                        {record.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.lastPaymentAt
                        ? new Date(record.lastPaymentAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.promiseToPayDate
                        ? new Date(record.promiseToPayDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.lastContactAt
                        ? new Date(record.lastContactAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedLeaseId(record.leaseId)}
                          className="text-havyn-primary dark:text-emerald-400 hover:underline"
                          title="Open tenant drawer"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleMarkContacted(record.leaseId)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          title="Mark as contacted"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenPromiseToPay(record.leaseId, record.promiseToPayDate)}
                          className="text-purple-600 dark:text-purple-400 hover:underline"
                          title="Set promise-to-pay date"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenNotes(record.leaseId)}
                          className="text-gray-600 dark:text-gray-400 hover:underline"
                          title="Log note"
                        >
                          <StickyNote className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Set Promise-to-Pay Date</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Promise Date
                  </label>
                  <input
                    type="date"
                    value={promiseToPayDate}
                    onChange={(e) => setPromiseToPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setPromiseToPayModalOpen(false);
                      setPromiseToPayLeaseId(null);
                      setPromiseToPayDate('');
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePromiseToPay}
                    className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Note</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Add internal notes about this account..."
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setNotesModalOpen(false);
                      setNotesLeaseId(null);
                      setNotesText('');
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

