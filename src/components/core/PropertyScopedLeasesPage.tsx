import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateLeaseModal } from './CreateLeaseModal';
import { LeaseDetailModal } from './LeaseDetailModal';
import { getAmountOwed } from '../../utils/financialSummary';
import { Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, getLeaseStatusBadgeVariant } from '../ui';

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leases</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage leases for this property</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          Create Lease
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          <DataTable
            columns={[
              {
                key: 'unit_code',
                label: 'Unit',
                render: (value) => <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              },
              {
                key: 'resident_name',
                label: 'Resident',
                render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
              },
              {
                key: 'status',
                label: 'Status',
                render: (value) => <Badge variant={getLeaseStatusBadgeVariant(value)}>{value}</Badge>
              },
              {
                key: 'lease_start',
                label: 'Start Date',
                render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(value).toLocaleDateString()}</span>
              },
              {
                key: 'lease_end',
                label: 'End Date',
                render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(value).toLocaleDateString()}</span>
              },
              {
                key: 'rent_amount',
                label: 'Rent',
                render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">${value.toLocaleString()}/mo</span>
              },
              {
                key: 'balance_due',
                label: 'Balance Due',
                className: 'text-right',
                render: (value) => (
                  <span className={`text-sm font-medium tabular-nums ${
                    value > 0 
                      ? 'text-status-danger dark:text-status-danger-text-dark' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    ${value.toLocaleString()}
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
                    onClick={() => setSelectedLeaseId(row.id)}
                  >
                    View Details
                  </Button>
                )
              }
            ]}
            data={leases}
            emptyMessage="No leases yet"
            emptyIcon={<FileText className="w-16 h-16 text-gray-400" />}
            stickyHeader
          />
        </CardBody>
      </Card>

      {leases.length === 0 && !loading && (
        <EmptyState
          message="No leases yet"
          description="Create a lease to get started"
          icon={<FileText className="w-16 h-16 text-gray-400" />}
          action={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Lease
            </Button>
          }
        />
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

