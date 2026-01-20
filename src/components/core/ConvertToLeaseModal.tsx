import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Card, CardBody, Spinner } from '../ui';

interface ConvertToLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lead: {
    id: string;
    property_id: string;
    unit_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  application: {
    id: string;
    unit_id: string | null;
    income_amount: number | null;
    credit_score: number | null;
  };
}

export function ConvertToLeaseModal({
  isOpen,
  onClose,
  onSuccess,
  lead,
  application,
}: ConvertToLeaseModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    unit_id: application.unit_id || lead.unit_id || '',
    lease_start: '',
    lease_end: '',
    rent_amount: '',
    deposit_amount: '0',
  });

  useEffect(() => {
    if (isOpen) {
      fetchUnits();
      // Set default lease dates
      const today = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(today.getFullYear() + 1);
      setFormData(prev => ({
        ...prev,
        lease_start: today.toISOString().split('T')[0],
        lease_end: oneYearFromNow.toISOString().split('T')[0],
      }));
    }
  }, [isOpen, lead.property_id]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('core_units')
        .select('id, unit_code, asking_rent')
        .eq('property_id', lead.property_id)
        .order('unit_code');
      if (error) throw error;
      setUnits(data || []);
      // Pre-fill rent if unit has asking_rent
      if (data && data.length > 0 && !formData.rent_amount) {
        const selectedUnit = data.find(u => u.id === (application.unit_id || lead.unit_id));
        if (selectedUnit?.asking_rent) {
          setFormData(prev => ({ ...prev, rent_amount: selectedUnit.asking_rent.toString() }));
        }
      }
    } catch (err: any) {
      console.error('[ConvertToLeaseModal] Error fetching units:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !formData.unit_id || !formData.lease_start || !formData.lease_end || !formData.rent_amount) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if lease already exists (idempotency)
      const { data: existingLeases } = await supabase
        .from('core_leases')
        .select('id')
        .eq('unit_id', formData.unit_id)
        .eq('status', 'active')
        .single();

      if (existingLeases) {
        setError('An active lease already exists for this unit. Please select a different unit.');
        setLoading(false);
        return;
      }

      // Create or find resident
      let residentId: string;
      const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
      
      // Check if resident already exists
      const { data: existingResident } = await supabase
        .from('core_residents')
        .select('id')
        .eq('property_id', lead.property_id)
        .eq('email', lead.email || '')
        .single();

      if (existingResident) {
        residentId = existingResident.id;
      } else {
        // Create new resident
        const { data: newResident, error: residentError } = await supabase
          .from('core_residents')
          .insert({
            property_id: lead.property_id,
            full_name: fullName || 'Unknown',
            email: lead.email || null,
            phone: lead.phone || null,
            status: 'active',
          })
          .select()
          .single();

        if (residentError) throw residentError;
        residentId = newResident.id;
      }

      // Create lease
      const { data: lease, error: leaseError } = await supabase
        .from('core_leases')
        .insert({
          unit_id: formData.unit_id,
          primary_resident_id: residentId,
          status: 'active',
          lease_start: formData.lease_start,
          lease_end: formData.lease_end,
          move_in_date: formData.lease_start,
          rent_amount: parseFloat(formData.rent_amount),
          deposit_amount: parseFloat(formData.deposit_amount) || 0,
        })
        .select()
        .single();

      if (leaseError) throw leaseError;

      // Create ledger account
      const { error: ledgerError } = await supabase
        .from('core_ledger_accounts')
        .insert({
          lease_id: lease.id,
          current_balance: 0,
          days_past_due: 0,
        });

      if (ledgerError) throw ledgerError;

      // Update unit status
      const { error: unitError } = await supabase
        .from('core_units')
        .update({ 
          status: 'reserved',
          showable: false,
        })
        .eq('id', formData.unit_id);

      if (unitError) throw unitError;

      // Update lead stage
      const { error: leadError } = await supabase
        .from('core_leads')
        .update({ 
          stage: 'lease_signed',
          last_touch_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'note',
        title: 'Converted to lease',
        description: `Application approved and converted to lease for unit ${units.find(u => u.id === formData.unit_id)?.unit_code || formData.unit_id}`,
        leadId: lead.id,
        leaseId: lease.id,
        unitId: formData.unit_id,
        metadata: { applicationId: application.id, leaseId: lease.id },
      });

      onSuccess();
    } catch (err: any) {
      console.error('[ConvertToLeaseModal] Error converting to lease:', err);
      setError(err.message || 'Failed to convert to lease');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert to Lease"
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Create Lease'}
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
            Unit <span className="text-status-danger-text">*</span>
          </label>
          <select
            value={formData.unit_id}
            onChange={(e) => {
              setFormData({ ...formData, unit_id: e.target.value });
              // Update rent if unit has asking_rent
              const selectedUnit = units.find(u => u.id === e.target.value);
              if (selectedUnit?.asking_rent) {
                setFormData(prev => ({ ...prev, rent_amount: selectedUnit.asking_rent.toString() }));
              }
            }}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            required
          >
            <option value="">Select unit...</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_code} {unit.asking_rent ? `($${unit.asking_rent}/mo)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Lease Start <span className="text-status-danger-text">*</span>
          </label>
          <input
            type="date"
            value={formData.lease_start}
            onChange={(e) => setFormData({ ...formData, lease_start: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Lease End <span className="text-status-danger-text">*</span>
          </label>
          <input
            type="date"
            value={formData.lease_end}
            onChange={(e) => setFormData({ ...formData, lease_end: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Monthly Rent <span className="text-status-danger-text">*</span>
          </label>
          <input
            type="number"
            value={formData.rent_amount}
            onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="0.00"
            min="0"
            step="0.01"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Deposit
          </label>
          <input
            type="number"
            value={formData.deposit_amount}
            onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p><strong>Resident:</strong> {lead.first_name || ''} {lead.last_name || ''}</p>
          {lead.email && <p><strong>Email:</strong> {lead.email}</p>}
          {lead.phone && <p><strong>Phone:</strong> {lead.phone}</p>}
        </div>
      </form>
    </Modal>
  );
}



