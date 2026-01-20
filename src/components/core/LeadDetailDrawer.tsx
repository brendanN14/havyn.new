import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, User, Mail, Phone, MapPin, FileText, Plus, Edit, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Drawer, Button, Badge, Card, CardBody, DataTable, Spinner, Tabs, Tab, EmptyState } from '../ui';
import { ActivityTimeline } from '../ui';
import { format, isPast, isFuture } from 'date-fns';
import { CreateTourModal } from './CreateTourModal';
import { CreateApplicationModal } from './CreateApplicationModal';
import { ConvertToLeaseModal } from './ConvertToLeaseModal';

interface LeadDetailDrawerProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface Lead {
  id: string;
  property_id: string;
  unit_id: string | null;
  owner_user_id: string;
  stage: string;
  next_action_at: string;
  last_touch_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  property?: { name: string };
  unit?: { unit_code: string };
}

interface Tour {
  id: string;
  lead_id: string;
  unit_id: string | null;
  scheduled_at: string;
  completed_at: string | null;
  status: string;
  notes: string | null;
  unit?: { unit_code: string };
}

interface Application {
  id: string;
  lead_id: string;
  unit_id: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  income_amount: number | null;
  credit_score: number | null;
  notes: string | null;
  unit?: { unit_code: string };
}

