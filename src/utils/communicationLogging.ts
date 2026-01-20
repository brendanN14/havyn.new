// Communication logging utilities for Core PMS
import { supabase } from '../lib/supabase';
import { logActivity } from './activityLogging';

export interface CommunicationLog {
  id: string;
  lease_id: string;
  direction: 'outbound' | 'inbound';
  channel: 'email' | 'sms' | 'phone' | 'in_person' | 'note';
  subject?: string;
  message: string;
  status: 'sent' | 'failed' | 'delivered' | 'read' | 'pending' | 'copied';
  recipient_email?: string;
  recipient_phone?: string;
  error_message?: string;
  created_by?: string;
  created_at: string;
}

/**
 * Log a communication for a lease
 * Always logs, even if the actual send fails (supports "copy message" + "mark sent" workflow)
 */
export async function logCommunication(params: {
  leaseId: string;
  direction: 'outbound' | 'inbound';
  channel: 'email' | 'sms' | 'phone' | 'in_person' | 'note';
  subject?: string;
  message: string;
  status: 'sent' | 'failed' | 'delivered' | 'read' | 'pending' | 'copied';
  recipientEmail?: string;
  recipientPhone?: string;
  errorMessage?: string;
  userId?: string;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('core_communication_logs')
      .insert({
        lease_id: params.leaseId,
        direction: params.direction,
        channel: params.channel,
        subject: params.subject || null,
        message: params.message,
        status: params.status,
        recipient_email: params.recipientEmail || null,
        recipient_phone: params.recipientPhone || null,
        error_message: params.errorMessage || null,
        created_by: params.userId || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('[communicationLogging] Error logging communication:', error);
      return { success: false, error: error.message };
    }

    return { success: true, logId: data.id };
  } catch (err: any) {
    console.error('[communicationLogging] Unexpected error logging communication:', err);
    return { success: false, error: err?.message || 'Failed to log communication' };
  }
}

/**
 * Update last contact timestamp on ledger account
 */
export async function updateLastContact(leaseId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get ledger account for this lease
    const { data: ledgerAccount, error: fetchError } = await supabase
      .from('core_ledger_accounts')
      .select('id')
      .eq('lease_id', leaseId)
      .single();

    if (fetchError || !ledgerAccount) {
      console.error('[communicationLogging] Error fetching ledger account:', fetchError);
      return { success: false, error: 'Ledger account not found' };
    }

    // Update last_contact_at
    const { error: updateError } = await supabase
      .from('core_ledger_accounts')
      .update({ last_contact_at: new Date().toISOString() })
      .eq('id', ledgerAccount.id);

    if (updateError) {
      console.error('[communicationLogging] Error updating last contact:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log activity
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await logActivity({
        type: 'note',
        title: 'Marked as contacted',
        description: 'Last contact date updated',
        leaseId,
      }, user?.id);
    } catch (err) {
      console.error('[communicationLogging] Error logging activity:', err);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[communicationLogging] Unexpected error updating last contact:', err);
    return { success: false, error: err?.message || 'Failed to update last contact' };
  }
}

/**
 * Update promise-to-pay date on ledger account
 */
export async function updatePromiseToPayDate(
  leaseId: string, 
  promiseDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get ledger account for this lease
    const { data: ledgerAccount, error: fetchError } = await supabase
      .from('core_ledger_accounts')
      .select('id')
      .eq('lease_id', leaseId)
      .single();

    if (fetchError || !ledgerAccount) {
      console.error('[communicationLogging] Error fetching ledger account:', fetchError);
      return { success: false, error: 'Ledger account not found' };
    }

    // Update promise_to_pay_date
    const { error: updateError } = await supabase
      .from('core_ledger_accounts')
      .update({ promise_to_pay_date: promiseDate })
      .eq('id', ledgerAccount.id);

    if (updateError) {
      console.error('[communicationLogging] Error updating promise-to-pay date:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log activity
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await logActivity({
        type: 'note',
        title: promiseDate ? 'Promise-to-pay date set' : 'Promise-to-pay date cleared',
        description: promiseDate ? `Promise-to-pay date: ${new Date(promiseDate).toLocaleDateString()}` : 'Promise-to-pay date removed',
        leaseId,
      }, user?.id);
    } catch (err) {
      console.error('[communicationLogging] Error logging activity:', err);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[communicationLogging] Unexpected error updating promise-to-pay date:', err);
    return { success: false, error: err?.message || 'Failed to update promise-to-pay date' };
  }
}

/**
 * Update promise-to-pay information (date, amount, status) on ledger account
 */
export async function updatePromiseToPay(
  leaseId: string,
  promiseDate: string | null,
  promiseAmount: number | null,
  promiseStatus: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get ledger account for this lease
    const { data: ledgerAccount, error: fetchError } = await supabase
      .from('core_ledger_accounts')
      .select('id')
      .eq('lease_id', leaseId)
      .single();

    if (fetchError || !ledgerAccount) {
      console.error('[communicationLogging] Error fetching ledger account:', fetchError);
      return { success: false, error: 'Ledger account not found' };
    }

    // Update promise fields
    const updates: any = {};
    if (promiseDate !== undefined) updates.promise_to_pay_date = promiseDate;
    if (promiseAmount !== undefined) updates.promise_amount = promiseAmount;
    if (promiseStatus !== undefined) updates.promise_status = promiseStatus;

    const { error: updateError } = await supabase
      .from('core_ledger_accounts')
      .update(updates)
      .eq('id', ledgerAccount.id);

    if (updateError) {
      console.error('[communicationLogging] Error updating promise-to-pay:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[communicationLogging] Unexpected error updating promise-to-pay:', err);
    return { success: false, error: err?.message || 'Failed to update promise-to-pay' };
  }
}

/**
 * Update notice information on lease
 */
export async function updateNotice(
  leaseId: string,
  noticeType: string | null,
  noticeSentDate: string | null,
  noticeMethod: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update notice fields on lease
    const updates: any = {};
    if (noticeType !== undefined) updates.notice_type = noticeType;
    if (noticeSentDate !== undefined) updates.notice_sent_date = noticeSentDate;
    if (noticeMethod !== undefined) updates.notice_method = noticeMethod;

    const { error: updateError } = await supabase
      .from('core_leases')
      .update(updates)
      .eq('id', leaseId);

    if (updateError) {
      console.error('[communicationLogging] Error updating notice:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[communicationLogging] Unexpected error updating notice:', err);
    return { success: false, error: err?.message || 'Failed to update notice' };
  }
}

/**
 * Update notes on ledger account
 */
export async function updateLedgerNotes(
  leaseId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get ledger account for this lease
    const { data: ledgerAccount, error: fetchError } = await supabase
      .from('core_ledger_accounts')
      .select('id')
      .eq('lease_id', leaseId)
      .single();

    if (fetchError || !ledgerAccount) {
      console.error('[communicationLogging] Error fetching ledger account:', fetchError);
      return { success: false, error: 'Ledger account not found' };
    }

    // Update notes
    const { error: updateError } = await supabase
      .from('core_ledger_accounts')
      .update({ notes })
      .eq('id', ledgerAccount.id);

    if (updateError) {
      console.error('[communicationLogging] Error updating notes:', updateError);
      return { success: false, error: updateError.message };
    }

    // Log activity
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await logActivity({
        type: 'note',
        title: 'Notes updated',
        description: notes ? `Notes: ${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}` : 'Notes cleared',
        leaseId,
      }, user?.id);
    } catch (err) {
      console.error('[communicationLogging] Error logging activity:', err);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[communicationLogging] Unexpected error updating notes:', err);
    return { success: false, error: err?.message || 'Failed to update notes' };
  }
}

