import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BulkAddUnitsModal } from './BulkAddUnitsModal';
import { VacancyBoard } from './VacancyBoard';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, EmptyState, getUnitStatusBadgeVariant } from '../ui';

interface Unit {
  id: string;
  property_id: string;
  unit_code: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  asking_rent: number | null;
  status: 'occupied' | 'vacant' | 'make-ready' | 'reserved';
  available_date: string | null;
  showable: boolean;
  notes: string | null;
  leases?: any[];
}

export function PropertyScopedUnitsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'vacancy'>('list');

  useEffect(() => {
    if (propertyId && user?.id) {
      fetchUnits();
    }
  }, [propertyId, user?.id]);

  const fetchUnits = async () => {
    if (!propertyId) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('core_units')
        .select(`
          *,
          leases:core_leases(
            status,
            primary_resident:core_residents(full_name)
          )
        `)
        .eq('property_id', propertyId)
        .order('unit_code');

      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')) {
          setError('Core PMS tables not found. Please run the database migration.');
        } else {
          throw fetchError;
        }
      } else {
        setUnits(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching units:', err);
      if (!error) {
        setError('Failed to load units');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('core_units')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchUnits();
    } catch (err) {
      console.error('Error deleting unit:', err);
      alert('Failed to delete unit');
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
      <PageHeader
        title="Units"
        subtitle="Manage units for this property"
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setViewMode(viewMode === 'list' ? 'vacancy' : 'list')}
            >
              {viewMode === 'list' ? 'Vacancy Board' : 'List View'}
            </Button>
            <Button
              onClick={() => setShowBulkAdd(true)}
            >
              <Upload className="w-4 h-4" />
              Bulk Add Units
            </Button>
          </div>
        }
      />

      {units.length === 0 ? (
        <EmptyState
          message="No units yet"
          description="Add units to this property to get started"
          icon={<Home className="w-16 h-16 text-gray-400" />}
          action={
            <Button onClick={() => setShowBulkAdd(true)}>
              <Upload className="w-4 h-4" />
              Add Units
            </Button>
          }
        />
      ) : (
        <>
          {viewMode === 'vacancy' ? (
            <VacancyBoard
              units={units}
              property={{ id: propertyId!, name: '' }}
              onUpdate={fetchUnits}
            />
          ) : (
            <Card>
              <CardBody className="p-0">
                <DataTable
                  columns={[
                    {
                      key: 'unit',
                      label: 'Unit',
                      render: (_, row) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/core/units/${row.unitId}`)}
                          className="h-auto p-0 font-semibold"
                        >
                          {row.unit}
                        </Button>
                      )
                    },
                    {
                      key: 'details',
                      label: 'Details',
                      render: (_, row) => (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {row.beds && row.baths && (
                            <div>{row.beds} bed{row.beds !== 1 ? 's' : ''} / {row.baths} bath{row.baths !== 1 ? 's' : ''}</div>
                          )}
                          {row.sqft && <div>{row.sqft.toLocaleString()} sqft</div>}
                        </div>
                      )
                    },
                    {
                      key: 'rent',
                      label: 'Asking Rent',
                      className: 'text-right',
                      render: (value) => value ? <span className="text-sm font-medium text-gray-900 dark:text-white">${value}</span> : '-'
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (value) => <Badge variant={getUnitStatusBadgeVariant(value)}>{value}</Badge>
                    },
                    {
                      key: 'occupant',
                      label: 'Occupant',
                      render: (value) => value ? <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span> : '-'
                    },
                    {
                      key: 'availableDate',
                      label: 'Available Date',
                      render: (value) => value ? <span className="text-sm text-gray-600 dark:text-gray-400">{new Date(value).toLocaleDateString()}</span> : '-'
                    },
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (_, row) => (
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row.unitId);
                          }}
                          aria-label="Delete unit"
                          className="text-status-danger hover:text-status-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )
                    }
                  ]}
                  data={units.map(unit => ({
                    unit: unit.unit_code,
                    unitId: unit.id,
                    beds: unit.beds,
                    baths: unit.baths,
                    sqft: unit.sqft,
                    rent: unit.asking_rent ? unit.asking_rent.toLocaleString() + '/mo' : null,
                    status: unit.status,
                    occupant: unit.status === 'occupied' && unit.leases && unit.leases.length > 0
                      ? unit.leases.find((l: any) => l.status === 'active')?.primary_resident?.full_name || null
                      : null,
                    availableDate: unit.available_date
                  }))}
                  emptyMessage="No units found"
                />
              </CardBody>
            </Card>
          )}
        </>
      )}

      {showBulkAdd && propertyId && (
        <BulkAddUnitsModal
          propertyId={propertyId}
          onClose={() => setShowBulkAdd(false)}
          onSuccess={() => {
            fetchUnits();
            setShowBulkAdd(false);
          }}
        />
      )}
    </div>
  );
}

