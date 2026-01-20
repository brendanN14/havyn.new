import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TenantAuthProvider } from './contexts/TenantAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { AuthForm } from './components/AuthForm';
import { LandingPage } from './components/LandingPage';
import { TenantApp } from './components/TenantApp';
import { useAuth } from './contexts/AuthContext';
import { useProfile } from './contexts/ProfileContext';
// Import test utilities for browser console access
import './utils/testCorePMSTables';
import './utils/seedCorePMSData';
import GmailCallback from './components/GmailCallback';
import { CorePMSLayout } from './components/core/CorePMSLayout';
import { CoreDashboard } from './components/core/CoreDashboard';
import { CorePropertiesPage } from './components/core/CorePropertiesPage';
import { CoreUnitsPage } from './components/core/CoreUnitsPage';
import { CoreLeasesPage } from './components/core/CoreLeasesPage';
import { CoreResidentsPage } from './components/core/CoreResidentsPage';
import { CoreLeadsPage } from './components/core/CoreLeadsPage';
import { CoreSetupWizard } from './components/core/CoreSetupWizard';
import { CoreInsightsPage } from './components/core/CoreInsightsPage';
import { UnitDetailPage } from './components/core/UnitDetailPage';
import { CorePropertyDetailPage } from './components/core/CorePropertyDetailPage';
import { PropertyScopedUnitsPage } from './components/core/PropertyScopedUnitsPage';
import { PropertyScopedLeasesPage } from './components/core/PropertyScopedLeasesPage';
import { PropertyScopedResidentsPage } from './components/core/PropertyScopedResidentsPage';
import { PropertyScopedCollectionsPage } from './components/core/PropertyScopedCollectionsPage';
import { MainContent } from './components/MainContent';
import { Loader2 } from 'lucide-react';

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
      <Loader2 className="w-12 h-12 animate-spin text-havyn-primary" />
    </div>
  );
}

// Login page - redirects authenticated users to their dashboard
function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  console.log('[LoginPage] State:', { user: user?.id, authLoading, profile: profile?.role, profileLoading });

  // Still loading auth state
  if (authLoading) {
    console.log('[LoginPage] Auth loading, showing spinner');
    return <LoadingSpinner />;
  }

  // Not logged in - show auth form
  if (!user) {
    console.log('[LoginPage] No user, showing auth form');
    return <AuthForm />;
  }

  // User exists, waiting for profile
  if (profileLoading || !profile) {
    console.log('[LoginPage] Profile loading or missing, showing spinner');
    return <LoadingSpinner />;
  }

  // User is logged in with profile - redirect based on role
  if (profile.role === 'owner_readonly') {
    console.log('[LoginPage] Redirecting owner_readonly to /owner/dashboard');
    return <Navigate to="/owner/dashboard" replace />;
  }
  
  console.log('[LoginPage] Redirecting to /core/dashboard');
  // All other roles go to Core PMS
  return <Navigate to="/core/dashboard" replace />;
}

// Legacy dashboard - accessible by all roles
function LegacyDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  console.log('[LegacyDashboardPage] State:', { user: user?.id, authLoading, profile: profile?.role, profileLoading });

  if (authLoading) {
    console.log('[LegacyDashboardPage] Auth loading');
    return <LoadingSpinner />;
  }

  if (!user) {
    console.log('[LegacyDashboardPage] No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (profileLoading || !profile) {
    console.log('[LegacyDashboardPage] Profile loading');
    return <LoadingSpinner />;
  }

  console.log('[LegacyDashboardPage] Rendering legacy dashboard');
  // Allow access to legacy dashboard for all users
  return <MainContent />;
}

// Owner readonly dashboard - only for owner_readonly role
function OwnerReadOnlyDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  console.log('[OwnerReadOnlyDashboardPage] State:', { user: user?.id, authLoading, profile: profile?.role, profileLoading });

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileLoading || !profile) {
    return <LoadingSpinner />;
  }

  // Only owner_readonly can access this page
  if (profile.role !== 'owner_readonly') {
    console.log('[OwnerReadOnlyDashboardPage] Not owner_readonly, redirecting to core');
    return <Navigate to="/core/dashboard" replace />;
  }

  console.log('[OwnerReadOnlyDashboardPage] Rendering owner readonly dashboard');
  return <MainContent />;
}

