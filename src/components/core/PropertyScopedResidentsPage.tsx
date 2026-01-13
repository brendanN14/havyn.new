import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseDetailModal } from './LeaseDetailModal';
import { getAmountOwed } from '../../utils/financialSummary';

interface Resident {
  id: string;
  leaseId: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  unit_code: string | null;
  lease_status: string | null;
  balance: number;
  category: string | null;
}

export function PropertyScopedResidentsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { user } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && user?.id) {
      fetchResidents();
    }
  }, [propertyId, user?.id]);

  const fetchResidents = async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);
    try {
      // First get residents for this property
      const { data: propertyResidents, error: residentsError } = await supabase
        .from('core_residents')
        .select('id')
        .eq('property_id', propertyId);

      if (residentsError) throw residentsError;

      const residentIds = propertyResidents?.map(r => r.id) || [];

      if (residentIds.length === 0) {
        setResidents([]);
        setLoading(false);
        return;
      }

      // Get active leases for these residents
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select(`
          id,
          primary_resident_id,
          unit_id,
          status,
          unit:core_units(unit_code),
          primary_resident:core_residents(full_name, email, phone),
          ledger_account:core_ledger_accounts(current_balance)
        `)
        .in('primary_resident_id', residentIds)
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      // Get insights
      const leaseIds = leases?.map(l => l.id) || [];
      const { data: insights } = leaseIds.length > 0 ? await supabase
        .from('core_tenant_insights')
        .select('lease_id, category')
        .in('lease_id', leaseIds) : { data: [] };

      const insightMap = new Map(insights?.map(i => [i.lease_id, i.category]) || []);

      // Format residents
      const formattedResidents: Resident[] = leases?.map((lease: any) => {
        const balance = Number(lease.ledger_account?.current_balance || 0);
        return {
          id: lease.primary_resident_id,
          leaseId: lease.id,
          full_name: lease.primary_resident?.full_name || 'Unknown',
          email: lease.primary_resident?.email || null,
          phone: lease.primary_resident?.phone || null,
          unit_code: lease.unit?.unit_code || null,
          lease_status: lease.status,
          balance: getAmountOwed(balance),
          category: insightMap.get(lease.id) || null
        };
      }) || [];

      setResidents(formattedResidents);
    } catch (err: any) {
      console.error('Error fetching residents:', err);
      if (!error) {
        setError('Failed to load residents');
      }
    } finally {
      setLoading(false);
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Residents</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage residents for this property</p>
        </div>
      </div>

      {residents.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No residents yet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Residents will appear here once leases are created
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lease Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {residents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {resident.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {resident.unit_code || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        resident.lease_status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {resident.lease_status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {resident.balance > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          ${resident.balance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-600 dark:text-gray-400">$0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resident.category && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          resident.category === 'current' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          resident.category === 'at_risk' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                          resident.category === 'delinquent' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                          'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        }`}>
                          {resident.category.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>{resident.email || '-'}</div>
                      <div className="text-xs">{resident.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedLeaseId(resident.leaseId)}
                        className="text-havyn-primary dark:text-green-400 hover:underline"
                      >
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => setSelectedLeaseId(null)}
          onUpdate={fetchResidents}
        />
      )}
    </div>
  );
}

