import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { Loader2 } from 'lucide-react';

/**
 * AuthRedirect - Industry standard route guard component
 * 
 * Handles authentication state and redirects users to appropriate routes:
 * - Unauthenticated users → Login form
 * - owner_readonly role → /owner/dashboard
 * - All other roles → /core/dashboard
 * 
 * This component ONLY handles redirects - it never renders children.
 * Use ProtectedRoute for routes that should render content after auth.
 */
export function AuthRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  // Show loading while auth or profile is being determined
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-havyn-primary" />
      </div>
    );
  }

  // Not logged in - show nothing (parent will render AuthForm)
  if (!user) {
    return null;
  }

  // User exists but profile still loading/missing - show loading
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-havyn-primary" />
      </div>
    );
  }

  // Determine redirect destination based on role
  if (profile.role === 'owner_readonly') {
    return <Navigate to="/owner/dashboard" replace state={{ from: location }} />;
  }

  // All other roles go to Core PMS
  return <Navigate to="/core/dashboard" replace state={{ from: location }} />;
}

/**
 * ProtectedRoute - Wraps routes that require authentication
 * 
 * If user is not authenticated, redirects to /login
 * If user is authenticated, renders children
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  // Show loading while determining auth state
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-havyn-primary" />
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Waiting for profile
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <Loader2 className="w-12 h-12 animate-spin text-havyn-primary" />
      </div>
    );
  }

  // Check role requirements if specified
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(profile.role)) {
      // User doesn't have required role - redirect to their appropriate dashboard
      if (profile.role === 'owner_readonly') {
        return <Navigate to="/owner/dashboard" replace />;
      }
      return <Navigate to="/core/dashboard" replace />;
    }
  }

  // User is authenticated and authorized - render children
  return <>{children}</>;
}

