import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Home, Edit, Trash2, Loader2, AlertCircle, Upload, Building2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BulkAddUnitsModal } from './BulkAddUnitsModal';
import { VacancyBoard } from './VacancyBoard';
import { checkInvalidUnitStatus, fixUnitAvailability } from '../../utils/integrityChecks';
import { Button, Card, CardBody, Badge, getUnitStatusBadgeVariant, PageHeader, Spinner, EmptyState } from '../ui';

interface Property {
  id: string;
  name: string;
}

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
  property: Property;
}

export function CoreUnitsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get('property_id');
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'vacancy'>('list');
  const [availabilityIssues, setAvailabilityIssues] = useState<any[]>([]);
  const [fixingAvailability, setFixingAvailability] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchProperties();
  }, [user?.id]);

  useEffect(() => {
    if (propertyId) {
      fetchUnits(propertyId);
    } else if (properties.length > 0) {
      fetchUnits(properties[0].id);
    }
  }, [propertyId, properties]);

  useEffect(() => {
    checkAvailabilityHealth();
  }, [units]);

  const checkAvailabilityHealth = async () => {
    const issues = await checkInvalidUnitStatus();
    setAvailabilityIssues(issues.filter(i => i.type === 'invalid_unit_status'));
  };

  const handleFixAvailability = async () => {
    setFixingAvailability(true);
    try {
      // Fix occupied units with showable=true
      const occupiedIssues = availabilityIssues.filter(i => 
        i.description.includes('occupied but showable=true')
      );
      for (const issue of occupiedIssues) {
        if (issue.unitId) {
          await supabase
            .from('core_units')
            .update({ showable: false })
            .eq('id', issue.unitId);
        }
      }

      // Fix vacant/ready units without available_date
      const dateIssues = availabilityIssues.filter(i => 
        i.description.includes('missing available_date')
      );
      const today = new Date().toISOString().split('T')[0];
      for (const issue of dateIssues) {
        if (issue.unitId) {
          await supabase
            .from('core_units')
            .update({ available_date: today })
            .eq('id', issue.unitId);
        }
      }

      // Refresh
      if (propertyId) {
        fetchUnits(propertyId);
      } else if (properties.length > 0) {
        fetchUnits(properties[0].id);
      }
    } catch (err) {
      console.error('Error fixing availability:', err);
    } finally {
      setFixingAvailability(false);
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

  const fetchUnits = async (propId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('core_units')
        .select(`
          *,
          property:core_properties!inner(id, name),
          leases:core_leases(
            status,
            primary_resident:core_residents(full_name)
          )
        `)
        .eq('property_id', propId)
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
      if (propertyId) fetchUnits(propertyId);
    } catch (err) {
      console.error('Error deleting unit:', err);
      alert('Failed to delete unit');
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
        title="Units"
        subtitle="Manage units and vacancy status"
        actions={
          selectedProperty && (
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
          )
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          message="No properties yet"
          description="Create a property first before adding units"
          icon={<Building2 className="w-16 h-16 text-gray-400" />}
        />
      ) : (
        <>
          <div className="flex gap-2">
            {properties.map((prop) => (
              <Button
                key={prop.id}
                variant={(propertyId || properties[0]?.id) === prop.id ? 'primary' : 'secondary'}
                onClick={() => {
                  fetchUnits(prop.id);
                  window.history.pushState({}, '', `/core/units?property_id=${prop.id}`);
                }}
              >
                {prop.name}
              </Button>
            ))}
          </div>

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

          {/* Availability Health Check Banner */}
          {availabilityIssues.length > 0 && (
            <Card className="border-status-warning dark:border-status-warning">
              <CardBody>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-status-warning dark:text-status-warning-text-dark flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-status-warning-text dark:text-status-warning-text-dark font-semibold mb-1">
                      Unit Availability Issues Found
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {availabilityIssues.length} unit{availabilityIssues.length !== 1 ? 's' : ''} have invalid status combinations:
                    </p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside mb-3 space-y-1">
                      {availabilityIssues.slice(0, 3).map((issue, idx) => (
                        <li key={idx}>{issue.description}</li>
                      ))}
                      {availabilityIssues.length > 3 && (
                        <li>...and {availabilityIssues.length - 3} more</li>
                      )}
                    </ul>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleFixAvailability}
                      disabled={fixingAvailability}
                    >
                      {fixingAvailability ? (
                        <>
                          <Spinner size="sm" />
                          Fixing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Fix Automatically
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {viewMode === 'vacancy' ? (
            <VacancyBoard
              units={units}
              property={selectedProperty!}
              onUpdate={() => selectedProperty && fetchUnits(selectedProperty.id)}
            />
          ) : (
            <>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {units.map((unit) => (
                    <div
                      key={unit.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/core/units/${unit.id}`)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Home className="w-5 h-5 text-havyn-primary dark:text-green-400" />
                          <h3 className="font-semibold text-gray-900 dark:text-white">{unit.unit_code}</h3>
                        </div>
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(unit.id);
                          }}
                          aria-label="Delete unit"
                          className="text-status-danger hover:text-status-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        {(unit.beds || unit.baths) && (
                          <p>
                            {unit.beds} bed{unit.beds !== 1 ? 's' : ''} / {unit.baths} bath{unit.baths !== 1 ? 's' : ''}
                          </p>
                        )}
                        {unit.sqft && <p>{unit.sqft.toLocaleString()} sqft</p>}
                        {unit.asking_rent && (
                          <p className="font-medium">${unit.asking_rent.toLocaleString()}/mo</p>
                        )}
                        {unit.status === 'occupied' && unit.leases && unit.leases.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Occupied by: {unit.leases.find((l: any) => l.status === 'active')?.primary_resident?.full_name || 'Unknown'}
                          </p>
                        )}
                        <Badge variant={getUnitStatusBadgeVariant(unit.status)}>
                          {unit.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {showBulkAdd && selectedProperty && (
        <BulkAddUnitsModal
          propertyId={selectedProperty.id}
          onClose={() => setShowBulkAdd(false)}
          onSuccess={() => {
            if (selectedProperty) fetchUnits(selectedProperty.id);
            setShowBulkAdd(false);
          }}
        />
      )}
    </div>
  );
}

