import React, { useEffect, useState } from 'react';
import { Plus, FileText, AlertCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateLeaseModal } from './CreateLeaseModal';
import { LeaseDetailModal } from './LeaseDetailModal';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, getLeaseStatusBadgeVariant } from '../ui';

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
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Leases"
        subtitle="Manage lease agreements and payments"
        actions={
          selectedProperty && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Lease
            </Button>
          )
        }
      />

      {properties.length > 1 && (
        <div className="flex gap-2">
          {properties.map((prop) => (
            <Button
              key={prop.id}
              variant={(propertyId || properties[0]?.id) === prop.id ? 'primary' : 'secondary'}
              onClick={() => {
                fetchLeases(prop.id);
                navigate(`/core/leases?property_id=${prop.id}`);
              }}
            >
              {prop.name}
            </Button>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-status-danger">
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Database Error</p>
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
                {error.includes('migration') && (
                  <p className="text-status-danger-text dark:text-status-danger-text-dark text-xs mt-2">
                    To fix: Run the migration file <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">supabase/migrations/20250102000000_create_core_pms_schema.sql</code> in your Supabase dashboard.
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {leases.length === 0 ? (
        <EmptyState
          message="No leases yet"
          description="Create your first lease to get started"
          icon={<FileText className="w-16 h-16 text-gray-400" />}
          action={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Lease
            </Button>
          }
        />
      ) : (
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
                  label: 'Lease Start',
                  render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(value).toLocaleDateString()}</span>
                },
                {
                  key: 'lease_end',
                  label: 'Lease End',
                  render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(value).toLocaleDateString()}</span>
                },
                {
                  key: 'rent_amount',
                  label: 'Rent',
                  render: (value) => <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">${value.toLocaleString()}</span>
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

