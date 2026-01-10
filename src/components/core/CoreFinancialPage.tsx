import React, { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, Loader2, Calendar, TrendingUp, FileText } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseDetailModal } from './LeaseDetailModal';

interface Property {
  id: string;
  name: string;
}

interface DelinquencyRecord {
  leaseId: string;
  residentName: string;
  unitCode: string;
  balance: number;
  daysPastDue: number;
  category: string;
  lastPaymentAt: string | null;
}

export function CoreFinancialPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('property_id');
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [delinquencies, setDelinquencies] = useState<DelinquencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      console.error('[CoreFinancialPage] Error fetching properties:', err);
      setError('Failed to load properties');
    }
  };

  const fetchDelinquencies = async (propId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Get all leases for this property that have ledger accounts with balance < 0 (money owed)
      const { data: propertyUnits, error: unitsError } = await supabase
        .from('core_units')
        .select('id')
        .eq('property_id', propId);

      if (unitsError) throw unitsError;

      const unitIds = propertyUnits?.map(u => u.id) || [];

      if (unitIds.length === 0) {
        setDelinquencies([]);
        setLoading(false);
        return;
      }

      // Get leases for these units
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select(`
          id,
          unit_id,
          primary_resident_id,
          unit:core_units(unit_code),
          primary_resident:core_residents(full_name),
          ledger_account:core_ledger_accounts(current_balance, days_past_due, last_payment_at)
        `)
        .in('unit_id', unitIds);

      if (leasesError) throw leasesError;

      // Get insights for these leases
      const leaseIds = leases?.map(l => l.id) || [];
      const { data: insights } = await supabase
        .from('core_tenant_insights')
        .select('lease_id, category')
        .in('lease_id', leaseIds);

      const insightMap = new Map(insights?.map(i => [i.lease_id, i.category]) || []);

      // Filter to only delinquent accounts (balance < 0) and format
      const delinquentRecords: DelinquencyRecord[] = leases
        ?.filter(lease => {
          const balance = Number(lease.ledger_account?.current_balance || 0);
          return balance < 0; // Negative balance = money owed
        })
        .map(lease => ({
          leaseId: lease.id,
          residentName: lease.primary_resident?.full_name || 'Unknown',
          unitCode: lease.unit?.unit_code || 'Unknown',
          balance: Math.abs(Number(lease.ledger_account?.current_balance || 0)),
          daysPastDue: lease.ledger_account?.days_past_due || 0,
          category: insightMap.get(lease.id) || 'unknown',
          lastPaymentAt: lease.ledger_account?.last_payment_at || null
        }))
        .sort((a, b) => b.daysPastDue - a.daysPastDue) // Sort by days past due (highest first)
        || [];

      setDelinquencies(delinquentRecords);
    } catch (err: any) {
      console.error('[CoreFinancialPage] Error fetching delinquencies:', err);
      setError(err?.message || 'Failed to load delinquencies');
    } finally {
      setLoading(false);
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
  const totalDelinquent = delinquencies.reduce((sum, d) => sum + d.balance, 0);
  const avgDaysPastDue = delinquencies.length > 0
    ? Math.round(delinquencies.reduce((sum, d) => sum + d.daysPastDue, 0) / delinquencies.length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Track delinquencies and manage payments</p>
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

      {/* Summary Cards */}
      {delinquencies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Delinquent</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  ${totalDelinquent.toLocaleString()}
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
                  {delinquencies.length}
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
        ) : delinquencies.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Delinquencies</h3>
            <p className="text-gray-500 dark:text-gray-400">
              All accounts are current. Great job!
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
                    Last Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {delinquencies.map((record) => (
                  <tr key={record.leaseId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {record.residentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {record.unitCode}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedLeaseId(record.leaseId)}
                        className="text-havyn-primary dark:text-emerald-400 hover:underline"
                      >
                        View Lease
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lease Detail Modal */}
      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => {
            setSelectedLeaseId(null);
            handleRefresh();
          }}
          onUpdate={() => {
            fetchDelinquencies(propertyId || properties[0]?.id);
          }}
        />
      )}
    </div>
  );
}

