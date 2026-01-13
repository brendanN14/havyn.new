import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Home, Edit, Trash2, Loader2, AlertCircle, Upload, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BulkAddUnitsModal } from './BulkAddUnitsModal';
import { VacancyBoard } from './VacancyBoard';

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
        <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Units</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage units and vacancy status</p>
        </div>
        <div className="flex gap-3">
          {selectedProperty && (
            <>
              <button
                onClick={() => setViewMode(viewMode === 'list' ? 'vacancy' : 'list')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {viewMode === 'list' ? 'Vacancy Board' : 'List View'}
              </button>
              <button
                onClick={() => setShowBulkAdd(true)}
                className="flex items-center gap-2 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
              >
                <Upload className="w-5 h-5" />
                Bulk Add Units
              </button>
            </>
          )}
        </div>
      </div>

      {properties.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No properties yet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create a property first before adding units
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {properties.map((prop) => (
              <button
                key={prop.id}
                onClick={() => {
                  fetchUnits(prop.id);
                  window.history.pushState({}, '', `/core/units?property_id=${prop.id}`);
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  (propertyId || properties[0]?.id) === prop.id
                    ? 'bg-havyn-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {prop.name}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="text-red-800 dark:text-red-200 font-semibold">Database Error</p>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                {error.includes('migration') && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-2">
                    To fix: Run the migration file <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">supabase/migrations/20250102000000_create_core_pms_schema.sql</code> in your Supabase dashboard.
                  </p>
                )}
              </div>
            </div>
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
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
                  <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No units yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Add units to this property to get started
                  </p>
                  <button
                    onClick={() => setShowBulkAdd(true)}
                    className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
                  >
                    Add Units
                  </button>
                </div>
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(unit.id);
                          }}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                        <p className={`inline-block px-2 py-1 rounded text-xs ${
                          unit.status === 'occupied' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          unit.status === 'vacant' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                          unit.status === 'make-ready' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                          'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                        }`}>
                          {unit.status}
                        </p>
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

