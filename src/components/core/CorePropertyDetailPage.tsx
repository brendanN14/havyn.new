import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Building2, Home, FileText, Users, DollarSign, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getAmountOwed } from '../../utils/financialSummary';
import { PageHeader, Breadcrumb, Tabs, Tab, StatCard, Spinner, Card, CardBody } from '../ui';

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
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: 'Properties', onClick: () => navigate('/core/properties') },
            { label: error ? 'Error' : 'Property not found' }
          ]}
        />
        <Card className="border-status-danger">
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Error</p>
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error || 'Property not found'}</p>
              </div>
            </div>
          </CardBody>
        </Card>
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
      <Breadcrumb
        items={[
          { label: 'Properties', onClick: () => navigate('/core/properties') },
          { label: property.name }
        ]}
      />

      <PageHeader
        title={property.name}
        subtitle={
          property.address_line1
            ? `${property.address_line1}${property.city ? `, ${property.city}` : ''}${property.state ? ` ${property.state}` : ''}${property.zip_code ? ` ${property.zip_code}` : ''}`
            : undefined
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <StatCard
          label="Total Units"
          value={stats.totalUnits}
          icon={<Home className="w-12 h-12" />}
        />
        <StatCard
          label="Vacant"
          value={stats.vacantUnits}
          icon={<Building2 className="w-12 h-12" />}
        />
        <StatCard
          label="Occupied"
          value={stats.occupiedUnits}
          icon={<Users className="w-12 h-12" />}
        />
        <StatCard
          label="Active Leases"
          value={stats.activeLeases}
          icon={<FileText className="w-12 h-12" />}
        />
        <StatCard
          label="Amount Owed"
          value={`$${stats.amountOwed >= 1000 
            ? (stats.amountOwed / 1000).toFixed(1) + 'k'
            : stats.amountOwed.toLocaleString()}`}
          icon={<DollarSign className="w-12 h-12" />}
        />
      </div>

      {/* Tabs */}
      <Card>
        <div className="p-6 pb-0">
          <Tabs value={activeTab} onChange={handleTabClick}>
            <Tab value="units" label="Units" icon={<Home className="w-4 h-4" />} />
            <Tab value="leases" label="Leases" icon={<FileText className="w-4 h-4" />} />
            <Tab value="residents" label="Residents" icon={<Users className="w-4 h-4" />} />
            <Tab value="collections" label="Collections" icon={<DollarSign className="w-4 h-4" />} />
          </Tabs>
        </div>
        <CardBody>
          <Outlet />
        </CardBody>
      </Card>
    </div>
  );
}

