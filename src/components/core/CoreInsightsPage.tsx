import React, { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, Loader2, Calendar, TrendingUp, FileText, Filter, MessageSquare, CheckCircle, X, StickyNote } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TenantDetailDrawer } from './TenantDetailDrawer';
import { updateLastContact, updatePromiseToPayDate, updateLedgerNotes } from '../../utils/communicationLogging';

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Insights & Delinquency</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage delinquent accounts and tenant communications</p>
        </div>
        <div className="flex items-center gap-3">
          {properties.length > 1 && (
            <select
              value={propertyId || properties[0]?.id || ''}
              onChange={(e) => navigate(`/core/financial?property_id=${e.target.value}`)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {properties.map(prop => (
                <option key={prop.id} value={prop.id}>{prop.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
              showFilters || categoryFilter !== 'all' || daysPastDueFilter !== 'all'
                ? 'border-havyn-primary bg-havyn-primary/10 text-havyn-primary dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold">Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-200">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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

      {/* Summary Cards */}
      {filteredDelinquencies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
              <DollarSign className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
              <AlertCircle className="w-12 h-12 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Days Past Due</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {avgDaysPastDue}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Average</p>
              </div>
              <Calendar className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      )}

      {/* Delinquency Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Delinquent Accounts</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
          </div>
        ) : filteredDelinquencies.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {allDelinquencies.length === 0 ? 'No Delinquencies' : 'No Results'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {allDelinquencies.length === 0
                ? 'All accounts are current. Great job!'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Resident
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Days Past Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Recommended Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Promise to Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDelinquencies.map((record) => (
                  <tr key={record.leaseId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {record.residentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => navigate(`/core/units/${record.unitId}`)}
                        className="text-havyn-primary dark:text-emerald-400 hover:underline"
                      >
                        {record.unitCode}
                      </button>
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
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {record.recommendedAction}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.lastContactAt
                        ? new Date(record.lastContactAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.promiseToPayDate
                        ? new Date(record.promiseToPayDate).toLocaleDateString()
                        : '-'}
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
        )}
      </div>

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Set Promise-to-Pay Date</h3>
                <button onClick={() => setPromiseToPayModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Promise-to-Pay Date
                </label>
                <input
                  type="date"
                  value={promiseToPayDate}
                  onChange={(e) => setPromiseToPayDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave empty to clear the promise-to-pay date
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPromiseToPayModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePromiseToPay}
                  className="flex-1 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Log Note</h3>
                <button onClick={() => setNotesModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  placeholder="Add notes about this tenant..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setNotesModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  className="flex-1 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