// Core PMS Routes - protected routes for Core PMS
function CorePMSRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  console.log('[CorePMSRoutes] State:', { user: user?.id, authLoading, profile: profile?.role, profileLoading, path: window.location.pathname });

  if (authLoading) {
    console.log('[CorePMSRoutes] Auth loading');
    return <LoadingSpinner />;
  }

  if (!user) {
    console.log('[CorePMSRoutes] No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (profileLoading || !profile) {
    console.log('[CorePMSRoutes] Profile loading or missing');
    return <LoadingSpinner />;
  }

  // owner_readonly should not access Core PMS
  if (profile.role === 'owner_readonly') {
    console.log('[CorePMSRoutes] owner_readonly, redirecting to owner dashboard');
    return <Navigate to="/owner/dashboard" replace />;
  }

  console.log('[CorePMSRoutes] Rendering Core PMS routes');

  return (
    <Routes>
      {/* Setup wizard - no layout */}
      <Route path="setup" element={<CoreSetupWizard />} />
      
      {/* Core PMS pages with layout */}
        <Route element={<CorePMSLayout />}>
        <Route path="dashboard" element={<CoreDashboard />} />
            <Route path="properties" element={<CorePropertiesPage />} />
            <Route path="properties/:propertyId" element={<CorePropertyDetailPage />}>
              <Route index element={<PropertyScopedUnitsPage />} />
              <Route path="units" element={<PropertyScopedUnitsPage />} />
              <Route path="leases" element={<PropertyScopedLeasesPage />} />
              <Route path="residents" element={<PropertyScopedResidentsPage />} />
              <Route path="collections" element={<PropertyScopedCollectionsPage />} />
            </Route>
            <Route path="units" element={<CoreUnitsPage />} />
            <Route path="units/:unitId" element={<UnitDetailPage />} />
            <Route path="leases" element={<CoreLeasesPage />} />
            <Route path="residents" element={<CoreResidentsPage />} />
            <Route path="leads" element={<CoreLeadsPage />} />
            <Route path="leads/:leadId" element={<CoreLeadsPage />} />
            <Route path="financial" element={<CoreInsightsPage />} />
            <Route path="delinquency" element={<CoreInsightsPage />} />
            <Route path="collections" element={<CoreInsightsPage />} />
        <Route index element={<CoreDashboard />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Auth routes */}
          <Route 
            path="/login" 
            element={
              <AuthProvider>
                <ProfileProvider>
                  <LoginPage />
                </ProfileProvider>
              </AuthProvider>
            } 
          />
          
          {/* Legacy dashboard - accessible by all users */}
          <Route 
            path="/dashboard" 
            element={
              <AuthProvider>
                <ProfileProvider>
                  <LegacyDashboardPage />
                </ProfileProvider>
              </AuthProvider>
            } 
          />
          
          {/* Core PMS routes */}
          <Route 
            path="/core/*"
            element={
              <AuthProvider>
                <ProfileProvider>
                  <CorePMSRoutes />
                </ProfileProvider>
              </AuthProvider>
            }
          />
          
          {/* Owner readonly dashboard - for owner_readonly role only */}
          <Route 
            path="/owner/dashboard"
            element={
              <AuthProvider>
                <ProfileProvider>
                  <OwnerReadOnlyDashboardPage />
                </ProfileProvider>
              </AuthProvider>
            }
          />
          
          {/* Tenant routes */}
          <Route 
            path="/tenant-login" 
            element={
              <TenantAuthProvider>
                <TenantApp />
              </TenantAuthProvider>
            } 
          />
          
          {/* OAuth callback */}
          <Route
            path="/oauth/google/callback"
            element={
              <AuthProvider>
                <GmailCallback />
              </AuthProvider>
            }
          />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </Router>
  );
}

export default App;
