import React, { useEffect, useState } from 'react';
import { Plus, Building2, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreatePropertyModal } from './CreatePropertyModal';

interface Property {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
}

export function CorePropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchProperties();
  }, [user?.id]);

  const fetchProperties = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('core_properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')) {
          setError('Core PMS tables not found. Please run the database migration: supabase/migrations/20250102000000_create_core_pms_schema.sql');
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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property? This will also delete all associated units, leases, and residents.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('core_properties')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchProperties();
    } catch (err) {
      console.error('Error deleting property:', err);
      alert('Failed to delete property');
    }
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Properties</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your property portfolio</p>
        </div>
        <button
          onClick={() => {
            setEditingProperty(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Property
        </button>
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

      {properties.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No properties yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first property to get started with Core PMS
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark transition-colors"
          >
            Create Property
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <div
              key={property.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <Building2 className="w-8 h-8 text-havyn-primary dark:text-green-400" />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingProperty(property);
                      setShowCreateModal(true);
                    }}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-havyn-primary dark:hover:text-green-400"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(property.id)}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {property.name}
              </h3>
              {(property.address_line1 || property.city || property.state) && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {[property.address_line1, property.city, property.state, property.zip_code]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreatePropertyModal
          property={editingProperty}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProperty(null);
          }}
          onSuccess={() => {
            fetchProperties();
            setShowCreateModal(false);
            setEditingProperty(null);
          }}
        />
      )}
    </div>
  );
}

