import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateLeaseModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateLeaseModal({ propertyId, onClose, onSuccess }: CreateLeaseModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    unit_id: '',
    resident_id: '',
    resident_name: '',
    resident_email: '',
    resident_phone: '',
    lease_start: '',
    lease_end: '',
    rent_amount: '',
    deposit_amount: '0',
    status: 'active'
  });

  useEffect(() => {
    fetchUnits();
    fetchResidents();
  }, [propertyId]);

  const fetchUnits = async () => {
    const { data } = await supabase
      .from('core_units')
      .select('id, unit_code')
      .eq('property_id', propertyId)
      .order('unit_code');
    setUnits(data || []);
  };

  const fetchResidents = async () => {
    const { data } = await supabase
      .from('core_residents')
      .select('id, full_name, email, phone')
      .eq('property_id', propertyId)
      .order('full_name');
    setResidents(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      let residentId = formData.resident_id;

      // Create resident if new
      if (!residentId && formData.resident_name) {
        const { data: newResident, error: residentError } = await supabase
          .from('core_residents')
          .insert({
            property_id: propertyId,
            full_name: formData.resident_name,
            email: formData.resident_email || null,
            phone: formData.resident_phone || null,
            status: 'active'
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
          status: formData.status,
          lease_start: formData.lease_start,
          lease_end: formData.lease_end,
          move_in_date: formData.lease_start,
          rent_amount: parseFloat(formData.rent_amount),
          deposit_amount: parseFloat(formData.deposit_amount) || 0
        })
        .select()
        .single();

      if (leaseError) throw leaseError;

      // Create ledger account
      await supabase
        .from('core_ledger_accounts')
        .insert({
          lease_id: lease.id,
          current_balance: 0,
          days_past_due: 0
        });

      // Update unit status to occupied
      await supabase
        .from('core_units')
        .update({ status: 'occupied' })
        .eq('id', formData.unit_id);

      onSuccess();
    } catch (err: any) {
      console.error('Error creating lease:', err);
      setError(err.message || 'Failed to create lease');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Lease</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit *
            </label>
            <select
              required
              value={formData.unit_id}
              onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Unit</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.unit_code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resident
            </label>
            <select
              value={formData.resident_id}
              onChange={(e) => {
                const resident = residents.find(r => r.id === e.target.value);
                setFormData({
                  ...formData,
                  resident_id: e.target.value,
                  resident_name: resident?.full_name || '',
                  resident_email: resident?.email || '',
                  resident_phone: resident?.phone || ''
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
            >
              <option value="">Select Existing Resident</option>
              {residents.map(res => (
                <option key={res.id} value={res.id}>{res.full_name}</option>
              ))}
            </select>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Or create new:</div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Name *"
                required={!formData.resident_id}
                value={formData.resident_name}
                onChange={(e) => setFormData({ ...formData, resident_name: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.resident_email}
                onChange={(e) => setFormData({ ...formData, resident_email: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.resident_phone}
                onChange={(e) => setFormData({ ...formData, resident_phone: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lease Start *
              </label>
              <input
                type="date"
                required
                value={formData.lease_start}
                onChange={(e) => setFormData({ ...formData, lease_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lease End *
              </label>
              <input
                type="date"
                required
                value={formData.lease_end}
                onChange={(e) => setFormData({ ...formData, lease_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Monthly Rent *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.rent_amount}
                onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Security Deposit
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-havyn-primary text-white rounded-md hover:bg-havyn-dark disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Lease'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


