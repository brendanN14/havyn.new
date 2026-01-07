import React, { useEffect, useState } from 'react';
import { Plus, FileText, Loader2, AlertCircle, Calendar, DollarSign } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateLeaseModal } from './CreateLeaseModal';
import { LeaseDetailModal } from './LeaseDetailModal';

interface Property {
  id: string;
  name: string;
}

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

export function CoreLeasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('property_id');
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchProperties();
  }, [user?.id]);

  useEffect(() => {
    if (propertyId) {
      fetchLeases(propertyId);
    } else if (properties.length > 0) {
      fetchLeases(properties[0].id);
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
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')) {
          setError('Core PMS tables not found. Please run the database migration.');
        } else {
          throw fetchError;
        }
      } else {
        setProperties(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching properties:', err);
      if (!error) {
        setError('Failed to load properties');
      }
    }
  };

  const fetchLeases = async (propId: string) => {
    setLoading(true);
    setError(null);
    try {
      // First get units for this property
      const { data: propertyUnits, error: unitsError } = await supabase
        .from('core_units')
        .select('id')
        .eq('property_id', propId);

      if (unitsError) throw unitsError;

      const unitIds = propertyUnits?.map(u => u.id) || [];
      if (unitIds.length === 0) {
        setLeases([]);
        setLoading(false);
        return;
      }

      // Then get leases for those units
      const { data, error: fetchError } = await supabase
        .from('core_leases')
        .select('id, status, lease_start, lease_end, rent_amount, unit_id, primary_resident_id')
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
        // Simplified: fetch separately and join
        const leaseData = data || [];
        const unitIds = leaseData.map((l: any) => l.unit?.id).filter(Boolean);
        const residentIds = leaseData.map((l: any) => l.primary_resident?.id).filter(Boolean);
        const ledgerAccountIds = leaseData.map((l: any) => l.ledger_account?.id).filter(Boolean);

        // Fetch units
        const { data: units } = unitIds.length > 0 ? await supabase
          .from('core_units')
          .select('id, unit_code')
          .in('id', unitIds) : { data: [] };

        // Fetch residents
        const { data: residents } = residentIds.length > 0 ? await supabase
          .from('core_residents')
          .select('id, full_name')
          .in('id', residentIds) : { data: [] };

        // Fetch ledger accounts
        const { data: ledgerAccounts } = ledgerAccountIds.length > 0 ? await supabase
          .from('core_ledger_accounts')
          .select('id, current_balance')
          .in('id', ledgerAccountIds) : { data: [] };

        const unitMap = new Map(units?.map((u: any) => [u.id, u.unit_code]) || []);
        const residentMap = new Map(residents?.map((r: any) => [r.id, r.full_name]) || []);
        const ledgerMap = new Map(ledgerAccounts?.map((la: any) => [la.id, la.current_balance]) || []);

        const formattedLeases: Lease[] = leaseData.map((lease: any) => ({
          id: lease.id,
          unit_code: lease.unit?.id ? (unitMap.get(lease.unit.id) || 'Unknown') : 'Unknown',
          resident_name: lease.primary_resident?.id ? (residentMap.get(lease.primary_resident.id) || 'Unknown') : 'Unknown',
          status: lease.status,
          lease_start: lease.lease_start,
          lease_end: lease.lease_end,
          rent_amount: Number(lease.rent_amount) || 0,
          balance_due: lease.ledger_account?.id ? (Number(ledgerMap.get(lease.ledger_account.id)) || 0) : 0
        }));

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

  const selectedProperty = properties.find(p => p.id === (propertyId || properties[0]?.id));

  if (loading && !selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Leases</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage lease agreements and payments</p>
        </div>
        <div className="flex gap-3">
          {selectedProperty && (
            <>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Lease
              </button>
            </>
          )}
        </div>
      </div>

      {properties.length > 1 && (
        <div className="flex gap-2">
          {properties.map((prop) => (
            <button
              key={prop.id}
              onClick={() => {
                fetchLeases(prop.id);
                navigate(`/core/leases?property_id=${prop.id}`);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                (propertyId || properties[0]?.id) === prop.id
                  ? 'bg-havyn-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {prop.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold">Database Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
            {error.includes('migration') && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                To fix: Run the migration file <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">supabase/migrations/20250102000000_create_core_pms_schema.sql</code> in your Supabase dashboard.
              </p>
            )}
          </div>
        </div>
      )}

      {leases.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No leases yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first lease to get started
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lease Start</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lease End</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {leases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {lease.unit_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {lease.resident_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        lease.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        lease.status === 'expired' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' :
                        lease.status === 'terminated' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                        'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
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
                      ${lease.rent_amount.toLocaleString()}
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

      {showCreateModal && selectedProperty && (
        <CreateLeaseModal
          propertyId={selectedProperty.id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            if (selectedProperty) fetchLeases(selectedProperty.id);
            setShowCreateModal(false);
          }}
        />
      )}

      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => setSelectedLeaseId(null)}
          onUpdate={() => {
            if (selectedProperty) fetchLeases(selectedProperty.id);
          }}
        />
      )}
    </div>
  );
}

