import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, MessageSquare, FileText, Wrench, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getDelinquencyStatus, getAmountOwed } from '../../utils/financialSummary';
import { LeaseDetailModal } from './LeaseDetailModal';
import { ActivityTimeline, Card, CardBody, PageHeader, Breadcrumb, Button, Badge, Spinner, EmptyState, getUnitStatusBadgeVariant } from '../ui';
import { fetchActivities } from '../../utils/activityLogging';

export function UnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [lease, setLease] = useState<any>(null);
  const [resident, setResident] = useState<any>(null);
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);
  const [financialStatus, setFinancialStatus] = useState<any>(null);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (unitId && user?.id) {
      fetchUnitDetails();
    }
  }, [unitId, user?.id]);

  useEffect(() => {
    if (lease?.id) {
      fetchActivitiesForUnit();
    }
  }, [lease?.id]);

  const fetchActivitiesForUnit = async () => {
    if (!lease?.id) return;
    try {
      const events = await fetchActivities({ leaseId: lease.id, unitId });
      setActivities(events);
    } catch (err) {
      console.error('[UnitDetailPage] Error fetching activities:', err);
    }
  };

  const fetchUnitDetails = async () => {
    if (!unitId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch unit with property
      const { data: unitData, error: unitError } = await supabase
        .from('core_units')
        .select(`
          *,
          property:core_properties(*)
        `)
        .eq('id', unitId)
        .single();

      if (unitError) throw unitError;
      if (!unitData) {
        setError('Unit not found');
        setLoading(false);
        return;
      }

      setUnit(unitData);
      setProperty(unitData.property);

      // Fetch active lease for this unit
      const { data: leaseData, error: leaseError } = await supabase
        .from('core_leases')
        .select(`
          *,
          primary_resident:core_residents(*)
        `)
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .order('lease_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaseError && leaseError.code !== 'PGRST116') throw leaseError;

      if (leaseData) {
        setLease(leaseData);
        setResident(leaseData.primary_resident);

        // Fetch ledger account
        const { data: ledgerData, error: ledgerError } = await supabase
          .from('core_ledger_accounts')
          .select('*')
          .eq('lease_id', leaseData.id)
          .maybeSingle();

        if (ledgerError && ledgerError.code !== 'PGRST116') throw ledgerError;

        if (ledgerData) {
          setLedgerAccount(ledgerData);

          // Fetch transactions to calculate financial status
          const { data: transactions, error: txnError } = await supabase
            .from('core_ledger_txns')
            .select('*')
            .eq('ledger_account_id', ledgerData.id)
            .order('txn_date', { ascending: false });

          if (txnError && txnError.code !== 'PGRST116') throw txnError;

          const status = getDelinquencyStatus({
            ledgerAccount: ledgerData,
            transactions: transactions || []
          });

          setFinancialStatus(status);
        } else {
          setFinancialStatus({
            amountOwed: 0,
            isDelinquent: false,
            daysPastDue: 0,
            lastPaymentDate: null,
            balanceSigned: 0
          });
        }
      } else {
        // No active lease
        setFinancialStatus({
          amountOwed: 0,
          isDelinquent: false,
          daysPastDue: 0,
          lastPaymentDate: null,
          balanceSigned: 0
        });
      }
    } catch (err: any) {
      console.error('[UnitDetailPage] Error fetching unit details:', err);
      setError(err?.message || 'Failed to load unit details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-status-danger">
          <CardBody>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-status-danger-text dark:text-status-danger-text-dark font-semibold">Error</p>
                <p className="text-status-danger-text dark:text-status-danger-text-dark text-sm mt-1">{error || 'Unit not found'}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Button
          variant="secondary"
          onClick={() => navigate('/core/units')}
        >
          Back to Units
        </Button>
      </div>
    );
  }

  const breadcrumbItems = [];
  if (property?.id) {
    breadcrumbItems.push(
      { label: 'Properties', onClick: () => navigate('/core/properties') },
      { label: property.name, onClick: () => navigate(`/core/properties/${property.id}/units`) },
      { label: 'Units', onClick: () => navigate(`/core/properties/${property.id}/units`) }
    );
  } else {
    breadcrumbItems.push(
      { label: 'Units', onClick: () => navigate('/core/units') }
    );
  }
  breadcrumbItems.push({ label: `Unit ${unit.unit_code}` });

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb items={breadcrumbItems} />
      
      <PageHeader
        title={`Unit ${unit.unit_code}`}
        subtitle={property?.name}
        actions={
          <Badge variant={getUnitStatusBadgeVariant(unit.status)}>
            {unit.status}
          </Badge>
        }
      />

      {/* Unit Info Card */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Unit Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {unit.beds && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Beds</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{unit.beds}</p>
              </div>
            )}
            {unit.baths && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Baths</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{unit.baths}</p>
              </div>
            )}
            {unit.sqft && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Square Feet</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{unit.sqft.toLocaleString()}</p>
              </div>
            )}
            {unit.asking_rent && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Asking Rent</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">${unit.asking_rent.toLocaleString()}/mo</p>
              </div>
            )}
          </div>
          {unit.available_date && unit.status !== 'occupied' && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Available Date</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {new Date(unit.available_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Current Lease Card */}
      {lease && resident ? (
        <>
          <Card>
            <CardBody>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Current Lease</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeaseId(lease.id)}
                >
                  View Lease Details
                </Button>
              </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Resident</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-gray-400" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{resident.full_name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/core/residents?lease=${lease.id}`)}
                  >
                    View
                  </Button>
                </div>
                {resident.email && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{resident.email}</p>
                )}
                {resident.phone && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{resident.phone}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Lease Start</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(lease.lease_start).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Lease End</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(lease.lease_end).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {lease.rent_amount && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Rent</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${lease.rent_amount.toLocaleString()}/mo
                  </p>
                </div>
              )}
            </div>
            </CardBody>
          </Card>

          {/* Financial Summary Card */}
          {financialStatus && (
            <Card>
              <CardBody>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Financial Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Amount Owed</p>
                    <p className={`text-lg font-semibold tabular-nums ${
                      financialStatus.amountOwed > 0 
                        ? 'text-status-danger dark:text-status-danger-text-dark' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      ${financialStatus.amountOwed.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Days Past Due</p>
                    <p className={`text-lg font-semibold ${
                      financialStatus.daysPastDue > 0 
                        ? 'text-status-warning dark:text-status-warning-text-dark' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {financialStatus.daysPastDue}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Payment</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {financialStatus.lastPaymentDate 
                        ? new Date(financialStatus.lastPaymentDate).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <Badge variant={financialStatus.isDelinquent ? 'delinquency-delinquent' : 'delinquency-current'}>
                      {financialStatus.isDelinquent ? 'Delinquent' : 'Current'}
                    </Badge>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardBody>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Lease</h2>
            <p className="text-gray-600 dark:text-gray-400">Vacant / No active lease</p>
          </CardBody>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardBody>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {lease && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedLeaseId(lease.id)}
                >
                  <FileText className="w-4 h-4" />
                  View Lease
                </Button>
                {resident && (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/core/residents?lease=${lease.id}`)}
                  >
                    <User className="w-4 h-4" />
                    View Resident
                  </Button>
                )}
                {financialStatus?.isDelinquent && (
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedLeaseId(lease.id)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Draft Outreach
                  </Button>
                )}
              </>
            )}
            <Button
              variant="secondary"
              disabled
              title="Coming soon"
            >
              <Wrench className="w-4 h-4" />
              Create Work Order
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Activity Timeline */}
      {lease && (
        <Card>
          <CardBody>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Activity Timeline</h2>
            <ActivityTimeline
              events={activities}
              emptyMessage="No activity recorded for this unit"
            />
          </CardBody>
        </Card>
      )}

      {/* Lease Detail Modal */}
      {selectedLeaseId && (
        <LeaseDetailModal
          leaseId={selectedLeaseId}
          onClose={() => {
            setSelectedLeaseId(null);
            fetchUnitDetails(); // Refresh data
          }}
          onUpdate={fetchUnitDetails}
        />
      )}
    </div>
  );
}

