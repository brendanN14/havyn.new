import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Home, Check, ArrowRight, ArrowLeft, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { seedCorePMSDataForCurrentUser } from '../../utils/seedCorePMSData';

type Step = 'property' | 'units' | 'complete';

interface PropertyForm {
    name: string;
    address_line1: string;
    city: string;
    state: string;
    zip_code: string;
}

export function CoreSetupWizard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<Step>('property');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Property form
    const [propertyForm, setPropertyForm] = useState<PropertyForm>({
        name: '',
        address_line1: '',
        city: '',
        state: '',
        zip_code: ''
    });
    const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);

    // Units form
    const [unitCodes, setUnitCodes] = useState('');
    const [unitsCreated, setUnitsCreated] = useState(0);

    const logError = (context: string, err: any) => {
        const errorInfo = {
            context,
            code: err?.code,
            message: err?.message,
            details: err?.details,
            hint: err?.hint,
            file: 'CoreSetupWizard.tsx'
        };
        console.error(`[CoreSetupWizard] ${context}:`, errorInfo);

        if (err?.code === '42501' || err?.message?.includes('row-level security')) {
            setError(`Permission denied: ${err.message}. This is likely an RLS policy issue. Check Supabase policies for the affected table.`);
        } else if (err?.code === 'PGRST116' || err?.message?.includes('does not exist')) {
            setError(`Table not found: ${err.message}. Please ensure the Core PMS migration has been applied.`);
        } else {
            setError(err?.message || 'An unexpected error occurred');
        }
    };

    const handleCreateProperty = async () => {
        if (!user?.id || !propertyForm.name.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('core_properties')
                .insert({
                    user_id: user.id,
                    name: propertyForm.name.trim(),
                    address_line1: propertyForm.address_line1.trim() || null,
                    city: propertyForm.city.trim() || null,
                    state: propertyForm.state.trim() || null,
                    zip_code: propertyForm.zip_code.trim() || null
                })
                .select()
                .single();

            if (insertError) {
                logError('Creating property', insertError);
                return;
            }

            setCreatedPropertyId(data.id);
            setCurrentStep('units');
        } catch (err: any) {
            logError('Creating property (catch)', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUnits = async () => {
        if (!createdPropertyId || !unitCodes.trim()) {
            // Skip units step if no codes provided
            setCurrentStep('complete');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Parse unit codes - split by newlines, commas, or spaces
            const codes = unitCodes
                .split(/[\n,\s]+/)
                .map(code => code.trim())
                .filter(code => code.length > 0);

            if (codes.length === 0) {
                setCurrentStep('complete');
                return;
            }

            // Create units with default values
            const unitsToInsert = codes.map(code => ({
                property_id: createdPropertyId,
                unit_code: code,
                status: 'vacant',
                showable: true
            }));

            const { error: insertError } = await supabase
                .from('core_units')
                .insert(unitsToInsert);

            if (insertError) {
                logError('Creating units', insertError);
                return;
            }

            setUnitsCreated(codes.length);
            setCurrentStep('complete');
        } catch (err: any) {
            logError('Creating units (catch)', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDemoData = async () => {
        if (!user?.id) return;

        setLoading(true);
        setError(null);

        try {
            const result = await seedCorePMSDataForCurrentUser();
            
            if (result.success) {
                // Navigate to dashboard - the seeding function creates everything
                navigate('/core/dashboard');
            } else {
                setError(result.message || 'Failed to create demo data');
            }
        } catch (err: any) {
            logError('Creating demo data (catch)', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        navigate('/core/dashboard');
    };

    const steps = [
        { id: 'property', label: 'Create Property', icon: Building2 },
        { id: 'units', label: 'Add Units', icon: Home },
        { id: 'complete', label: 'Finish', icon: Check }
    ];

    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-havyn-primary to-emerald-600 rounded-2xl shadow-lg mb-4">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome to Core PMS</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Let's set up your first property in just a few steps</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center mb-12">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index === currentStepIndex;
                        const isComplete = index < currentStepIndex;

                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center">
                                    <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                    ${isComplete ? 'bg-havyn-primary text-white' :
                                            isActive ? 'bg-havyn-primary/20 text-havyn-primary border-2 border-havyn-primary' :
                                                'bg-gray-100 dark:bg-gray-800 text-gray-400'}
                  `}>
                                        {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                    </div>
                                    <span className={`mt-2 text-xs font-medium ${isActive || isComplete ? 'text-havyn-primary' : 'text-gray-400'
                                        }`}>
                                        {step.label}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`w-16 h-0.5 mx-2 mb-6 ${index < currentStepIndex ? 'bg-havyn-primary' : 'bg-gray-200 dark:bg-gray-700'
                                        }`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
                            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-red-400 hover:text-red-600"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Step Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
                    {currentStep === 'property' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Create Your First Property</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Enter the basic details for your property</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Property Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={propertyForm.name}
                                        onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                                        placeholder="e.g., Sunset Apartments"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Street Address
                                    </label>
                                    <input
                                        type="text"
                                        value={propertyForm.address_line1}
                                        onChange={(e) => setPropertyForm({ ...propertyForm, address_line1: e.target.value })}
                                        placeholder="e.g., 1234 Main Street"
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            City
                                        </label>
                                        <input
                                            type="text"
                                            value={propertyForm.city}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })}
                                            placeholder="City"
                                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            State
                                        </label>
                                        <input
                                            type="text"
                                            value={propertyForm.state}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, state: e.target.value })}
                                            placeholder="CA"
                                            maxLength={2}
                                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            ZIP Code
                                        </label>
                                        <input
                                            type="text"
                                            value={propertyForm.zip_code}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, zip_code: e.target.value })}
                                            placeholder="90210"
                                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={handleCreateDemoData}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-havyn-primary dark:text-emerald-400 hover:bg-havyn-primary/10 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Create Demo Property (with delinquency)
                                </button>
                                <button
                                    onClick={handleCreateProperty}
                                    disabled={loading || !propertyForm.name.trim()}
                                    className="flex items-center gap-2 px-6 py-3 bg-havyn-primary text-white rounded-xl hover:bg-havyn-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            Continue
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 'units' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Add Units</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    Paste or type unit codes below (one per line, or separated by commas)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Unit Codes
                                </label>
                                <textarea
                                    value={unitCodes}
                                    onChange={(e) => setUnitCodes(e.target.value)}
                                    placeholder="101&#10;102&#10;103&#10;201&#10;202&#10;203"
                                    rows={8}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-havyn-primary focus:border-transparent transition-all font-mono text-sm"
                                />
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    All units will be created as vacant and showable. You can edit details later.
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={() => setCurrentStep('property')}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setCurrentStep('complete')}
                                        disabled={loading}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        Skip for now
                                    </button>
                                    <button
                                        onClick={handleCreateUnits}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-6 py-3 bg-havyn-primary text-white rounded-xl hover:bg-havyn-dark transition-colors disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                Create Units
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 'complete' && (
                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-havyn-primary to-emerald-600 rounded-full mb-6">
                                <Check className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're All Set!</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-2">
                                Your property has been created successfully.
                            </p>
                            {unitsCreated > 0 && (
                                <p className="text-havyn-primary dark:text-emerald-400 font-medium mb-8">
                                    {unitsCreated} units added
                                </p>
                            )}

                            <button
                                onClick={handleFinish}
                                className="px-8 py-4 bg-havyn-primary text-white rounded-xl hover:bg-havyn-dark transition-colors text-lg font-medium"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

