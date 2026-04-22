import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { Plus, Calendar, Clock, AlertCircle, Mail, Phone, Eye, Search, X, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Card, CardBody, DataTable, Badge, Button, Spinner, Modal, EmptyState, AnimatedContainer, GlassCard } from '../ui';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { CreateLeadModal } from './CreateLeadModal';
import { formatDistanceToNow, format, isPast, isFuture, differenceInHours } from 'date-fns';
import { cn } from '../../utils/cn';

interface Property {
  id: string;
  name: string;
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
  property?: Property;
  unit?: { unit_code: string } | null;
  owner?: { email: string; id: string } | null;
}

// Helper to get initials from name or email
const getInitials = (name?: string | null, email?: string | null): string => {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
};

// Helper to get display name
const getDisplayName = (lead: Lead): string => {
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  if (fullName) return fullName;
  if (lead.email) return lead.email;
  if (lead.phone) return lead.phone;
  return '(No name)';
};

// Helper to check if contact method exists
const hasContactMethod = (lead: Lead): boolean => {
  return !!(lead.email || lead.phone);
};

// Helper to get urgency badge
const getUrgencyBadge = (nextActionAt: string) => {
  const date = new Date(nextActionAt);
  const now = new Date();
  const hoursUntil = differenceInHours(date, now);

  if (isPast(date)) {
    return <Badge variant="delinquency-severe">Overdue</Badge>;
  }
  if (hoursUntil <= 4) {
    return <Badge variant="delinquency-at-risk">Due soon</Badge>;
  }
  return <Badge variant="neutral">Due in {formatDistanceToNow(date)}</Badge>;
};

