import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal, Button, Spinner, Card, CardBody } from '../ui';

interface BulkAddUnitsModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAddUnitsModal({ propertyId, onClose, onSuccess }: BulkAddUnitsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState('');
  const [defaultBeds, setDefaultBeds] = useState<number | ''>('');
  const [defaultBaths, setDefaultBaths] = useState<number | ''>('');
  const [defaultSqft, setDefaultSqft] = useState<number | ''>('');
  const [defaultRent, setDefaultRent] = useState<number | ''>('');

  const parseBulkInput = (input: string): string[] => {
    // Support comma-separated, newline-separated, or mixed
    return input
      .split(/[,\n]/)
      .map(line => line.trim())
      .filter(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      setError('Please enter at least one unit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unitCodes = parseBulkInput(bulkInput);
      
      if (unitCodes.length === 0) {
        setError('No valid unit codes found');
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const unitsToInsert = unitCodes.map(unitCode => ({
        property_id: propertyId,
        unit_code: unitCode,
        beds: defaultBeds || null,
        baths: defaultBaths || null,
        sqft: defaultSqft || null,
        asking_rent: defaultRent || null,
        status: 'vacant' as const,
        showable: true,
        available_date: today // Set available_date for vacant units
      }));

      const { error: insertError } = await supabase
        .from('core_units')
        .insert(unitsToInsert);

      if (insertError) {
        // Check if it's a duplicate key error
        if (insertError.code === '23505') {
          throw new Error('One or more unit codes already exist. Please check for duplicates.');
        }
        throw insertError;
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error adding units:', err);
      setError(err.message || 'Failed to add units');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Bulk Add Units"
      size="lg"
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
                Adding Units...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Add Units
              </>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Card className="border-status-danger">
            <CardBody>
              <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm">{error}</p>
            </CardBody>
          </Card>
        )}

          <div>
            <label htmlFor="bulkInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit Codes *
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Enter unit codes separated by commas or new lines (e.g., "101, 102, 103" or one per line)
            </p>
            <textarea
              id="bulkInput"
              required
              rows={8}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="101&#10;102&#10;103&#10;201&#10;202"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label htmlFor="defaultBeds" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Bedrooms
              </label>
              <input
                id="defaultBeds"
                type="number"
                min="0"
                value={defaultBeds}
                onChange={(e) => setDefaultBeds(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
            <div>
              <label htmlFor="defaultBaths" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Bathrooms
              </label>
              <input
                id="defaultBaths"
                type="number"
                step="0.5"
                min="0"
                value={defaultBaths}
                onChange={(e) => setDefaultBaths(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
            <div>
              <label htmlFor="defaultSqft" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Square Feet
              </label>
              <input
                id="defaultSqft"
                type="number"
                min="0"
                value={defaultSqft}
                onChange={(e) => setDefaultSqft(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
            <div>
              <label htmlFor="defaultRent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Asking Rent ($)
              </label>
              <input
                id="defaultRent"
                type="number"
                step="0.01"
                min="0"
                value={defaultRent}
                onChange={(e) => setDefaultRent(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
          </div>
      </form>
    </Modal>
  );
}





