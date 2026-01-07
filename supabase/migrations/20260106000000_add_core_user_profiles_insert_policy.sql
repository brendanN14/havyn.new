/*
  # Add INSERT policy for core_user_profiles

  The core_user_profiles table was missing an INSERT policy, which prevented
  authenticated users from creating their own profile. This migration adds
  the missing policy.
*/

-- Add INSERT policy for core_user_profiles
CREATE POLICY "Users can insert their own profile"
  ON core_user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