export function CoreLeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { leadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get('property_id');
  const unitId = searchParams.get('unit_id');

  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]); // Unfiltered leads
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leadId || null);
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);
  const [nextActionModalOpen, setNextActionModalOpen] = useState(false);
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionTime, setNextActionTime] = useState('');
  const [stageChangeModalOpen, setStageChangeModalOpen] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [stageChangeLeadId, setStageChangeLeadId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterProperty, setFilterProperty] = useState<string>(propertyId || '');
  const [showFilters, setShowFilters] = useState(false);

  const fetchProperties = async () => {
    if (!user?.id) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('core_properties')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) throw fetchError;
      setProperties(data || []);
    } catch (err: any) {
      console.error('[CoreLeadsPage] Error fetching properties:', err);
      setError(err.message || 'Failed to load properties');
    }
  };

  const checkTablesAndFetch = useCallback(async () => {
    if (!user?.id) return;
    
    // Check if tables exist
    const { checkAndCreateLeadsTable } = await import('../../utils/checkAndCreateTables');
    const tableCheck = await checkAndCreateLeadsTable();
    
    if (!tableCheck.exists) {
      setError(tableCheck.error || 'Required database tables are missing. Please run the migrations in Supabase SQL Editor.');
      return;
    }

    // Tables exist, proceed with fetching
    await fetchProperties();
  }, [user?.id]);

  useEffect(() => {
    checkTablesAndFetch();
  }, [checkTablesAndFetch]);

  useEffect(() => {
    if (propertyId || properties.length > 0) {
      fetchLeads(propertyId || properties[0]?.id);
    }
  }, [propertyId, properties]);

  // Handle leadId from URL params
  useEffect(() => {
    if (leadId) {
      setSelectedLeadId(leadId);
    }
  }, [leadId]);

  const applyFilters = useCallback(() => {
    let filtered = [...allLeads];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => {
        const fullName = getDisplayName(lead).toLowerCase();
        const email = lead.email?.toLowerCase() || '';
        const phone = lead.phone?.toLowerCase() || '';
        return fullName.includes(query) || email.includes(query) || phone.includes(query);
      });
    }

    // Stage filter
    if (filterStage) {
      filtered = filtered.filter(lead => lead.stage === filterStage);
    }

    // Property filter (already handled by fetchLeads, but for multi-property views)
    if (filterProperty && filterProperty !== propertyId) {
      // This would require fetching across properties, which we skip for now
    }

    setLeads(filtered);
  }, [searchQuery, filterStage, filterProperty, allLeads, propertyId]);

  // Apply filters when search/filter state changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const fetchLeads = async (propId: string) => {
    if (!propId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('core_leads')
        .select('*')
        .eq('property_id', propId);

      // Filter by unit if unit_id query param exists
      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data: leadsData, error: fetchError } = await query.order('next_action_at', { ascending: true });

      if (fetchError) throw fetchError;

      // If no leads, set empty array
      if (!leadsData || leadsData.length === 0) {
        setAllLeads([]);
        setLeads([]);
        return;
      }

      // Fetch property separately
      const { data: propertiesData } = await supabase
        .from('core_properties')
        .select('id, name')
        .eq('id', propId)
        .single();

      // Fetch units separately
      const unitIds = leadsData.filter(l => l.unit_id).map(l => l.unit_id);
      const { data: unitsData } = unitIds.length > 0
        ? await supabase
            .from('core_units')
            .select('id, unit_code')
            .in('id', unitIds)
        : { data: [] };

      // Fetch owners separately
      const ownerIds = [...new Set(leadsData.map(l => l.owner_user_id))];
      const { data: usersData } = ownerIds.length > 0
        ? await supabase
            .from('auth.users')
            .select('id, email')
            .in('id', ownerIds)
        : { data: null };

      // Try to get user emails via Supabase admin or fetch from a user profiles table
      // For now, we'll use a simple approach - store owner_user_id and show initials from email
      const ownerMap = new Map<string, { email: string; id: string }>();
      // We can't directly query auth.users, so we'll need to fetch owner info differently
      // For now, just use the owner_user_id

      // Join data
      const leadsWithRelations = leadsData.map(lead => {
        // Try to get owner email from current user if it matches
        const owner = lead.owner_user_id === user?.id
          ? { id: user.id, email: user.email || '' }
          : { id: lead.owner_user_id, email: '' };

        return {
          ...lead,
          property: propertiesData || undefined,
          unit: unitsData?.find(u => u.id === lead.unit_id) || null,
          owner,
        };
      });

      setAllLeads(leadsWithRelations);
    } catch (err: any) {
      console.error('[CoreLeadsPage] Error fetching leads:', err);
      setError(err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeadSuccess = () => {
    setCreateLeadModalOpen(false);
    if (propertyId) {
      fetchLeads(propertyId);
    } else if (properties.length > 0) {
      fetchLeads(properties[0].id);
    }
  };

  const handleSetNextAction = async (e: React.MouseEvent, leadId: string, currentDate: string) => {
    e.stopPropagation(); // Prevent row click
    setSelectedLead(leads.find(l => l.id === leadId) || null);
    if (currentDate) {
      const date = new Date(currentDate);
      setNextActionDate(date.toISOString().split('T')[0]);
      setNextActionTime(date.toTimeString().slice(0, 5));
    } else {
      const defaultDate = new Date();
      defaultDate.setHours(defaultDate.getHours() + 2);
      setNextActionDate(defaultDate.toISOString().split('T')[0]);
      setNextActionTime(defaultDate.toTimeString().slice(0, 5));
    }
    setNextActionModalOpen(true);
  };

  const handleSaveNextAction = async () => {
    if (!selectedLead || !nextActionDate) return;

    try {
      const nextActionAt = new Date(`${nextActionDate}T${nextActionTime || '12:00'}`).toISOString();

      const { error } = await supabase
        .from('core_leads')
        .update({ next_action_at: nextActionAt })
        .eq('id', selectedLead.id);

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'note',
        title: 'Next action updated',
        description: `Next action set to ${format(new Date(nextActionAt), 'PPp')}`,
        leadId: selectedLead.id,
      });

      setNextActionModalOpen(false);
      if (propertyId) {
        fetchLeads(propertyId);
      } else if (properties.length > 0) {
        fetchLeads(properties[0].id);
      }
    } catch (err: any) {
      console.error('[CoreLeadsPage] Error updating next action:', err);
      setError(err.message || 'Failed to update next action');
    }
  };

  const handleStageChange = async (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation(); // Prevent row click
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Check if next_action_at is set
    if (!lead.next_action_at || isPast(new Date(lead.next_action_at))) {
      setError('Please set a future next action date before changing stage');
      setNextActionModalOpen(true);
      setSelectedLead(lead);
      return;
    }

    setStageChangeLeadId(leadId);
    setNewStage(lead.stage);
    setStageChangeModalOpen(true);
  };

  const handleSaveStageChange = async () => {
    if (!stageChangeLeadId || !newStage) return;

    const lead = leads.find(l => l.id === stageChangeLeadId);
    if (!lead) return;

    // Double-check next_action_at is set and in future
    if (!lead.next_action_at || isPast(new Date(lead.next_action_at))) {
      setError('Cannot change stage: next action must be set to a future date');
      setStageChangeModalOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('core_leads')
        .update({ stage: newStage })
        .eq('id', stageChangeLeadId);

      if (error) throw error;

      // Log activity
      const { logActivity } = await import('../../utils/activityLogging');
      await logActivity({
        type: 'note',
        title: 'Stage changed',
        description: `Stage changed from ${lead.stage} to ${newStage}`,
        leadId: stageChangeLeadId,
      });

      setStageChangeModalOpen(false);
      if (propertyId) {
        fetchLeads(propertyId);
      } else if (properties.length > 0) {
        fetchLeads(properties[0].id);
      }
    } catch (err: any) {
      console.error('[CoreLeadsPage] Error updating stage:', err);
      setError(err.message || 'Failed to update stage');
    }
  };

  const handleRowClick = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    navigate(`/core/leads/${lead.id}${propertyId ? `?property_id=${propertyId}` : ''}`);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStage('');
    setFilterProperty(propertyId || '');
  };

  const hasActiveFilters = searchQuery || filterStage || (filterProperty && filterProperty !== propertyId);

  const selectedProperty = properties.find(p => p.id === (propertyId || properties[0]?.id));

  if (loading && leads.length === 0 && allLeads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AnimatedContainer animation="fade-in-up" className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Manage your leasing pipeline"
        variant="gradient"
        actions={
          <>
            {properties.length > 1 && !showFilters && (
              <select
                value={propertyId || properties[0]?.id || ''}
                onChange={(e) => {
                  navigate(`/core/leads?property_id=${e.target.value}`);
                  setFilterProperty(e.target.value);
                }}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              >
                {properties.map(prop => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            )}
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
            <Button
              variant="primary"
              onClick={() => setCreateLeadModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Create Lead
            </Button>
          </>
        }
      />

      {error && (
        <Card className="border-status-danger">
          <CardBody>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger" />
              <p className="text-status-danger-text">{error}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      {showFilters && (
        <AnimatedContainer animation="slide-down">
          <Card variant="glass" hover>
            <CardBody>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                  />
                </div>
              </div>

              <div className="min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stage
                </label>
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                >
                  <option value="">All stages</option>
                  <option value="inquiry">Inquiry</option>
                  <option value="tour_scheduled">Tour Scheduled</option>
                  <option value="application">Application</option>
                  <option value="approved">Approved</option>
                  <option value="lease_signed">Lease Signed</option>
                  <option value="moved_in">Moved In</option>
                  <option value="lost">Lost</option>
                  <option value="nurture">Nurture</option>
                </select>
              </div>

              {properties.length > 1 && (
                <div className="min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Property
                  </label>
                  <select
                    value={filterProperty}
                    onChange={(e) => {
                      setFilterProperty(e.target.value);
                      navigate(`/core/leads?property_id=${e.target.value}`);
                    }}
                    className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                  >
                    <option value="">All properties</option>
                    {properties.map(prop => (
                      <option key={prop.id} value={prop.id}>{prop.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4" />
                  Clear filters
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
        </AnimatedContainer>
      )}

      <AnimatedContainer animation="fade-in-up" delay={100}>
        <Card variant="glass" hover>
        <CardBody className="p-0">
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Lead',
                render: (_, row: Lead) => {
                  const displayName = getDisplayName(row);
                  const isMissingName = !row.first_name && !row.last_name;
                  return (
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {isMissingName ? (
                          <>
                            <span className="text-gray-400 italic">(No name)</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLeadId(row.id);
                              }}
                              className="text-xs text-havyn-primary hover:text-havyn-primary-dark"
                            >
                              Add name
                            </Button>
                          </>
                        ) : (
                          <span>{displayName}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-x-2 mt-1">
                        {row.email ? (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {row.email}</span>
                        ) : null}
                        {row.phone ? (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {row.phone}</span>
                        ) : null}
                        {!hasContactMethod(row) && (
                          <span className="text-muted-text italic">No contact method</span>
                        )}
                      </div>
                    </div>
                  );
                }
              },
              {
                key: 'owner',
                label: 'Owner',
                render: (_, row: Lead) => {
                  const owner = row.owner;
                  if (!owner || !owner.email) {
                    return (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          ??
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Unassigned</span>
                      </div>
                    );
                  }
                  const initials = getInitials(null, owner.email);
                  const displayName = owner.email.split('@')[0];
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-havyn-primary/20 flex items-center justify-center text-xs font-medium text-havyn-primary">
                        {initials}
                      </div>
                      <span className="text-sm text-gray-900 dark:text-white">{displayName}</span>
                    </div>
                  );
                }
              },
              {
                key: 'property',
                label: 'Property',
                render: (_, row: Lead) => row.property?.name || '-'
              },
              {
                key: 'unit',
                label: 'Unit',
                render: (_, row: Lead) => row.unit?.unit_code || '-'
              },
              {
                key: 'stage',
                label: 'Stage',
                render: (value) => <Badge variant="neutral">{value.replace('_', ' ')}</Badge>
              },
              {
                key: 'next_action_at',
                label: 'Next Action',
                className: 'text-right',
                render: (value, row: Lead) => {
                  if (!value) {
                    return (
                      <div className="text-right">
                        <Badge variant="neutral">No next action</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetNextAction(e, row.id, '');
                          }}
                          className="text-xs mt-1"
                        >
                          Set action
                        </Button>
                      </div>
                    );
                  }
                  const date = new Date(value);
                  const isOverdue = isPast(date);
                  const hoursUntil = differenceInHours(date, new Date());
                  const isDueSoon = !isOverdue && hoursUntil <= 4;

                  return (
                    <div className="text-right space-y-1">
                      {getUrgencyBadge(value)}
                      <div className={cn(
                        'text-xs',
                        isOverdue && 'text-status-danger-text',
                        isDueSoon && !isOverdue && 'text-status-warn-text',
                        !isOverdue && !isDueSoon && 'text-muted-text'
                      )}>
                        {isOverdue ? `Due ${formatDistanceToNow(date)} ago` : format(date, 'PPp')}
                      </div>
                    </div>
                  );
                }
              },
              {
                key: 'actions',
                label: 'Actions',
                className: 'text-right',
                render: (_, row: Lead) => (
                  <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRowClick(row)}
                      title="View lead details"
                      aria-label="View lead details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleSetNextAction(e, row.id, row.next_action_at)}
                      title="Set next action"
                      aria-label="Set next action"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleStageChange(e, row.id)}
                      title="Change stage"
                      aria-label="Change stage"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            data={leads}
            loading={loading}
            onRowClick={handleRowClick}
            emptyMessage={
              hasActiveFilters
                ? "No leads match your filters"
                : "No leads yet"
            }
            emptyDescription={
              hasActiveFilters
                ? "Try clearing filters or adjusting your search"
                : "Create your first lead to get started with your leasing pipeline"
            }
            emptyAction={
              hasActiveFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  <X className="w-4 h-4" />
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreateLeadModalOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Create Lead
                </Button>
              )
            }
          />
        </CardBody>
      </Card>
      </AnimatedContainer>

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={createLeadModalOpen}
        onClose={() => setCreateLeadModalOpen(false)}
        onSuccess={handleCreateLeadSuccess}
        propertyId={propertyId || undefined}
        unitId={unitId || undefined}
      />

      {/* Set Next Action Modal */}
      {nextActionModalOpen && selectedLead && (
        <Modal
          isOpen={nextActionModalOpen}
          onClose={() => setNextActionModalOpen(false)}
          title="Set Next Action"
          size="md"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setNextActionModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveNextAction}
                className="flex-1"
              >
                Save
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date <span className="text-status-danger-text">*</span>
              </label>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time
              </label>
              <input
                type="time"
                value={nextActionTime}
                onChange={(e) => setNextActionTime(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Stage Change Modal */}
      {stageChangeModalOpen && (
        <Modal
          isOpen={stageChangeModalOpen}
          onClose={() => setStageChangeModalOpen(false)}
          title="Change Stage"
          size="md"
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setStageChangeModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveStageChange}
                className="flex-1"
              >
                Save
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Stage
              </label>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-havyn-primary"
              >
                <option value="inquiry">Inquiry</option>
                <option value="tour_scheduled">Tour Scheduled</option>
                <option value="application">Application</option>
                <option value="approved">Approved</option>
                <option value="lease_signed">Lease Signed</option>
                <option value="moved_in">Moved In</option>
                <option value="lost">Lost</option>
                <option value="nurture">Nurture</option>
              </select>
            </div>
            {stageChangeLeadId && leads.find(l => l.id === stageChangeLeadId)?.next_action_at && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Next action: {format(new Date(leads.find(l => l.id === stageChangeLeadId)!.next_action_at), 'PPp')}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        isOpen={!!selectedLeadId}
        onClose={() => {
          setSelectedLeadId(null);
          // Remove leadId from URL if present
          if (leadId) {
            navigate('/core/leads' + (propertyId ? `?property_id=${propertyId}` : ''));
          }
        }}
        onUpdate={() => {
          if (propertyId) {
            fetchLeads(propertyId);
          } else if (properties.length > 0) {
            fetchLeads(properties[0].id);
          }
        }}
      />
    </AnimatedContainer>
  );
}
