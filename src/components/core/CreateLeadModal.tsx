import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Card, CardBody, Spinner } from '../ui';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId?: string;
  unitId?: string;
}

export function CreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
  propertyId,
  unitId,
}: CreateLeadModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    property_id: propertyId || '',
    unit_id: unitId || '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    source: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchProperties();
      if (formData.property_id) {
        fetchUnits(formData.property_id);
      }
    }
  }, [isOpen, user?.id]);

  const fetchProperties = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('core_properties')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      setProperties(data || []);
      if (data && data.length > 0 && !formData.property_id) {
        setFormData(prev => ({ ...prev, property_id: data[0].id }));
      }
    } catch (err: any) {
      console.error('[CreateLeadModal] Error fetching properties:', err);
    }
  };

  const fetchUnits = async (propId: string) => {
    try {
      const { data, error } = await supabase
        .from('core_units')
        .select('id, unit_code')
        .eq('property_id', propId)
        .order('unit_code');
      if (error) throw error;
      setUnits(data || []);
    } catch (err: any) {
      console.error('[CreateLeadModal] Error fetching units:', err);
    }
  };

  const handlePropertyChange = (propId: string) => {
    setFormData(prev => ({ ...prev, property_id: propId, unit_id: '' }));
    fetchUnits(propId);
  };

  const getFullName = () => {
    return `${formData.first_name || ''} ${formData.last_name || ''}`.trim();
  };

  const hasRequiredField = () => {
    return getFullName() || formData.email || formData.phone;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !formData.property_id) {
      setError('Please select a property');
      return;
    }

    if (!hasRequiredField()) {
      setError('Please provide at least one: name, email, or phone');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Auto-assign owner_user_id and set default next_action_at (now + 2 hours)
      const defaultNextAction = new Date();
      defaultNextAction.setHours(defaultNextAction.getHours() + 2);

      const { data, error } = await supabase
        .from('core_leads')
        .insert({
          property_id: formData.property_id,
          unit_id: formData.unit_id || null,
          owner_user_id: user.id,
          stage: 'inquiry',
          next_action_at: defaultNextAction.toISOString(),
          last_touch_at: new Date().toISOString(),
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          source: formData.source || null,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'note',
        title: 'Lead created',
        description: 'New lead created',
        leadId: data.id,
      });

      onSuccess();
      // Reset form
      setFormData({
        property_id: propertyId || '',
        unit_id: unitId || '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        source: '',
        notes: '',
      });
    } catch (err: any) {
      console.error('[CreateLeadModal] Error creating lead:', err);
      setError(err.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Lead"
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            disabled={loading || !hasRequiredField() || !formData.property_id}
          >
            {loading ? <Spinner size="sm" /> : 'Create Lead'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Card className="border-status-danger">
            <CardBody>
              <p className="text-status-danger-text text-sm">{error}</p>
            </CardBody>
          </Card>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
          At least one of: Name, Email, or Phone is required
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Property <span className="text-status-danger-text">*</span>
          </label>
          <select
            value={formData.property_id}
            onChange={(e) => handlePropertyChange(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            required
            disabled={!!propertyId}
          >
            <option value="">Select property...</option>
            {properties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Unit (optional)
          </label>
          <select
            value={formData.unit_id}
            onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            disabled={!formData.property_id || !!unitId}
          >
            <option value="">Select unit...</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_code}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Last Name
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              placeholder="Last name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Source (optional)
          </label>
          <select
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
          >
            <option value="">Select source...</option>
            <option value="Zillow">Zillow</option>
            <option value="Apartments.com">Apartments.com</option>
            <option value="Referral">Referral</option>
            <option value="Walk-in">Walk-in</option>
            <option value="Website">Website</option>
            <option value="Facebook">Facebook</option>
            <option value="Craigslist">Craigslist</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="Additional notes about the lead..."
          />
        </div>
      </form>
    </Modal>
  );
}



