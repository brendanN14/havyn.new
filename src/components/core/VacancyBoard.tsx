import React, { useState } from 'react';
import { Calendar, Eye, EyeOff, Plus, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Spinner } from '../ui';

interface Unit {
  id: string;
  unit_code: string;
  status: 'occupied' | 'vacant' | 'make-ready' | 'reserved';
  available_date: string | null;
  showable: boolean;
  asking_rent: number | null;
}

interface VacancyBoardProps {
  units: Unit[];
  property: { id: string; name: string };
  onUpdate: () => void;
}

export function VacancyBoard({ units, property, onUpdate }: VacancyBoardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const updateUnit = async (unitId: string, field: string, value: any) => {
    setUpdating(prev => new Set(prev).add(unitId));
    try {
      const { error } = await supabase
        .from('core_units')
        .update({ [field]: value })
        .eq('id', unitId);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error updating unit:', err);
      alert('Failed to update unit');
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev);
        newSet.delete(unitId);
        return newSet;
      });
    }
  };

  const handleCreateLead = async (unitId: string) => {
    if (!user?.id) {
      alert('You must be logged in to create a lead');
      return;
    }

    // Check if table exists before attempting insert
    try {
      const { checkAndCreateLeadsTable } = await import('../../utils/checkAndCreateTables');
      const tableCheck = await checkAndCreateLeadsTable();
      
      if (!tableCheck.exists) {
        alert(tableCheck.error || 'Required database tables are missing. Please run the migrations in Supabase SQL Editor:\nsupabase/migrations/20260109000001_create_core_leads.sql');
        return;
      }
    } catch (checkErr: any) {
      console.error('[VacancyBoard] Error checking tables:', checkErr);
    }

    try {
      // Auto-assign owner_user_id and set default next_action_at (now + 2 hours)
      const defaultNextAction = new Date();
      defaultNextAction.setHours(defaultNextAction.getHours() + 2);

      const { data, error } = await supabase
        .from('core_leads')
        .insert({
          property_id: property.id,
          unit_id: unitId,
          owner_user_id: user.id,
          stage: 'inquiry',
          next_action_at: defaultNextAction.toISOString(),
          last_touch_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // Check if it's a "does not exist" error
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          alert('The core_leads table does not exist. Please run the migration in Supabase SQL Editor:\nsupabase/migrations/20260109000001_create_core_leads.sql');
          return;
        }
        throw error;
      }

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'note',
        title: 'Lead created',
        description: 'New lead created from vacancy board',
        leadId: data.id,
      });

      // Navigate to lead detail
      navigate(`/core/leads/${data.id}`);
    } catch (err: any) {
      console.error('[VacancyBoard] Error creating lead:', err);
      alert('Failed to create lead: ' + (err.message || 'Unknown error'));
    }
  };

  const handleViewLeads = (unitId: string) => {
    navigate(`/core/leads?unit_id=${unitId}&property_id=${property.id}`);
  };

  const groupedUnits = {
    vacant: units.filter(u => u.status === 'vacant'),
    'make-ready': units.filter(u => u.status === 'make-ready'),
    reserved: units.filter(u => u.status === 'reserved'),
    occupied: units.filter(u => u.status === 'occupied')
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{property.name} - Vacancy Board</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {(['vacant', 'make-ready', 'reserved', 'occupied'] as const).map((status) => (
          <div key={status} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 capitalize">
              {status.replace('-', ' ')} ({groupedUnits[status].length})
            </h3>
            <div className="space-y-2">
              {groupedUnits[status].map((unit) => (
                <div
                  key={unit.id}
                  className={`border rounded-lg p-3 ${
                    status === 'vacant' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                    status === 'make-ready' ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20' :
                    status === 'reserved' ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20' :
                    'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{unit.unit_code}</div>
                      {unit.asking_rent && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          ${unit.asking_rent.toLocaleString()}/mo
                        </div>
                      )}
                    </div>
                    {updating.has(unit.id) && (
                      <Spinner size="sm" />
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        value={unit.available_date || ''}
                        onChange={(e) => updateUnit(unit.id, 'available_date', e.target.value || null)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateUnit(unit.id, 'showable', !unit.showable)}
                      className={`text-xs ${
                        unit.showable
                          ? 'text-status-success-text'
                          : 'text-muted-text'
                      }`}
                    >
                      {unit.showable ? (
                        <>
                          <Eye className="w-4 h-4" />
                          Showable
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Not Showable
                        </>
                      )}
                    </Button>
                    <select
                      value={unit.status}
                      onChange={(e) => updateUnit(unit.id, 'status', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="vacant">Vacant</option>
                      <option value="make-ready">Make Ready</option>
                      <option value="reserved">Reserved</option>
                      <option value="occupied">Occupied</option>
                    </select>
                    {(status === 'vacant' || status === 'make-ready') && (
                      <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCreateLead(unit.id)}
                          className="flex-1 text-xs"
                        >
                          <Plus className="w-3 h-3" />
                          Create Lead
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleViewLeads(unit.id)}
                          className="flex-1 text-xs"
                        >
                          <List className="w-3 h-3" />
                          View Leads
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {groupedUnits[status].length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No units
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}





