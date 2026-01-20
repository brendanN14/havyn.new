import React, { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseDetailModal } from './LeaseDetailModal';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, StatCard, getDelinquencyBadgeVariant } from '../ui';

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
    <div className="space-y-6 p-6">
      <PageHeader
        title="Financial Management"
        subtitle="Track delinquencies and manage payments"
        actions={
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
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <Spinner size="sm" className={refreshing ? '' : 'hidden'} />
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="border-status-danger">
          <CardBody>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0" />
              <div>
                <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Error</p>
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Summary Cards */}
      {delinquencies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Total Delinquent"
            value={`$${totalDelinquent.toLocaleString()}`}
            icon={<DollarSign className="w-12 h-12" />}
            valueColorClass="text-status-danger dark:text-status-danger-text-dark"
          />
          <StatCard
            label="Delinquent Accounts"
            value={delinquencies.length}
            icon={<AlertCircle className="w-12 h-12" />}
          />
          <StatCard
            label="Avg Days Past Due"
            value={avgDaysPastDue}
            icon={<Calendar className="w-12 h-12" />}
          />
        </div>
      )}

      {/* Delinquency Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'residentName',
                  label: 'Resident',
                  render: (value) => <span className="font-medium text-gray-900 dark:text-white">{value}</span>
                },
                {
                  key: 'unitCode',
                  label: 'Unit',
                  render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
                },
                {
                  key: 'balance',
                  label: 'Balance',
                  className: 'text-right',
                  render: (value) => (
                    <span className="text-sm font-medium text-status-danger dark:text-status-danger-text-dark tabular-nums">
                      ${value.toLocaleString()}
                    </span>
                  )
                },
                {
                  key: 'daysPastDue',
                  label: 'Days Past Due',
                  render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value} days</span>
                },
                {
                  key: 'category',
                  label: 'Category',
                  render: (value) => <Badge variant={getDelinquencyBadgeVariant(value)}>{String(value).replace('_', ' ')}</Badge>
                },
                {
                  key: 'lastPaymentAt',
                  label: 'Last Payment',
                  render: (value) => (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {value ? new Date(value).toLocaleDateString() : 'Never'}
                    </span>
                  )
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (_, row) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLeaseId(row.leaseId)}
                    >
                      View Lease
                    </Button>
                  )
                }
              ]}
              data={delinquencies}
              emptyMessage="No Delinquencies"
              emptyIcon={<TrendingUp className="w-16 h-16 text-gray-400" />}
              emptyDescription="All accounts are current. Great job!"
              stickyHeader
            />
          )}
        </CardBody>
      </Card>

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

