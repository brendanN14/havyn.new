import React, { useEffect, useState } from 'react';
import { Building2, Home, Users, TrendingUp, AlertCircle, Loader2, Calendar, Eye, EyeOff, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unit_code: string;
  status: string;
  available_date: string | null;
  showable: boolean;
}

interface DelinquencyPreview {
  resident_name: string;
  unit_code: string;
  balance: number;
  days_past_due: number;
  category: string;
}

export function CoreDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalUnits: 0,
    vacantUnits: 0,
    occupiedUnits: 0,
    activeLeases: 0,
    totalBalanceDue: 0
  });
  const [vacancyPreview, setVacancyPreview] = useState<Unit[]>([]);
  const [delinquencyPreview, setDelinquencyPreview] = useState<DelinquencyPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check if user needs onboarding (no properties)
  useEffect(() => {
    if (!user?.id) {
      console.log('[CoreDashboard] No user ID, skipping onboarding check');
      return;
    }
    
    const checkOnboarding = async () => {
      console.log('[CoreDashboard] Checking onboarding for user:', user.id);
      
      try {
        const { count, error: countError } = await supabase
          .from('core_properties')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        console.log('[CoreDashboard] Properties count result:', { count, error: countError });

        if (countError) {
          // Log error with context
          console.error('[CoreDashboard] Error checking properties count:', {
            code: countError.code,
            message: countError.message,
            file: 'CoreDashboard.tsx',
            line: 'checkOnboarding'
          });
          
          if (countError.code === '42501' || countError.message?.includes('row-level security')) {
            setError(`Permission denied: ${countError.message}. Check RLS policies for core_properties table.`);
          }
          setCheckingOnboarding(false);
          return;
        }

        // If no properties, redirect to setup wizard
        if (count === 0) {
          console.log('[CoreDashboard] No properties found, redirecting to setup wizard');
          navigate('/core/setup', { replace: true });
          return;
        }

        console.log('[CoreDashboard] Found', count, 'properties, loading dashboard');
        setCheckingOnboarding(false);
        fetchProperties();
      } catch (err: any) {
        console.error('[CoreDashboard] Unexpected error in checkOnboarding:', err);
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [user?.id, navigate]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchStats();
      fetchVacancyPreview();
      fetchDelinquencyPreview();
    }
  }, [selectedPropertyId, user?.id]);

  const logError = (context: string, err: any) => {
    const errorInfo = {
      context,
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      file: 'CoreDashboard.tsx'
    };
    console.error(`[CoreDashboard] ${context}:`, errorInfo);
    
    if (err?.code === '42501' || err?.message?.includes('row-level security')) {
      setError(`Permission denied: ${err.message}. This is likely an RLS policy issue.`);
    } else if (err?.code === 'PGRST116' || err?.message?.includes('does not exist')) {
      setError(`Table not found: ${err.message}. Please ensure the Core PMS migration has been applied.`);
    } else {
      setError(err?.message || 'An unexpected error occurred');
    }
  };

  const fetchProperties = async () => {
    if (!user?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('core_properties')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) {
        logError('Fetching properties', fetchError);
        setLoading(false);
        return;
      }
      
      const props = data || [];
      setProperties(props);
      
      // Auto-select first property
      if (props.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(props[0].id);
      } else {
        // No properties or already selected - stop loading
        setLoading(false);
      }
    } catch (err: any) {
      logError('Fetching properties (catch)', err);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedPropertyId || !user?.id) return;

    try {
      // Total units - simplified query
      const { count: totalUnits, error: unitsCountError } = await supabase
        .from('core_units')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', selectedPropertyId);

      if (unitsCountError) throw unitsCountError;

      // Units by status - simplified query
      const { data: units, error: unitsError } = await supabase
        .from('core_units')
        .select('status')
        .eq('property_id', selectedPropertyId);

      if (unitsError) throw unitsError;

      const vacantUnits = units?.filter(u => u.status === 'vacant').length || 0;
      const occupiedUnits = units?.filter(u => u.status === 'occupied').length || 0;

      // Active leases - simplified query
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select('id, unit_id')
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      // Filter leases by property
      const { data: propertyUnits } = await supabase
        .from('core_units')
        .select('id')
        .eq('property_id', selectedPropertyId);

      const propertyUnitIds = new Set(propertyUnits?.map(u => u.id) || []);
      const activeLeases = leases?.filter(l => propertyUnitIds.has(l.unit_id)).length || 0;

      // Total balance due - simplified query
      const { data: ledgerAccounts, error: ledgerError } = await supabase
        .from('core_ledger_accounts')
        .select('current_balance, lease_id');

      if (ledgerError) throw ledgerError;

      // Get lease IDs for this property
      const { data: propertyLeases } = await supabase
        .from('core_leases')
        .select('id')
        .in('unit_id', propertyUnitIds);

      const propertyLeaseIds = new Set(propertyLeases?.map(l => l.id) || []);
      const totalBalanceDue = ledgerAccounts
        ?.filter(acc => propertyLeaseIds.has(acc.lease_id))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0) || 0;

      setStats({
        totalUnits: totalUnits || 0,
        vacantUnits,
        occupiedUnits,
        activeLeases,
        totalBalanceDue
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      if (err?.code === 'PGRST116' || err?.message?.includes('relation') || err?.message?.includes('does not exist')) {
        setError('Core PMS tables not found. Please run the database migration.');
      }
    }
  };

  const fetchVacancyPreview = async () => {
    if (!selectedPropertyId || !user?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('core_units')
        .select('id, unit_code, status, available_date, showable')
        .eq('property_id', selectedPropertyId)
        .order('unit_code')
        .limit(10);

      if (fetchError) throw fetchError;
      setVacancyPreview(data || []);
    } catch (err: any) {
      console.error('Error fetching vacancy preview:', err);
      if (err?.code === 'PGRST116' || err?.message?.includes('relation') || err?.message?.includes('does not exist')) {
        setError('Core PMS tables not found. Please run the database migration.');
      }
    }
  };

  const fetchDelinquencyPreview = async () => {
    if (!selectedPropertyId || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Simplified query - fetch separately and join in code
      const { data: ledgerAccounts, error: ledgerError } = await supabase
        .from('core_ledger_accounts')
        .select('current_balance, days_past_due, lease_id')
        .gt('current_balance', 0)
        .order('days_past_due', { ascending: false })
        .limit(20);

      if (ledgerError) {
        console.error('[CoreDashboard] Error fetching ledger accounts:', ledgerError);
        setDelinquencyPreview([]);
        setLoading(false);
        return;
      }

      if (!ledgerAccounts || ledgerAccounts.length === 0) {
        setDelinquencyPreview([]);
        setLoading(false);
        return;
      }

      // Get lease IDs
      const leaseIds = ledgerAccounts.map(acc => acc.lease_id);
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select('id, unit_id, primary_resident_id')
        .in('id', leaseIds);

      if (leasesError) throw leasesError;

      // Get unit IDs and filter by property
      const unitIds = leases?.map(l => l.unit_id) || [];
      const { data: units, error: unitsError } = await supabase
        .from('core_units')
        .select('id, unit_code, property_id')
        .in('id', unitIds)
        .eq('property_id', selectedPropertyId);

      if (unitsError) throw unitsError;

      const propertyUnitIds = new Set(units?.map(u => u.id) || []);
      const propertyLeases = leases?.filter(l => propertyUnitIds.has(l.unit_id)) || [];

      // Get resident IDs
      const residentIds = propertyLeases.map(l => l.primary_resident_id).filter(Boolean);
      const { data: residents, error: residentsError } = await supabase
        .from('core_residents')
        .select('id, full_name')
        .in('id', residentIds);

      if (residentsError) throw residentsError;

      // Get insights
      const propertyLeaseIds = propertyLeases.map(l => l.id);
      const { data: insights, error: insightsError } = await supabase
        .from('core_tenant_insights')
        .select('lease_id, category')
        .in('lease_id', propertyLeaseIds);

      if (insightsError && insightsError.code !== 'PGRST116') throw insightsError;

      // Build preview
      const residentMap = new Map(residents?.map(r => [r.id, r.full_name]) || []);
      const unitMap = new Map(units?.map(u => [u.id, u.unit_code]) || []);
      const insightMap = new Map(insights?.map(i => [i.lease_id, i.category]) || []);

      const preview: DelinquencyPreview[] = ledgerAccounts
        .filter(acc => {
          const lease = propertyLeases.find(l => l.id === acc.lease_id);
          return lease && propertyUnitIds.has(lease.unit_id);
        })
        .slice(0, 10)
        .map((acc) => {
          const lease = propertyLeases.find(l => l.id === acc.lease_id);
          return {
            resident_name: lease ? (residentMap.get(lease.primary_resident_id || '') || 'Unknown') : 'Unknown',
            unit_code: lease ? (unitMap.get(lease.unit_id) || 'Unknown') : 'Unknown',
            balance: Number(acc.current_balance) || 0,
            days_past_due: acc.days_past_due || 0,
            category: insightMap.get(acc.lease_id) || 'unknown'
          };
        });

      setDelinquencyPreview(preview);
    } catch (err: any) {
      console.error('Error fetching delinquency preview:', err);
      if (err?.code === 'PGRST116' || err?.message?.includes('relation') || err?.message?.includes('does not exist')) {
        setError('Core PMS tables not found. Please run the database migration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Show loading while checking onboarding status
  if (checkingOnboarding) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
      </div>
    );
  }

  if (loading && !selectedProperty && !error) {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Core PMS Dashboard</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Welcome to Havyn 2.0 - Property Management System</p>
        </div>
        {properties.length > 1 && (
          <select
            value={selectedPropertyId || ''}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {properties.map(prop => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold">Database Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-2">
              To fix: Run the migration file <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">supabase/migrations/20250102000000_create_core_pms_schema.sql</code> in your Supabase dashboard.
            </p>
          </div>
        </div>
      )}

      {properties.length === 0 && !error ? (
        <div className="bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-gray-800 dark:to-emerald-900/20 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-havyn-primary to-emerald-600 rounded-2xl shadow-lg mb-6">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to Core PMS</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Get started by creating your first property. You'll be able to add units, track leases, and manage residents.
          </p>
          <button
            onClick={() => navigate('/core/setup')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-havyn-primary text-white rounded-xl hover:bg-havyn-dark transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Your First Property
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Units</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.totalUnits}</p>
                </div>
                <Home className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vacant Units</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.vacantUnits}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Occupied Units</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.occupiedUnits}</p>
                </div>
                <Users className="w-12 h-12 text-purple-600 dark:text-purple-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Leases</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.activeLeases}</p>
                </div>
                <Calendar className="w-12 h-12 text-orange-600 dark:text-orange-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Balance Due</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    ${(stats.totalBalanceDue / 1000).toFixed(1)}k
                  </p>
                </div>
                <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Vacancy Board Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Vacancy Board Preview</h2>
              <button
                onClick={() => navigate('/core/units')}
                className="text-sm text-havyn-primary dark:text-green-400 hover:underline"
              >
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Available Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Showable</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {vacancyPreview.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No units found
                      </td>
                    </tr>
                  ) : (
                    vacancyPreview.map((unit) => (
                      <tr key={unit.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {unit.unit_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            unit.status === 'vacant' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                            unit.status === 'occupied' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' :
                            unit.status === 'make-ready' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                            'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          }`}>
                            {unit.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {unit.available_date ? new Date(unit.available_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {unit.showable ? (
                            <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delinquency Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Delinquency Preview</h2>
              <button
                onClick={() => navigate('/core/residents')}
                className="text-sm text-havyn-primary dark:text-green-400 hover:underline"
              >
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resident</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Days Past Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {delinquencyPreview.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No delinquencies found
                      </td>
                    </tr>
                  ) : (
                    delinquencyPreview.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {item.resident_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.unit_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                          ${item.balance.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.days_past_due} days
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.category === 'current' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                            item.category === 'at_risk' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                            item.category === 'delinquent' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                            'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}>
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
