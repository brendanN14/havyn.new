import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Card, CardBody, Spinner } from '../ui';

interface CreateTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadId: string;
  unitId?: string;
  propertyId: string;
}

export function CreateTourModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  unitId,
  propertyId,
}: CreateTourModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    unit_id: unitId || '',
    scheduled_at: '',
    scheduled_time: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchUnits();
      // Set default scheduled time to 2 hours from now
      const defaultDate = new Date();
      defaultDate.setHours(defaultDate.getHours() + 2);
      setFormData(prev => ({
        ...prev,
        scheduled_at: defaultDate.toISOString().split('T')[0],
        scheduled_time: defaultDate.toTimeString().slice(0, 5),
      }));
    }
  }, [isOpen, propertyId]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('core_units')
        .select('id, unit_code')
        .eq('property_id', propertyId)
        .order('unit_code');
      if (error) throw error;
      setUnits(data || []);
    } catch (err: any) {
      console.error('[CreateTourModal] Error fetching units:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !formData.scheduled_at) return;

    setLoading(true);
    setError(null);

    try {
      const scheduledAt = new Date(`${formData.scheduled_at}T${formData.scheduled_time || '12:00'}`).toISOString();

      const { data, error } = await supabase
        .from('core_tours')
        .insert({
          lead_id: leadId,
          unit_id: formData.unit_id || null,
          scheduled_at: scheduledAt,
          status: 'scheduled',
          notes: formData.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'tour',
        title: 'Tour scheduled',
        description: formData.notes || 'Tour scheduled',
        leadId,
        unitId: formData.unit_id || undefined,
        status: 'scheduled',
        metadata: { scheduled_at: scheduledAt, tourId: data.id },
      });

      // Update lead stage if needed
      const { data: lead } = await supabase
        .from('core_leads')
        .select('stage')
        .eq('id', leadId)
        .single();

      if (lead && lead.stage === 'inquiry') {
        await supabase
          .from('core_leads')
          .update({ stage: 'tour_scheduled', last_touch_at: new Date().toISOString() })
          .eq('id', leadId);
      }

      onSuccess();
    } catch (err: any) {
      console.error('[CreateTourModal] Error creating tour:', err);
      setError(err.message || 'Failed to create tour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Tour"
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1" disabled={loading || !formData.scheduled_at}>
            {loading ? <Spinner size="sm" /> : 'Schedule Tour'}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Unit (optional)
          </label>
          <select
            value={formData.unit_id}
            onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
          >
            <option value="">Select unit...</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Scheduled Date <span className="text-status-danger-text">*</span>
          </label>
          <input
            type="date"
            value={formData.scheduled_at}
            onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Scheduled Time
          </label>
          <input
            type="time"
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="Additional notes about the tour..."
          />
        </div>
      </form>
    </Modal>
  );
}



