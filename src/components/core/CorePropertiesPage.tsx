import React, { useEffect, useState } from 'react';
import { Plus, Building2, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreatePropertyModal } from './CreatePropertyModal';
import { PageHeader, Card, CardBody, EmptyState, Spinner, Button, AnimatedContainer } from '../ui';

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
  const navigate = useNavigate();
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
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AnimatedContainer animation="fade-in-up" className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Manage your property portfolio"
        variant="gradient"
        actions={
          <Button
            onClick={() => {
              setEditingProperty(null);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Create Property
          </Button>
        }
      />

      {error && (
        <Card className="border-status-danger">
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Database Error</p>
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error}</p>
                {error.includes('migration') && (
                  <p className="text-status-danger-text dark:text-status-danger-text-dark text-xs mt-2">
                    To fix: Run the migration file <code className="bg-status-danger-bg dark:bg-status-danger-bg-dark px-1 rounded">supabase/migrations/20250102000000_create_core_pms_schema.sql</code> in your Supabase dashboard.
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {properties.length === 0 ? (
        <EmptyState
          message="No properties yet"
          description="Create your first property to get started with Core PMS"
          icon={<Building2 className="w-16 h-16 text-gray-400" />}
          action={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Property
            </Button>
          }
        />
      ) : (
        <AnimatedContainer animation="fade-in-up" stagger={true} staggerDelay={100}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <Card
                key={property.id}
                variant="glass"
                hover
                onClick={() => navigate(`/core/properties/${property.id}/units`)}
                className="cursor-pointer"
              >
              <CardBody>
                <div className="flex justify-between items-start mb-4">
                  <Building2 className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                  <div className="flex gap-2">
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProperty(property);
                        setShowCreateModal(true);
                      }}
                      aria-label="Edit property"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(property.id);
                      }}
                      aria-label="Delete property"
                      className="text-status-danger hover:text-status-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
              </CardBody>
            </Card>
            ))}
          </div>
        </AnimatedContainer>
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
    </AnimatedContainer>
  );
}

