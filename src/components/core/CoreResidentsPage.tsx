import React, { useEffect, useState } from 'react';
import { Users, AlertCircle, DollarSign } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseDetailModal } from './LeaseDetailModal';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, getDelinquencyBadgeVariant, getLeaseStatusBadgeVariant } from '../ui';

interface Resident {
  id: string;
  leaseId: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  unit_code: string | null;
  lease_status: string | null;
  balance: number; // Can be negative (owed) or positive (credit)
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
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

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
          const balance = Number(ledgerMap.get(lease.id)) || 0;
          return {
            id: resident?.id || lease.primary_resident_id,
            leaseId: lease.id,
            full_name: resident?.full_name || 'Unknown',
            email: resident?.email || null,
            phone: resident?.phone || null,
            unit_code: unitMap.get(lease.unit_id) || null,
            lease_status: lease.status,
            balance: balance, // Store original balance (negative = owed, positive = credit)
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
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Residents"
        subtitle="View and manage resident information"
      />

      {properties.length > 1 && (
        <div className="flex gap-2">
          {properties.map((prop) => (
            <Button
              key={prop.id}
              variant={(propertyId || properties[0]?.id) === prop.id ? 'primary' : 'secondary'}
              onClick={() => {
                fetchResidents(prop.id);
                navigate(`/core/residents?property_id=${prop.id}`);
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
                render: (value) => {
                  if (value < 0) {
                    return (
                      <span className="text-sm font-medium text-status-danger dark:text-status-danger-text-dark tabular-nums">
                        ${Math.abs(value).toLocaleString()}
                      </span>
                    );
                  } else if (value > 0) {
                    return (
                      <span className="text-sm font-medium text-status-success dark:text-status-success-text-dark tabular-nums">
                        ${value.toLocaleString()} (credit)
                      </span>
                    );
                  }
                  return <span className="text-sm text-gray-600 dark:text-gray-400">$0</span>;
                }
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
            data={residents.map(r => ({
              ...r,
              contact: `${r.email || ''} ${r.phone || ''}`.trim()
            }))}
            emptyMessage="No residents yet"
            emptyIcon={<Users className="w-16 h-16 text-gray-400" />}
            stickyHeader
          />
        </CardBody>
      </Card>

      {residents.length === 0 && !loading && (
        <EmptyState
          message="No residents yet"
          description="Residents will appear here once you create leases"
          icon={<Users className="w-16 h-16 text-gray-400" />}
          action={
            <Button onClick={() => navigate('/core/leases')}>
              Create Lease
            </Button>
          }
        />
      )}

      {/* Lease Detail Modal */}
      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => {
            setSelectedLeaseId(null);
            // Refresh residents to get updated balances
            if (propertyId) {
              fetchResidents(propertyId);
            } else if (properties.length > 0) {
              fetchResidents(properties[0].id);
            }
          }}
          onUpdate={() => {
            // Refresh residents to get updated balances
            if (propertyId) {
              fetchResidents(propertyId);
            } else if (properties.length > 0) {
              fetchResidents(properties[0].id);
            }
          }}
        />
      )}
    </div>
  );
}

