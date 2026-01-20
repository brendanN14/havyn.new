// Centralized activity logging utility for Core PMS
import { supabase } from '../lib/supabase';
import { ActivityEvent } from '../components/ui/ActivityTimeline';

export interface LogActivityParams {
  type: 'communication' | 'tour' | 'application' | 'note' | 'other';
  title: string;
  description?: string;
  channel?: 'email' | 'sms' | 'phone' | 'in_person' | 'note';
  direction?: 'inbound' | 'outbound';
  status?: string;
  // Context IDs (at least one required)
  leaseId?: string;
  leadId?: string;
  unitId?: string;
  residentId?: string;
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Centralized function to log activities across the system
 * Creates appropriate records in core_communication_logs, core_tours, core_applications
 * Returns an ActivityEvent for immediate UI display
 */
export async function logActivity(params: LogActivityParams): Promise<ActivityEvent | null> {
  // Get user ID from Supabase auth directly (not from React hook)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId || authError) {
    console.error('[ActivityLogging] No user ID available:', authError);
    return null;
  }

  const timestamp = new Date().toISOString();

  try {
    switch (params.type) {
      case 'communication': {
        if (!params.leaseId) {
          console.error('[ActivityLogging] Communication requires leaseId');
          return null;
        }

        const { data, error } = await supabase
          .from('core_communication_logs')
          .insert({
            lease_id: params.leaseId,
            direction: params.direction || 'outbound',
            channel: params.channel || 'note',
            subject: params.title,
            message: params.description || params.title,
            status: params.status || 'sent',
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: data.id,
          type: 'communication',
          title: params.title,
          description: params.description,
          timestamp: data.created_at,
          channel: params.channel,
          direction: params.direction,
          status: params.status,
          created_by: userId,
        };
      }

      case 'tour': {
        if (!params.leadId) {
          console.error('[ActivityLogging] Tour requires leadId');
          return null;
        }

        const { data, error } = await supabase
          .from('core_tours')
          .insert({
            lead_id: params.leadId,
            unit_id: params.unitId || null,
            scheduled_at: params.metadata?.scheduled_at || timestamp,
            completed_at: params.status === 'completed' ? timestamp : null,
            status: params.status || 'scheduled',
            notes: params.description,
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: data.id,
          type: 'tour',
          title: params.title,
          description: params.description,
          timestamp: data.created_at,
          status: params.status || 'scheduled',
          created_by: userId,
        };
      }

      case 'application': {
        if (!params.leadId) {
          console.error('[ActivityLogging] Application requires leadId');
          return null;
        }

        const { data, error } = await supabase
          .from('core_applications')
          .insert({
            lead_id: params.leadId,
            unit_id: params.unitId || null,
            status: params.status || 'pending',
            submitted_at: timestamp,
            reviewed_at: params.status === 'approved' || params.status === 'rejected' ? timestamp : null,
            income_amount: params.metadata?.income_amount || null,
            credit_score: params.metadata?.credit_score || null,
            notes: params.description,
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: data.id,
          type: 'application',
          title: params.title,
          description: params.description,
          timestamp: data.created_at,
          status: params.status || 'pending',
          created_by: userId,
        };
      }

      case 'note':
      case 'other': {
        // For notes/other, we log to core_communication_logs with channel='note'
        if (params.leaseId) {
          const { data, error } = await supabase
            .from('core_communication_logs')
            .insert({
              lease_id: params.leaseId,
              direction: 'outbound',
              channel: 'note',
              message: params.description || params.title,
              status: 'sent',
              created_by: userId,
            })
            .select()
            .single();

          if (error) throw error;

          return {
            id: data.id,
            type: params.type,
            title: params.title,
            description: params.description,
            timestamp: data.created_at,
            channel: 'note',
            created_by: userId,
          };
        }
        // If no leaseId, we can't log to communication_logs
        // Return a client-side event for UI display only
        return {
          id: `temp-${Date.now()}`,
          type: params.type,
          title: params.title,
          description: params.description,
          timestamp,
          created_by: userId,
        };
      }

      default:
        console.warn('[ActivityLogging] Unknown activity type:', params.type);
        return null;
    }
  } catch (error: any) {
    console.error('[ActivityLogging] Error logging activity:', error);
    // Return a client-side event even if DB write fails
    return {
      id: `error-${Date.now()}`,
      type: params.type,
      title: params.title,
      description: params.description,
      timestamp,
      created_by: userId,
    };
  }
}

/**
 * Fetch activities for a given context (lease, lead, unit, resident)
 */
export async function fetchActivities(params: {
  leaseId?: string;
  leadId?: string;
  unitId?: string;
  residentId?: string;
}): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];

  try {
    // Fetch communications (for leases)
    if (params.leaseId) {
      const { data: comms } = await supabase
        .from('core_communication_logs')
        .select('*')
        .eq('lease_id', params.leaseId)
        .order('created_at', { ascending: false });

      if (comms) {
        comms.forEach(comm => {
          events.push({
            id: comm.id,
            type: 'communication',
            title: comm.subject || 'Communication',
            description: comm.message,
            timestamp: comm.created_at,
            channel: comm.channel as any,
            direction: comm.direction as any,
            status: comm.status || undefined,
            created_by: comm.created_by || undefined,
          });
        });
      }
    }

    // Fetch tours (for leads)
    if (params.leadId) {
      const { data: tours } = await supabase
        .from('core_tours')
        .select('*')
        .eq('lead_id', params.leadId)
        .order('created_at', { ascending: false });

      if (tours) {
        tours.forEach(tour => {
          events.push({
            id: tour.id,
            type: 'tour',
            title: `Tour ${tour.status === 'completed' ? 'completed' : 'scheduled'}`,
            description: tour.notes || `Tour scheduled for ${new Date(tour.scheduled_at).toLocaleString()}`,
            timestamp: tour.created_at,
            status: tour.status,
            created_by: tour.created_by || undefined,
          });
        });
      }

      // Fetch applications (for leads)
      const { data: apps } = await supabase
        .from('core_applications')
        .select('*')
        .eq('lead_id', params.leadId)
        .order('created_at', { ascending: false });

      if (apps) {
        apps.forEach(app => {
          events.push({
            id: app.id,
            type: 'application',
            title: `Application ${app.status}`,
            description: app.notes || `Application submitted`,
            timestamp: app.created_at,
            status: app.status,
            created_by: app.created_by || undefined,
          });
        });
      }
    }

    // For unit/resident, we'd need to join through leases/leads
    // This is a simplified version - can be expanded

    return events;
  } catch (error: any) {
    console.error('[ActivityLogging] Error fetching activities:', error);
    return events;
  }
}

