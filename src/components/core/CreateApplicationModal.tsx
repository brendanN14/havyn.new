import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Card, CardBody, Spinner } from '../ui';

interface CreateApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadId: string;
  unitId?: string;
  propertyId: string;
}

export function CreateApplicationModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  unitId,
  propertyId,
}: CreateApplicationModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    unit_id: unitId || '',
    income_amount: '',
    credit_score: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchUnits();
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
      console.error('[CreateApplicationModal] Error fetching units:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('core_applications')
        .insert({
          lead_id: leadId,
          unit_id: formData.unit_id || null,
          status: 'pending',
          income_amount: formData.income_amount ? parseFloat(formData.income_amount) : null,
          credit_score: formData.credit_score ? parseInt(formData.credit_score) : null,
          notes: formData.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'application',
        title: 'Application created',
        description: formData.notes || 'Application submitted',
        leadId,
        unitId: formData.unit_id || undefined,
        status: 'pending',
        metadata: { applicationId: data.id },
      });

      // Update lead stage if needed
      const { data: lead } = await supabase
        .from('core_leads')
        .select('stage')
        .eq('id', leadId)
        .single();

      if (lead && (lead.stage === 'inquiry' || lead.stage === 'tour_scheduled')) {
        await supabase
          .from('core_leads')
          .update({ stage: 'application', last_touch_at: new Date().toISOString() })
          .eq('id', leadId);
      }

      onSuccess();
    } catch (err: any) {
      console.error('[CreateApplicationModal] Error creating application:', err);
      setError(err.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Application"
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Create Application'}
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
            Monthly Income (optional)
          </label>
          <input
            type="number"
            value={formData.income_amount}
            onChange={(e) => setFormData({ ...formData, income_amount: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Credit Score (optional)
          </label>
          <input
            type="number"
            value={formData.credit_score}
            onChange={(e) => setFormData({ ...formData, credit_score: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="0"
            min="0"
            max="850"
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
            placeholder="Additional notes about the application..."
          />
        </div>
      </form>
    </Modal>
  );
}



