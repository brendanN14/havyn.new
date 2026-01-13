import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Building2, Home, FileText, Users, DollarSign, ArrowLeft, Loader2, AlertCircle, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getAmountOwed } from '../../utils/financialSummary';

export function CorePropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [stats, setStats] = useState({
    totalUnits: 0,
    vacantUnits: 0,
    occupiedUnits: 0,
    activeLeases: 0,
    amountOwed: 0
  });

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/collections')) return 'collections';
    if (path.includes('/residents')) return 'residents';
    if (path.includes('/leases')) return 'leases';
    if (path.includes('/units')) return 'units';
    return 'units'; // default
  };

  const activeTab = getActiveTab();

  useEffect(() => {
    if (propertyId && user?.id) {
      fetchPropertyDetails();
      fetchStats();
    }
  }, [propertyId, user?.id]);

  const fetchPropertyDetails = async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('core_properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Property not found');
        } else {
          throw fetchError;
        }
      } else {
        setProperty(data);
      }
    } catch (err: any) {
      console.error('[CorePropertyDetailPage] Error fetching property:', err);
      setError(err?.message || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!propertyId) return;

    try {
      // Get units
      const { data: units, error: unitsError } = await supabase
        .from('core_units')
        .select('id, status')
        .eq('property_id', propertyId);

      if (unitsError) throw unitsError;

      const totalUnits = units?.length || 0;
      const vacantUnits = units?.filter(u => u.status === 'vacant').length || 0;
      const occupiedUnits = units?.filter(u => u.status === 'occupied').length || 0;

      // Get active leases
      const unitIds = units?.map(u => u.id) || [];
      const { data: leases, error: leasesError } = await supabase
        .from('core_leases')
        .select('id')
        .in('unit_id', unitIds)
        .eq('status', 'active');

      if (leasesError) throw leasesError;

      const activeLeases = leases?.length || 0;

      // Get amount owed
      const leaseIds = leases?.map(l => l.id) || [];
      let amountOwed = 0;

      if (leaseIds.length > 0) {
        const { data: ledgerAccounts, error: ledgerError } = await supabase
          .from('core_ledger_accounts')
          .select('current_balance')
          .in('lease_id', leaseIds);

        if (!ledgerError && ledgerAccounts) {
          amountOwed = ledgerAccounts.reduce((sum, acc) => {
            const balance = Number(acc.current_balance || 0);
            return sum + getAmountOwed(balance);
          }, 0);
        }
      }

      setStats({
        totalUnits,
        vacantUnits,
        occupiedUnits,
        activeLeases,
        amountOwed
      });
    } catch (err: any) {
      console.error('[CorePropertyDetailPage] Error fetching stats:', err);
    }
  };

  const handleTabClick = (tab: string) => {
    navigate(`/core/properties/${propertyId}/${tab}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold">Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error || 'Property not found'}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/core/properties')}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Properties
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'units', label: 'Units', icon: Home },
    { id: 'leases', label: 'Leases', icon: FileText },
    { id: 'residents', label: 'Residents', icon: Users },
    { id: 'collections', label: 'Collections', icon: DollarSign }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/core/properties')}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{property.name}</h1>
          {property.address_line1 && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {property.address_line1}
              {property.city && `, ${property.city}`}
              {property.state && ` ${property.state}`}
              {property.zip_code && ` ${property.zip_code}`}
            </p>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Units</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalUnits}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vacant</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.vacantUnits}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Occupied</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.occupiedUnits}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Leases</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.activeLeases}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount Owed</p>
          <p className={`text-2xl font-bold mt-1 ${stats.amountOwed > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            ${(stats.amountOwed / 1000).toFixed(1)}k
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${isActive
                      ? 'border-havyn-primary text-havyn-primary dark:text-emerald-400 dark:border-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

