import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type UserRole = 'platform_admin' | 'property_manager' | 'leasing_agent' | 'owner_readonly';

interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  role: UserRole | null;
  error: string | null;
  ensureProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initInProgress = useRef(false);

  const logError = useCallback((context: string, err: any) => {
    const errorInfo = {
      context,
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
      file: 'ProfileContext.tsx'
    };
    console.error(`[ProfileContext] ${context}:`, errorInfo);
    
    // Don't set error for conflict (duplicate) - we'll handle it by fetching
    if (err?.code === '23505' || err?.message?.includes('duplicate') || err?.message?.includes('conflict')) {
      return; // Don't set error state for duplicates
    }
    
    if (err?.code === '42501' || err?.message?.includes('row-level security')) {
      setError(`Permission denied: ${err.message}. Check RLS policies for core_user_profiles table.`);
    } else if (err?.code === 'PGRST116' || err?.message?.includes('does not exist')) {
      setError(`Table not found. Please ensure the Core PMS migration has been applied.`);
    } else {
      setError(err?.message || 'An unexpected error occurred');
    }
  }, []);

  // Helper to fetch profile
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error: fetchError } = await supabase
      .from('core_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logError('Fetching profile', fetchError);
      return null;
    }

    return data;
  }, [logError]);

  // Helper to create profile with conflict handling
  const createProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Check if this is the first user (assign platform_admin)
    const { count, error: countError } = await supabase
      .from('core_user_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError && countError.code !== 'PGRST116') {
      console.warn('[ProfileContext] Error counting profiles, defaulting to property_manager:', countError);
    }

    const role: UserRole = (count === 0 || count === null) ? 'platform_admin' : 'property_manager';

    // Try to create profile
    const { data: newProfile, error: insertError } = await supabase
      .from('core_user_profiles')
      .insert({
        user_id: userId,
        role
      })
      .select()
      .single();

    if (insertError) {
      // Handle conflict (409) or duplicate key (23505) - profile was created by another request
      if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('conflict')) {
        console.log('[ProfileContext] Profile already exists (conflict), fetching existing...');
        return await fetchProfile(userId);
      }
      logError('Creating profile', insertError);
      return null;
    }

    console.log('[ProfileContext] Profile created successfully:', { role, userId });
    return newProfile;
  }, [fetchProfile, logError]);

  const ensureProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      // First check if profile exists
      let existingProfile = await fetchProfile(user.id);
      
      if (existingProfile) {
        setProfile(existingProfile);
        setError(null);
        return;
      }

      // Create profile
      const newProfile = await createProfile(user.id);
      if (newProfile) {
        setProfile(newProfile);
        setError(null);
      }
    } catch (err: any) {
      logError('ensureProfile (catch)', err);
    }
  }, [user?.id, fetchProfile, createProfile, logError]);

  // Automatically fetch or create profile when user logs in
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      setError(null);
      initInProgress.current = false;
      return;
    }

    // Prevent concurrent initialization
    if (initInProgress.current) {
      return;
    }

    const initProfile = async () => {
      initInProgress.current = true;
      setLoading(true);
      
      try {
        // First try to fetch existing profile
        let existingProfile = await fetchProfile(user.id);

        if (existingProfile) {
          setProfile(existingProfile);
          setError(null);
          setLoading(false);
          initInProgress.current = false;
          return;
        }

        // No profile exists - create one automatically
        console.log('[ProfileContext] No profile found, creating for user:', user.id);
        
        const newProfile = await createProfile(user.id);
        
        if (newProfile) {
          setProfile(newProfile);
          setError(null);
        } else {
          // One more attempt to fetch in case of race condition
          const retryProfile = await fetchProfile(user.id);
          if (retryProfile) {
            setProfile(retryProfile);
            setError(null);
          }
        }
      } catch (err: any) {
        logError('initProfile (catch)', err);
      } finally {
        setLoading(false);
        initInProgress.current = false;
      }
    };

    initProfile();
  }, [user?.id, fetchProfile, createProfile, logError]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        role: profile?.role || null,
        error,
        ensureProfile
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
