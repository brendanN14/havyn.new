import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, LogOut, Building2, Home, ArrowLeft, FileText, Users, DollarSign, UserCheck, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Spinner, GradientBackground } from '../ui';
import { cn } from '../../utils/cn';

export function CorePMSLayout() {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, ensureProfile } = useProfile();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!profileLoading && !profile && user) {
      ensureProfile();
    }
  }, [profile, profileLoading, user, ensureProfile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <GradientBackground variant="subtle" className="min-h-screen transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md glass dark:glass-dark border-b border-white/20 dark:border-gray-700/50">
        <div className="flex justify-between items-center h-16 px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-gray-700/30 rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Legacy Dashboard
            </Link>
            <div className="h-6 w-px bg-gray-300/50 dark:bg-gray-600/50" />
            <img src="/havyn-icon.svg" alt="Havyn" className="h-12 w-auto" />
            <span className="px-2 py-1 text-xs font-medium bg-gradient-havyn-subtle dark:bg-gradient-havyn-dark text-havyn-primary dark:text-havyn-lightest rounded border border-havyn-primary/20">
              Core PMS (Beta)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="icon"
              size="sm"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">{user?.email}</span>
            <Button
              variant="icon"
              size="sm"
              onClick={() => setIsSidebarOpen(true)}
              title="Open menu"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <>
        <div
          className={cn(
            'fixed inset-0 z-40 transition-opacity duration-300',
            'backdrop-blur-sm bg-black/40 dark:bg-black/60',
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div
          className={cn(
            'fixed right-0 top-0 h-full w-80 z-50',
            'glass-strong dark:glass-dark-strong shadow-glass-lg',
            'border-l border-white/20 dark:border-gray-700/50',
            'transform transition-transform duration-300 ease-out',
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <div className="p-6 border-b border-white/20 dark:border-gray-700/50">
            <div className="flex items-center justify-between">
              <img src="/havyn-icon.svg" alt="Havyn" className="h-12 w-auto" />
              <Button
                variant="icon"
                size="sm"
                onClick={() => setIsSidebarOpen(false)}
                title="Close menu"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Core PMS
            </div>
            
            {[
              { path: '/core/dashboard', label: 'Dashboard', icon: Building2 },
              { path: '/core/properties', label: 'Properties', icon: Building2 },
              { path: '/core/units', label: 'Units', icon: Home },
              { path: '/core/leases', label: 'Leases', icon: FileText },
              { path: '/core/residents', label: 'Residents', icon: Users },
              { path: '/core/leads', label: 'Leads', icon: UserCheck },
              { path: '/core/collections', label: 'Collections', icon: DollarSign },
            ].map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
              return (
                <Button
                  key={path}
                  variant="ghost"
                  onClick={() => {
                    navigate(path);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full justify-start gap-3 transition-all duration-200',
                    isActive 
                      ? 'bg-gradient-havyn-subtle dark:bg-gradient-havyn-dark text-havyn-primary dark:text-havyn-lightest border-l-2 border-havyn-primary' 
                      : 'hover:bg-white/10 dark:hover:bg-gray-700/30'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </Button>
              );
            })}

            <div className="pt-4 border-t border-white/20 dark:border-gray-700/50">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Legacy
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  navigate('/dashboard');
                  setIsSidebarOpen(false);
                }}
                className="w-full justify-start gap-3 hover:bg-white/10 dark:hover:bg-gray-700/30"
              >
                <Building2 className="w-5 h-5" />
                <span>CSV/Insights Dashboard</span>
              </Button>
            </div>

            <div className="pt-4 border-t border-white/20 dark:border-gray-700/50">
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-3 text-red-600 dark:text-red-400 hover:bg-red-50/20 dark:hover:bg-red-900/20"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </Button>
            </div>
          </nav>
        </div>
      </>

      <main className="p-6">
        <Outlet />
      </main>
    </GradientBackground>
  );
}

