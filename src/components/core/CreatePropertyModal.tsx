import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Spinner, Card, CardBody } from '../ui';

interface Property {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface CreatePropertyModalProps {
  property: Property | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePropertyModal({ property, onClose, onSuccess }: CreatePropertyModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: ''
  });

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name || '',
        address_line1: property.address_line1 || '',
        address_line2: property.address_line2 || '',
        city: property.city || '',
        state: property.state || '',
        zip_code: property.zip_code || ''
      });
    }
  }, [property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!formData.name.trim()) {
      setError('Property name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = {
        user_id: user.id,
        name: formData.name.trim(),
        address_line1: formData.address_line1.trim() || null,
        address_line2: formData.address_line2.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zip_code: formData.zip_code.trim() || null
      };

      if (property) {
        const { error: updateError } = await supabase
          .from('core_properties')
          .update(data)
          .eq('id', property.id);

        if (updateError) throw updateError;
      } else {
        const { data: newProperty, error: insertError } = await supabase
          .from('core_properties')
          .insert(data)
          .select()
          .single();

        if (insertError) throw insertError;
        
        // Redirect to property detail page after creation (only for new properties)
        if (newProperty) {
          onSuccess();
          onClose();
          setTimeout(() => {
            navigate(`/core/properties/${newProperty.id}/units`);
          }, 100);
          return;
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving property:', err);
      setError('Failed to save property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={property ? 'Edit Property' : 'Create Property'}
      size="md"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any);
            }}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                Saving...
              </>
            ) : (
              property ? 'Update' : 'Create'
            )}
          </Button>
        </div>
      }
    >
      <form id="property-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Card className="border-status-danger">
            <CardBody>
              <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm">{error}</p>
            </CardBody>
          </Card>
        )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Property Name *
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            />
          </div>

          <div>
            <label htmlFor="address_line1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address Line 1
            </label>
            <input
              id="address_line1"
              type="text"
              value={formData.address_line1}
              onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            />
          </div>

          <div>
            <label htmlFor="address_line2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address Line 2
            </label>
            <input
              id="address_line2"
              type="text"
              value={formData.address_line2}
              onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                City
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                State
              </label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ZIP Code
            </label>
            <input
              id="zip_code"
              type="text"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            />
          </div>

      </form>
    </Modal>
  );
}





