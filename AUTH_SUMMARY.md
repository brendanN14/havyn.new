# Authentication System Summary

## Current Authentication Architecture

### Owner Authentication
**Location**: `src/contexts/AuthContext.tsx`
**System**: Supabase Auth (native)
**Storage**: `auth.users` table (Supabase managed)
**Methods**:
- `signIn(email, password)` → `supabase.auth.signInWithPassword()`
- `signUp(email, password)` → `supabase.auth.signUp()`
- `signOut()` → `supabase.auth.signOut()`
- Session check: `supabase.auth.getSession()`
- Auth state listener: `supabase.auth.onAuthStateChange()`

**Auth Checks**: 
- RLS policies on tables check `auth.uid() = user_id`
- Example: `tenant_insights_v2` table has policy: `USING (auth.uid() = user_id)`
- File: `supabase/migrations/20250101000001_create_tenant_insights_v2.sql` (line 54-58)

**Where Used**:
- `src/components/AuthForm.tsx` - Owner login/signup form
- `src/components/MainContent.tsx` - Owner app wrapper (uses `useAuth()` hook)
- `src/App.tsx` - Routes `/login` and `/dashboard` wrap with `AuthProvider`

### Tenant Authentication
**Location**: `src/contexts/TenantAuthContext.tsx`
**System**: Custom (NOT Supabase Auth)
**Storage**: `tenants` table with `password_hash` field
**Methods**:
- `verifyTenantName(name)` → Checks `tenant_insights` table for name match
- `signIn(email, password)` → Queries `tenants` table, verifies password hash
- `signUp(email, password, verifiedTenant)` → Creates/updates `tenants` record
- Session stored in `localStorage` as `tenantSession`

**Password Hashing**: 
- Simple demo hash: `demo_hash_${password}` (line 62-65 in TenantAuthContext.tsx)
- NOT secure - uses plain text comparison fallback (line 68-71)

**Auth Checks**:
- No RLS policies (tenants use direct table queries)
- Name verification against `tenant_insights` table (line 136-233)
- Email lookup in `tenants` table (line 241-245)

**Where Used**:
- `src/components/TenantLogin.tsx` - Tenant login form
- `src/components/TenantApp.tsx` - Tenant app wrapper
- `src/App.tsx` - Route `/tenant-login` wraps with `TenantAuthProvider`

### Roles
**Status**: **NONE** - No role system exists
- No role fields in `auth.users` metadata
- No profile table
- No role checks in code
- Only distinction: Owner (Supabase Auth) vs Tenant (custom auth) by portal

## Implementation Plan for Core PMS

1. Create `core_user_profiles` table with `role` field
2. Use Supabase Auth (existing owner auth system)
3. Add role-based routing after login
4. Store roles in profile table linked to `auth.users.id`







