import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Menu, Sun, Moon, LogOut, Building2, Home, ArrowLeft, FileText, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useTheme } from '../../contexts/ThemeContext';

export function CorePMSLayout() {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, ensureProfile } = useProfile();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
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
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-havyn-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="flex justify-between items-center h-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Legacy Dashboard
          </Link>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <img src="/havyn-icon.svg" alt="Havyn" className="h-24 w-auto" />
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
            Core PMS (Beta)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <span className="text-sm text-havyn-primary dark:text-green-400 font-medium">{user?.email}</span>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-havyn-primary dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <>
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40 ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div
          className={`fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl transform transition-transform z-50 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-8 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <img src="/havyn-icon.svg" alt="Havyn" className="h-16 w-auto" />
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Core PMS (Beta)
            </div>
            <button
              onClick={() => {
                navigate('/core/dashboard');
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Building2 className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => {
                navigate('/core/properties');
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Building2 className="w-5 h-5" />
              <span>Properties</span>
            </button>
            <button
              onClick={() => {
                navigate('/core/units');
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Home className="w-5 h-5" />
              <span>Units</span>
            </button>
            <button
              onClick={() => {
                navigate('/core/leases');
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FileText className="w-5 h-5" />
              <span>Leases</span>
            </button>
            <button
              onClick={() => {
                navigate('/core/residents');
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Users className="w-5 h-5" />
              <span>Residents</span>
            </button>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Legacy
              </div>
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Building2 className="w-5 h-5" />
                <span>CSV/Insights Dashboard</span>
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </button>
            </div>
          </nav>
        </div>
      </>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

