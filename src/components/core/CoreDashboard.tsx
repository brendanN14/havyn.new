import React, { useEffect, useState } from 'react';
import { Building2, Home, Users, TrendingUp, AlertCircle, Loader2, Calendar, Eye, EyeOff, Plus, DollarSign, FileText, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseDetailModal } from './LeaseDetailModal';
import { getAmountOwed, isLeaseDelinquent } from '../../utils/financialSummary';

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
  property_id: string;
}

interface DelinquencyQueueItem {
  leaseId: string;
  residentName: string;
  unitCode: string;
  balance: number;
  daysPastDue: number;
  category: string;
}

interface ExpiringLease {
  leaseId: string;
  residentName: string;
  unitCode: string;
  leaseEnd: string;
  daysUntilExpiry: number;
}

interface VacantUnit {
  unitId: string;
  unitCode: string;
  status: string;
  availableDate: string | null;
  propertyName: string;
}

export function CoreDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const [stats, setStats] = useState({
    totalUnits: 0,
    vacantUnits: 0,
    occupiedUnits: 0,
    activeLeases: 0,
    totalBalanceDue: 0
  });
  const [delinquencyQueue, setDelinquencyQueue] = useState<DelinquencyQueueItem[]>([]);
  const [expiringLeases, setExpiringLeases] = useState<ExpiringLease[]>([]);
  const [vacantUnits, setVacantUnits] = useState<VacantUnit[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
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
    if (selectedPropertyId || showAllProperties) {
      fetchStats();
      fetchTodaysQueue();
    }
  }, [selectedPropertyId, showAllProperties, user?.id]);

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
    if (!selectedPropertyId && !showAllProperties || !user?.id) return;

    try {
      // Build property filter
      let propertyIds = showAllProperties 
        ? (properties.map(p => p.id))
        : [selectedPropertyId!];

      // Total units
      const { count: totalUnits, error: unitsCountError } = await supabase
        .from('core_units')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds);

      if (unitsCountError) throw unitsCountError;

      // Units by status
      const { data: units, error: unitsError } = await supabase
        .from('core_units')
        .select('status')
        .in('property_id', propertyIds);

      if (unitsError) throw unitsError;

      const vacantUnits = units?.filter(u => u.status === 'vacant').length || 0;
      const occupiedUnits = units?.filter(u => u.status === 'occupied').length || 0;

      // Get unit IDs for property filter
      const { data: propertyUnits } = await supabase
        .from('core_units')
        .select('id')
        .in('property_id', propertyIds);

      const propertyUnitIds = new Set(propertyUnits?.map(u => u.id) || []);

      // Active leases
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select('id, unit_id')
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      const activeLeases = leases?.filter(l => propertyUnitIds.has(l.unit_id)).length || 0;

      // Total balance due (negative balance = money owed)
      const { data: propertyLeases } = await supabase
        .from('core_leases')
        .select('id')
        .in('unit_id', Array.from(propertyUnitIds));

      const propertyLeaseIds = new Set(propertyLeases?.map(l => l.id) || []);
      
      // Get ledger accounts for property leases
      const { data: ledgerAccounts, error: ledgerError } = await supabase
        .from('core_ledger_accounts')
        .select('current_balance, lease_id')
        .in('lease_id', Array.from(propertyLeaseIds));

      if (ledgerError) throw ledgerError;

      // Calculate total amount owed (convert negative balances to positive amounts)
      const totalBalanceDue = ledgerAccounts
        ?.filter(acc => propertyLeaseIds.has(acc.lease_id))
        .reduce((sum, acc) => {
          const balance = Number(acc.current_balance || 0);
          return sum + getAmountOwed(balance);
        }, 0) || 0;

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

  const fetchTodaysQueue = async () => {
    if ((!selectedPropertyId && !showAllProperties) || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Build property filter
      let propertyIds = showAllProperties 
        ? (properties.map(p => p.id))
        : [selectedPropertyId!];

      // Get units for selected properties
      const { data: propertyUnits, error: unitsError } = await supabase
        .from('core_units')
        .select('id, unit_code, property_id')
        .in('property_id', propertyIds);

      if (unitsError) throw unitsError;

      const propertyUnitIds = new Set(propertyUnits?.map(u => u.id) || []);
      const unitMap = new Map(propertyUnits?.map(u => [u.id, u]) || []);

      // Get property names
      const { data: propsData } = await supabase
        .from('core_properties')
        .select('id, name')
        .in('id', propertyIds);

      const propertyMap = new Map(propsData?.map(p => [p.id, p.name]) || []);

      // Fetch delinquency queue (balance > 0 means owed)
      await fetchDelinquencyQueue(Array.from(propertyUnitIds), unitMap);
      
      // Fetch expiring leases
      await fetchExpiringLeases(Array.from(propertyUnitIds), unitMap);
      
      // Fetch vacant/ready units
      await fetchVacantUnits(propertyIds, propertyMap);
      
    } catch (err: any) {
      console.error('[CoreDashboard] Error fetching today\'s queue:', err);
      if (err?.code === 'PGRST116' || err?.message?.includes('relation') || err?.message?.includes('does not exist')) {
        setError('Core PMS tables not found. Please run the database migration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDelinquencyQueue = async (propertyUnitIds: string[], unitMap: Map<string, any>) => {
    try {
      // Get leases for these units
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select('id, unit_id, primary_resident_id, status')
        .in('unit_id', propertyUnitIds)
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      if (!leases || leases.length === 0) {
        setDelinquencyQueue([]);
        return;
      }

      const leaseIds = leases.map(l => l.id);

      // Get ledger accounts (filter for negative balances = money owed)
      const { data: ledgerAccounts, error: ledgerError } = await supabase
        .from('core_ledger_accounts')
        .select('lease_id, current_balance, days_past_due')
        .in('lease_id', leaseIds)
        .lt('current_balance', 0); // Negative balance = money owed

      if (ledgerError) throw ledgerError;

      if (!ledgerAccounts || ledgerAccounts.length === 0) {
        setDelinquencyQueue([]);
        return;
      }

      // Get residents
      const residentIds = leases.map(l => l.primary_resident_id).filter(Boolean);
      const { data: residents, error: residentsError } = await supabase
        .from('core_residents')
        .select('id, full_name')
        .in('id', residentIds);

      if (residentsError) throw residentsError;

      // Get insights
      const { data: insights } = await supabase
        .from('core_tenant_insights')
        .select('lease_id, category')
        .in('lease_id', leaseIds);

      const residentMap = new Map(residents?.map(r => [r.id, r.full_name]) || []);
      const insightMap = new Map(insights?.map(i => [i.lease_id, i.category]) || []);
      const leaseMap = new Map(leases.map(l => [l.id, l]));

      // Build queue items, sorted worst-first (days_past_due desc, balance desc)
      const queue: DelinquencyQueueItem[] = ledgerAccounts
        .map(acc => {
          const lease = leaseMap.get(acc.lease_id);
          if (!lease) return null;

          const unit = unitMap.get(lease.unit_id);
          const residentName = residentMap.get(lease.primary_resident_id || '') || 'Unknown';

          const balance = Number(acc.current_balance || 0);
          return {
            leaseId: acc.lease_id,
            residentName,
            unitCode: unit?.unit_code || 'Unknown',
            balance: getAmountOwed(balance), // Convert to positive amount owed
            daysPastDue: acc.days_past_due || 0,
            category: insightMap.get(acc.lease_id) || 'unknown'
          };
        })
        .filter((item): item is DelinquencyQueueItem => item !== null)
        .sort((a, b) => {
          // Sort by days_past_due desc, then balance desc
          if (b.daysPastDue !== a.daysPastDue) {
            return b.daysPastDue - a.daysPastDue;
          }
          return b.balance - a.balance;
        });

      setDelinquencyQueue(queue);
    } catch (err: any) {
      console.error('[CoreDashboard] Error fetching delinquency queue:', err);
      setDelinquencyQueue([]);
    }
  };

  const fetchExpiringLeases = async (propertyUnitIds: string[], unitMap: Map<string, any>) => {
    try {
      const today = new Date();
      const days30 = new Date(today);
      days30.setDate(days30.getDate() + 30);
      const days60 = new Date(today);
      days60.setDate(days60.getDate() + 60);
      const days90 = new Date(today);
      days90.setDate(days90.getDate() + 90);

      // Get active leases expiring in next 90 days
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select('id, unit_id, primary_resident_id, lease_end, status')
        .in('unit_id', propertyUnitIds)
        .eq('status', 'active')
        .not('lease_end', 'is', null)
        .lte('lease_end', days90.toISOString().split('T')[0])
        .gte('lease_end', today.toISOString().split('T')[0]);

      if (leasesError) throw leasesError;

      if (!leases || leases.length === 0) {
        setExpiringLeases([]);
        return;
      }

      // Get residents
      const residentIds = leases.map(l => l.primary_resident_id).filter(Boolean);
      const { data: residents, error: residentsError } = await supabase
        .from('core_residents')
        .select('id, full_name')
        .in('id', residentIds);

      if (residentsError) throw residentsError;

      const residentMap = new Map(residents?.map(r => [r.id, r.full_name]) || []);
      const leaseMap = new Map(leases.map(l => [l.id, l]));

      // Calculate days until expiry and build list
      const expiring: ExpiringLease[] = leases
        .map(lease => {
          const unit = unitMap.get(lease.unit_id);
          const residentName = residentMap.get(lease.primary_resident_id || '') || 'Unknown';
          const endDate = new Date(lease.lease_end);
          const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          return {
            leaseId: lease.id,
            residentName,
            unitCode: unit?.unit_code || 'Unknown',
            leaseEnd: lease.lease_end,
            daysUntilExpiry
          };
        })
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry); // Sort by days ascending (closest first)

      setExpiringLeases(expiring);
    } catch (err: any) {
      console.error('[CoreDashboard] Error fetching expiring leases:', err);
      setExpiringLeases([]);
    }
  };

  const fetchVacantUnits = async (propertyIds: string[], propertyMap: Map<string, string>) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get vacant/ready/reserved units with available_date <= today and showable=true
      const { data: units, error: unitsError } = await supabase
        .from('core_units')
        .select('id, unit_code, status, available_date, showable, property_id')
        .in('property_id', propertyIds)
        .in('status', ['vacant', 'make-ready', 'reserved'])
        .eq('showable', true)
        .or(`available_date.is.null,available_date.lte.${today}`);

      if (unitsError) throw unitsError;

      if (!units || units.length === 0) {
        setVacantUnits([]);
        return;
      }

      const vacant: VacantUnit[] = units
        .map(unit => ({
          unitId: unit.id,
          unitCode: unit.unit_code,
          status: unit.status,
          availableDate: unit.available_date,
          propertyName: propertyMap.get(unit.property_id) || 'Unknown'
        }))
        .sort((a, b) => a.unitCode.localeCompare(b.unitCode));

      setVacantUnits(vacant);
    } catch (err: any) {
      console.error('[CoreDashboard] Error fetching vacant units:', err);
      setVacantUnits([]);
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

  if (loading && !selectedProperty && !showAllProperties && !error) {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Today's Queue</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Action items requiring attention</p>
        </div>
        <div className="flex items-center gap-3">
        {properties.length > 1 && (
            <div className="flex items-center gap-2">
          <select
                value={showAllProperties ? 'all' : (selectedPropertyId || '')}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setShowAllProperties(true);
                    setSelectedPropertyId(null);
                  } else {
                    setShowAllProperties(false);
                    setSelectedPropertyId(e.target.value);
                  }
                }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
                <option value="all">All Properties</option>
            {properties.map(prop => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
            </div>
        )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold">Database Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
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

          {/* Today's Queue Sections */}
          <div className="space-y-6">
            {/* Delinquency Needing Action */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Delinquency Needing Action</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{delinquencyQueue.length} account{delinquencyQueue.length !== 1 ? 's' : ''} past due</p>
                </div>
                {delinquencyQueue.length > 0 && (
              <button
                    onClick={() => navigate('/core/collections')}
                className="text-sm text-havyn-primary dark:text-green-400 hover:underline"
              >
                View All
              </button>
                )}
            </div>
            <div className="overflow-x-auto">
                {delinquencyQueue.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">All accounts are current</p>
                  </div>
                ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resident</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Days Past Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {delinquencyQueue.slice(0, 10).map((item) => (
                        <tr key={item.leaseId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {item.residentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {item.unitCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                          ${item.balance.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {item.daysPastDue} days
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setSelectedLeaseId(item.leaseId)}
                              className="px-3 py-1 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                            >
                              Open Lease
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Leases Expiring */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leases Expiring</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {expiringLeases.length} lease{expiringLeases.length !== 1 ? 's' : ''} expiring in next 90 days
                  </p>
                </div>
                {expiringLeases.length > 0 && (
                  <button
                    onClick={() => navigate('/core/leases')}
                    className="text-sm text-havyn-primary dark:text-green-400 hover:underline"
                  >
                    View All
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                {expiringLeases.length === 0 ? (
                  <div className="p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No leases expiring in the next 90 days</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Resident</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lease End</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Days Until Expiry</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {expiringLeases.map((lease) => {
                        const bucket = lease.daysUntilExpiry <= 30 ? '0-30' : lease.daysUntilExpiry <= 60 ? '31-60' : '61-90';
                        return (
                          <tr key={lease.leaseId}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {lease.residentName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {lease.unitCode}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(lease.leaseEnd).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                bucket === '0-30' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                                bucket === '31-60' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' :
                                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                              }`}>
                                {lease.daysUntilExpiry} days ({bucket})
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => setSelectedLeaseId(lease.leaseId)}
                                className="px-3 py-1 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                              >
                                Open Lease
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Vacant/Ready Units */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Vacant/Ready Units</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {vacantUnits.length} unit{vacantUnits.length !== 1 ? 's' : ''} available now
                  </p>
                </div>
                {vacantUnits.length > 0 && (
                  <button
                    onClick={() => navigate('/core/units')}
                    className="text-sm text-havyn-primary dark:text-green-400 hover:underline"
                  >
                    View All
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                {vacantUnits.length === 0 ? (
                  <div className="p-12 text-center">
                    <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No vacant units available</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Property</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Available Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {vacantUnits.map((unit) => (
                        <tr key={unit.unitId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {unit.unitCode}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {unit.propertyName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              unit.status === 'vacant' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                              unit.status === 'make-ready' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                              'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                            }`}>
                              {unit.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {unit.availableDate ? new Date(unit.availableDate).toLocaleDateString() : 'Now'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => navigate(`/core/units/${unit.unitId}`)}
                              className="px-3 py-1 bg-havyn-primary text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                            >
                              Open Unit
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Lease Detail Modal */}
      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => {
            setSelectedLeaseId(null);
            fetchTodaysQueue();
          }}
          onUpdate={() => {
            fetchTodaysQueue();
            fetchStats();
          }}
        />
      )}
    </div>
  );
}
