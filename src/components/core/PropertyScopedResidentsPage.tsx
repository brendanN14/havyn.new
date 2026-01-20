import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, AlertCircle, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseDetailModal } from './LeaseDetailModal';
import { getAmountOwed } from '../../utils/financialSummary';
import { Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, getDelinquencyBadgeVariant, getLeaseStatusBadgeVariant } from '../ui';

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
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-status-danger">
        <CardBody>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Error</p>
              <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
            </div>
          </div>
        </CardBody>
      </Card>
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

      <Card>
        <CardBody className="p-0">
          <DataTable
            columns={[
              {
                key: 'full_name',
                label: 'Name',
                render: (value) => <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              },
              {
                key: 'unit_code',
                label: 'Unit',
                render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value || '-'}</span>
              },
              {
                key: 'lease_status',
                label: 'Lease Status',
                render: (value) => <Badge variant={getLeaseStatusBadgeVariant(value || 'expired')}>{value || '-'}</Badge>
              },
              {
                key: 'balance',
                label: 'Balance Due',
                className: 'text-right',
                render: (value) => (
                  <span className={`text-sm font-medium tabular-nums ${
                    value > 0 
                      ? 'text-status-danger dark:text-status-danger-text-dark' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    ${value.toLocaleString()}
                  </span>
                )
              },
              {
                key: 'category',
                label: 'Category',
                render: (value) => value ? <Badge variant={getDelinquencyBadgeVariant(value)}>{String(value).replace('_', ' ')}</Badge> : '-'
              },
              {
                key: 'contact',
                label: 'Contact',
                render: (_, row) => (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>{row.email || '-'}</div>
                    <div className="text-xs">{row.phone || '-'}</div>
                  </div>
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
                    <DollarSign className="w-4 h-4" />
                    View Ledger
                  </Button>
                )
              }
            ]}
            data={residents}
            emptyMessage="No residents yet"
            emptyIcon={<Users className="w-16 h-16 text-gray-400" />}
            stickyHeader
          />
        </CardBody>
      </Card>

      {residents.length === 0 && !loading && (
        <EmptyState
          message="No residents yet"
          description="Residents will appear here once leases are created"
          icon={<Users className="w-16 h-16 text-gray-400" />}
        />
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

