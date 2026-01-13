import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, FileText, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateLeaseModal } from './CreateLeaseModal';
import { LeaseDetailModal } from './LeaseDetailModal';
import { getAmountOwed } from '../../utils/financialSummary';

interface Lease {
  id: string;
  unit_code: string;
  resident_name: string;
  status: string;
  lease_start: string;
  lease_end: string;
  rent_amount: number;
  balance_due: number;
}

export function PropertyScopedLeasesPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { user } = useAuth();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && user?.id) {
      fetchLeases();
    }
  }, [propertyId, user?.id]);

  const fetchLeases = async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);
    try {
      // Get units for this property
      const { data: units, error: unitsError } = await supabase
        .from('core_units')
        .select('id')
        .eq('property_id', propertyId);

      if (unitsError) throw unitsError;

      const unitIds = units?.map(u => u.id) || [];

      if (unitIds.length === 0) {
        setLeases([]);
        setLoading(false);
        return;
      }

      // Get leases for these units
      const { data, error: fetchError } = await supabase
        .from('core_leases')
        .select(`
          id,
          unit_id,
          primary_resident_id,
          status,
          lease_start,
          lease_end,
          rent_amount,
          unit:core_units(unit_code),
          primary_resident:core_residents(full_name),
          ledger_account:core_ledger_accounts(current_balance)
        `)
        .in('unit_id', unitIds)
        .order('lease_start', { ascending: false });

      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')) {
          setError('Core PMS tables not found. Please run the database migration.');
          setLeases([]);
        } else {
          throw fetchError;
        }
      } else {
        // Format leases
        const leaseData = data || [];
        const formattedLeases: Lease[] = leaseData.map((l: any) => {
          const balance = Number(l.ledger_account?.current_balance || 0);
          return {
            id: l.id,
            unit_code: l.unit?.unit_code || 'Unknown',
            resident_name: l.primary_resident?.full_name || 'Unknown',
            status: l.status,
            lease_start: l.lease_start,
            lease_end: l.lease_end,
            rent_amount: l.rent_amount || 0,
            balance_due: getAmountOwed(balance)
          };
        });
        setLeases(formattedLeases);
      }
    } catch (err: any) {
      console.error('Error fetching leases:', err);
      if (!error) {
        setError('Failed to load leases');
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leases</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage leases for this property</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Lease
        </button>
      </div>

      {leases.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No leases yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create a lease to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
          >
            Create Lease
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resident</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {leases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {lease.unit_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {lease.resident_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lease.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {lease.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(lease.lease_start).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(lease.lease_end).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${lease.rent_amount.toLocaleString()}/mo
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {lease.balance_due > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          ${lease.balance_due.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">$0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedLeaseId(lease.id)}
                        className="text-havyn-primary dark:text-green-400 hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && propertyId && (
        <CreateLeaseModal
          propertyId={propertyId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchLeases();
            setShowCreateModal(false);
          }}
        />
      )}

      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => setSelectedLeaseId(null)}
          onUpdate={() => {
            fetchLeases();
          }}
        />
      )}
    </div>
  );
}