export function LeadDetailDrawer({ leadId, isOpen, onClose, onUpdate }: LeadDetailDrawerProps) {
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [createTourModalOpen, setCreateTourModalOpen] = useState(false);
  const [createApplicationModalOpen, setCreateApplicationModalOpen] = useState(false);
  const [convertToLeaseModalOpen, setConvertToLeaseModalOpen] = useState(false);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLead();
      fetchTours();
      fetchApplications();
      fetchActivities();
    }
  }, [isOpen, leadId]);

  const fetchLead = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const { data: leadData, error } = await supabase
        .from('core_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) throw error;

      // Fetch property and unit separately
      const [propertyResult, unitResult] = await Promise.all([
        leadData.property_id
          ? supabase
              .from('core_properties')
              .select('id, name')
              .eq('id', leadData.property_id)
              .single()
          : Promise.resolve({ data: null }),
        leadData.unit_id
          ? supabase
              .from('core_units')
              .select('id, unit_code')
              .eq('id', leadData.unit_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      setLead({
        ...leadData,
        property: propertyResult.data || undefined,
        unit: unitResult.data || null,
      });
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error fetching lead:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTours = async () => {
    if (!leadId) return;
    try {
      const { data: toursData, error } = await supabase
        .from('core_tours')
        .select('*')
        .eq('lead_id', leadId)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      // Fetch units separately
      const unitIds = toursData?.filter(t => t.unit_id).map(t => t.unit_id) || [];
      const { data: unitsData } = unitIds.length > 0
        ? await supabase
            .from('core_units')
            .select('id, unit_code')
            .in('id', unitIds)
        : { data: [] };

      // Join data
      const toursWithRelations = toursData?.map(tour => ({
        ...tour,
        unit: unitsData?.find(u => u.id === tour.unit_id) || null,
      })) || [];

      setTours(toursWithRelations);
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error fetching tours:', err);
    }
  };

  const fetchApplications = async () => {
    if (!leadId) return;
    try {
      const { data: appsData, error } = await supabase
        .from('core_applications')
        .select('*')
        .eq('lead_id', leadId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Fetch units separately
      const unitIds = appsData?.filter(a => a.unit_id).map(a => a.unit_id) || [];
      const { data: unitsData } = unitIds.length > 0
        ? await supabase
            .from('core_units')
            .select('id, unit_code')
            .in('id', unitIds)
        : { data: [] };

      // Join data
      const appsWithRelations = appsData?.map(app => ({
        ...app,
        unit: unitsData?.find(u => u.id === app.unit_id) || null,
      })) || [];

      setApplications(appsWithRelations);
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error fetching applications:', err);
    }
  };

  const fetchActivities = async () => {
    if (!leadId) return;
    try {
      const { fetchActivities } = await import('../../utils/activityLogging');
      const activitiesData = await fetchActivities({ leadId });
      setActivities(activitiesData || []);
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error fetching activities:', err);
    }
  };

  const handleUpdateNextAction = async (date: string, time: string) => {
    if (!lead || !date) return;

    try {
      const nextActionAt = new Date(`${date}T${time || '12:00'}`).toISOString();

      const { error } = await supabase
        .from('core_leads')
        .update({ next_action_at: nextActionAt })
        .eq('id', lead.id);

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'note',
        title: 'Next action updated',
        description: `Next action set to ${format(new Date(nextActionAt), 'PPp')}`,
        leadId: lead.id,
      });

      fetchLead();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error updating next action:', err);
      alert('Failed to update next action');
    }
  };

  const handleTourCreated = () => {
    fetchTours();
    fetchActivities();
    setCreateTourModalOpen(false);
  };

  const handleApplicationCreated = () => {
    fetchApplications();
    fetchActivities();
    setCreateApplicationModalOpen(false);
  };

  const handleTourUpdated = async (tourId: string, status: string, notes?: string) => {
    try {
      const updates: any = { status };
      if (notes !== undefined) updates.notes = notes;
      if (status === 'completed' || status === 'no_show') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('core_tours')
        .update(updates)
        .eq('id', tourId);

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'tour',
        title: `Tour ${status}`,
        description: notes || `Tour marked as ${status}`,
        leadId: lead!.id,
        status,
        metadata: { tourId },
      });

      fetchTours();
      fetchActivities();
      setEditingTourId(null);
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error updating tour:', err);
      alert('Failed to update tour');
    }
  };

  const handleApplicationUpdated = async (applicationId: string, status: string, notes?: string) => {
    try {
      const updates: any = { status };
      if (notes !== undefined) updates.notes = notes;
      if (status === 'approved' || status === 'rejected') {
        updates.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('core_applications')
        .update(updates)
        .eq('id', applicationId);

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'application',
        title: `Application ${status}`,
        description: notes || `Application status changed to ${status}`,
        leadId: lead!.id,
        status,
        metadata: { applicationId },
      });

      fetchApplications();
      fetchActivities();
      setEditingApplicationId(null);
    } catch (err: any) {
      console.error('[LeadDetailDrawer] Error updating application:', err);
      alert('Failed to update application');
    }
  };

  const handleConvertToLease = () => {
    const approvedApp = applications.find(a => a.status === 'approved');
    if (!approvedApp) {
      alert('No approved application found. Please approve an application first.');
      return;
    }
    setConvertToLeaseModalOpen(true);
  };

  const handleLeaseConverted = () => {
    setConvertToLeaseModalOpen(false);
    if (onUpdate) onUpdate();
    onClose(); // Close drawer after conversion
  };

  const approvedApplication = applications.find(a => a.status === 'approved');

  if (!isOpen) return null;

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed Lead' : 'Lead Details'}
        size="lg"
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : !lead ? (
          <EmptyState
            title="Lead not found"
            description="The lead you're looking for doesn't exist."
          />
        ) : (
          <div className="space-y-6">
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tab value="overview" label="Overview" />
              <Tab value="tours" label={`Tours (${tours.length})`} />
              <Tab value="applications" label={`Applications (${applications.length})`} />
              <Tab value="activity" label="Activity" />
            </Tabs>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Lead Summary */}
                <Card>
                  <CardBody>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {lead.first_name || lead.last_name
                              ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                              : 'Unnamed Lead'}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            {lead.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                {lead.email}
                              </span>
                            )}
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-4 h-4" />
                                {lead.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="neutral">{lead.stage.replace('_', ' ')}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Property</div>
                          <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-white">
                            <MapPin className="w-4 h-4" />
                            {lead.property?.name || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Unit</div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {lead.unit?.unit_code || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Source</div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {lead.source || '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Touch</div>
                          <div className="text-sm text-gray-900 dark:text-white">
                            {format(new Date(lead.last_touch_at), 'PPp')}
                          </div>
                        </div>
                      </div>

                      {lead.notes && (
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</div>
                          <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {lead.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* Next Action */}
                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Next Action</h3>
                        <div className="space-y-1">
                          {isPast(new Date(lead.next_action_at)) ? (
                            <Badge variant="delinquency-severe">Idle</Badge>
                          ) : (
                            <Badge variant="delinquency-at-risk">
                              Due {format(new Date(lead.next_action_at), 'PPp')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const date = new Date(lead.next_action_at);
                          const dateStr = date.toISOString().split('T')[0];
                          const timeStr = date.toTimeString().slice(0, 5);
                          handleUpdateNextAction(dateStr, timeStr);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        Update
                      </Button>
                    </div>
                  </CardBody>
                </Card>

                {/* Convert to Lease (if approved) */}
                {approvedApplication && (
                  <Card className="border-status-success">
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-5 h-5 text-status-success-text" />
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              Application Approved
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Ready to convert to lease
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          onClick={handleConvertToLease}
                        >
                          Convert to Lease
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'tours' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tours</h3>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCreateTourModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Schedule Tour
                  </Button>
                </div>

                {tours.length === 0 ? (
                  <EmptyState
                    title="No tours scheduled"
                    description="Schedule a tour to start the leasing process."
                  />
                ) : (
                  <Card>
                    <CardBody className="p-0">
                      <DataTable
                        columns={[
                          {
                            key: 'scheduled_at',
                            label: 'Scheduled',
                            render: (value) => format(new Date(value), 'PPp')
                          },
                          {
                            key: 'unit',
                            label: 'Unit',
                            render: (_, row: Tour) => row.unit?.unit_code || '-'
                          },
                          {
                            key: 'status',
                            label: 'Status',
                            render: (value) => (
                              <Badge variant={
                                value === 'completed' ? 'delinquency-current' :
                                value === 'no_show' ? 'delinquency-severe' :
                                value === 'cancelled' ? 'neutral' :
                                'delinquency-at-risk'
                              }>
                                {value}
                              </Badge>
                            )
                          },
                          {
                            key: 'actions',
                            label: 'Actions',
                            render: (_, row: Tour) => (
                              <div className="flex gap-2">
                                {editingTourId === row.id ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleTourUpdated(row.id, 'completed')}
                                    >
                                      Completed
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleTourUpdated(row.id, 'no_show')}
                                    >
                                      No Show
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingTourId(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingTourId(row.id)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )
                          }
                        ]}
                        data={tours}
                        emptyMessage="No tours scheduled"
                      />
                    </CardBody>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Applications</h3>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCreateApplicationModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Create Application
                  </Button>
                </div>

                {applications.length === 0 ? (
                  <EmptyState
                    title="No applications"
                    description="Create an application to continue the leasing process."
                  />
                ) : (
                  <Card>
                    <CardBody className="p-0">
                      <DataTable
                        columns={[
                          {
                            key: 'submitted_at',
                            label: 'Submitted',
                            render: (value) => format(new Date(value), 'PPp')
                          },
                          {
                            key: 'unit',
                            label: 'Unit',
                            render: (_, row: Application) => row.unit?.unit_code || '-'
                          },
                          {
                            key: 'status',
                            label: 'Status',
                            render: (value) => (
                              <Badge variant={
                                value === 'approved' ? 'delinquency-current' :
                                value === 'rejected' ? 'delinquency-severe' :
                                value === 'withdrawn' ? 'neutral' :
                                'delinquency-at-risk'
                              }>
                                {value}
                              </Badge>
                            )
                          },
                          {
                            key: 'actions',
                            label: 'Actions',
                            render: (_, row: Application) => (
                              <div className="flex gap-2">
                                {editingApplicationId === row.id ? (
                                  <>
                                    {row.status !== 'approved' && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleApplicationUpdated(row.id, 'approved')}
                                      >
                                        Approve
                                      </Button>
                                    )}
                                    {row.status !== 'rejected' && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleApplicationUpdated(row.id, 'rejected')}
                                      >
                                        Reject
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingApplicationId(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingApplicationId(row.id)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )
                          }
                        ]}
                        data={applications}
                        emptyMessage="No applications"
                      />
                    </CardBody>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <ActivityTimeline activities={activities} />
            )}
          </div>
        )}
      </Drawer>

      {lead && (
        <>
          <CreateTourModal
            isOpen={createTourModalOpen}
            onClose={() => setCreateTourModalOpen(false)}
            onSuccess={handleTourCreated}
            leadId={lead.id}
            unitId={lead.unit_id || undefined}
            propertyId={lead.property_id}
          />

          <CreateApplicationModal
            isOpen={createApplicationModalOpen}
            onClose={() => setCreateApplicationModalOpen(false)}
            onSuccess={handleApplicationCreated}
            leadId={lead.id}
            unitId={lead.unit_id || undefined}
            propertyId={lead.property_id}
          />

          {approvedApplication && (
            <ConvertToLeaseModal
              isOpen={convertToLeaseModalOpen}
              onClose={() => setConvertToLeaseModalOpen(false)}
              onSuccess={handleLeaseConverted}
              lead={lead}
              application={approvedApplication}
            />
          )}
        </>
      )}
    </>
  );
}

