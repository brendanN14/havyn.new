import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, User, DollarSign, Calendar, MessageSquare, FileText, Wrench, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getDelinquencyStatus, getAmountOwed } from '../../utils/financialSummary';
import { LeaseDetailModal } from './LeaseDetailModal';

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

  useEffect(() => {
    if (unitId && user?.id) {
      fetchUnitDetails();
    }
  }, [unitId, user?.id]);

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
        <Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <p className="text-red-800 dark:text-red-200 font-semibold">Error</p>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error || 'Unit not found'}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/core/units')}
          className="mt-4 flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Units
        </button>
      </div>
    );
  }

  const statusColors = {
    occupied: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    vacant: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'make-ready': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    reserved: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            if (property?.id) {
              navigate(`/core/properties/${property.id}/units`);
            } else {
              navigate('/core/units');
            }
          }}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            {property?.id && (
              <>
                <button
                  onClick={() => navigate(`/core/properties/${property.id}/units`)}
                  className="hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {property.name}
                </button>
                <span>/</span>
                <button
                  onClick={() => navigate(`/core/properties/${property.id}/units`)}
                  className="hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Units
                </button>
                <span>/</span>
              </>
            )}
            <span className="text-gray-900 dark:text-white">Unit {unit.unit_code}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Unit {unit.unit_code}</h1>
          {property?.id && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              <button
                onClick={() => navigate(`/core/properties/${property.id}/units`)}
                className="hover:text-havyn-primary dark:hover:text-emerald-400 hover:underline"
              >
                {property.name}
              </button>
            </p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[unit.status as keyof typeof statusColors] || statusColors.vacant}`}>
          {unit.status}
        </span>
      </div>

      {/* Unit Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
      </div>

      {/* Current Lease Card */}
      {lease && resident ? (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Current Lease</h2>
              <button
                onClick={() => setSelectedLeaseId(lease.id)}
                className="text-sm text-havyn-primary dark:text-emerald-400 hover:underline"
              >
                View Lease Details
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Resident</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-gray-400" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{resident.full_name}</p>
                  <button
                    onClick={() => navigate(`/core/residents?lease=${lease.id}`)}
                    className="text-sm text-havyn-primary dark:text-emerald-400 hover:underline"
                  >
                    View
                  </button>
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
          </div>

          {/* Financial Summary Card */}
          {financialStatus && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Financial Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Amount Owed</p>
                  <p className={`text-lg font-semibold ${financialStatus.amountOwed > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    ${financialStatus.amountOwed.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Days Past Due</p>
                  <p className={`text-lg font-semibold ${financialStatus.daysPastDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
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
                  <p className={`text-lg font-semibold ${financialStatus.isDelinquent ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {financialStatus.isDelinquent ? 'Delinquent' : 'Current'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Lease</h2>
          <p className="text-gray-600 dark:text-gray-400">Vacant / No active lease</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {lease && (
            <>
              <button
                onClick={() => setSelectedLeaseId(lease.id)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                View Lease
              </button>
              {resident && (
                <button
                  onClick={() => navigate(`/core/residents?lease=${lease.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <User className="w-4 h-4" />
                  View Resident
                </button>
              )}
              {financialStatus?.isDelinquent && (
                <button
                  onClick={() => setSelectedLeaseId(lease.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Draft Outreach
                </button>
              )}
            </>
          )}
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            <Wrench className="w-4 h-4" />
            Create Work Order
          </button>
        </div>
      </div>

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

