import React, { useEffect, useState } from 'react';
import { Users, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Resident {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  unit_code: string | null;
  lease_status: string | null;
  balance_due: number;
  category: string | null;
}

export function CoreResidentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('property_id');
  
  const [properties, setProperties] = useState<any[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchProperties();
  }, [user?.id]);

  useEffect(() => {
    if (propertyId) {
      fetchResidents(propertyId);
    } else if (properties.length > 0) {
      fetchResidents(properties[0].id);
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

  const fetchResidents = async (propId: string) => {
    setLoading(true);
    setError(null);
    try {
      // First get residents for this property
      const { data: propertyResidents, error: residentsError } = await supabase
        .from('core_residents')
        .select('id')
        .eq('property_id', propId);

      if (residentsError) throw residentsError;

      const residentIds = propertyResidents?.map(r => r.id) || [];
      if (residentIds.length === 0) {
        setResidents([]);
        setLoading(false);
        return;
      }

      // Then get active leases for those residents
      const { data: leases, error: fetchError } = await supabase
        .from('core_leases')
        .select('id, status, unit_id, primary_resident_id')
        .in('primary_resident_id', residentIds)
        .eq('status', 'active');

      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')) {
          setError('Core PMS tables not found. Please run the database migration.');
          setResidents([]);
        } else {
          throw fetchError;
        }
      } else {
        const leaseData = leases || [];
        if (leaseData.length === 0) {
          setResidents([]);
          setLoading(false);
          return;
        }

        // Fetch related data separately
        const unitIds = leaseData.map((l: any) => l.unit_id).filter(Boolean);
        const leaseIds = leaseData.map((l: any) => l.id).filter(Boolean);
        const uniqueResidentIds = [...new Set(leaseData.map((l: any) => l.primary_resident_id).filter(Boolean))];

        const { data: units } = unitIds.length > 0 ? await supabase
          .from('core_units')
          .select('id, unit_code')
          .in('id', unitIds) : { data: [] };

        const { data: residents } = uniqueResidentIds.length > 0 ? await supabase
          .from('core_residents')
          .select('id, full_name, email, phone')
          .in('id', uniqueResidentIds) : { data: [] };

        const { data: ledgerAccounts } = leaseIds.length > 0 ? await supabase
          .from('core_ledger_accounts')
          .select('lease_id, current_balance')
          .in('lease_id', leaseIds) : { data: [] };

        const { data: insights } = leaseIds.length > 0 ? await supabase
          .from('core_tenant_insights')
          .select('lease_id, category')
          .in('lease_id', leaseIds) : { data: [] };

        const unitMap = new Map(units?.map((u: any) => [u.id, u.unit_code]) || []);
        const residentMap = new Map(residents?.map((r: any) => [r.id, r]) || []);
        const ledgerMap = new Map(ledgerAccounts?.map((la: any) => [la.lease_id, la.current_balance]) || []);
        const insightMap = new Map(insights?.map((i: any) => [i.lease_id, i.category]) || []);

        const formattedResidents: Resident[] = leaseData.map((lease: any) => {
          const resident = residentMap.get(lease.primary_resident_id);
          return {
            id: resident?.id || lease.primary_resident_id,
            full_name: resident?.full_name || 'Unknown',
            email: resident?.email || null,
            phone: resident?.phone || null,
            unit_code: unitMap.get(lease.unit_id) || null,
            lease_status: lease.status,
            balance_due: Number(ledgerMap.get(lease.id)) || 0,
            category: insightMap.get(lease.id) || null
          };
        });

        setResidents(formattedResidents);
      }
    } catch (err: any) {
      console.error('Error fetching residents:', err);
      if (!error) {
        setError('Failed to load residents');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Residents</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">View and manage resident information</p>
        </div>
      </div>

      {properties.length > 1 && (
        <div className="flex gap-2">
          {properties.map((prop) => (
            <button
              key={prop.id}
              onClick={() => {
                fetchResidents(prop.id);
                navigate(`/core/residents?property_id=${prop.id}`);
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

      {residents.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No residents yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Residents will appear here once you create leases
          </p>
          <button
            onClick={() => navigate('/core/leases')}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lease Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</th>
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
                      {resident.balance_due > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          ${resident.balance_due.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">$0</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

