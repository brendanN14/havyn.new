# Havyn Codebase Context Report

## 1. What Havyn Does Today

Havyn is an AI-powered tenant analytics and property management platform designed for property owners to analyze tenant behavior, predict risks, and manage rental portfolios. The platform processes CSV files (rent rolls, delinquency reports, tenant directories) uploaded by property owners, merges the data, and sends it to AWS Lambda functions for AI-powered analysis. The system generates tenant scores (0-100), turnover risk predictions, delinquency forecasts, and actionable recommendations. It features dual portals: an owner dashboard for property managers to view insights, analyze property performance, and communicate with tenants, and a tenant portal where renters can view their scores, lease information, and make rent payments via Stripe. The platform also includes location-based market analysis, Gmail OAuth integration for email ingestion (partially implemented), and tenant communication tools via Resend (email) and Twilio (SMS).

## 2. Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Frontend: React + TypeScript + Tailwind CSS            │
│ - Vite build tool                                       │
│ - React Router for navigation                           │
│ - Chart.js for data visualization                       │
│ - Lucide React for icons                                │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Backend: Supabase                                       │
│ - PostgreSQL database (tenant_insights_v2, location_    │
│   insights, gmail_connections, tenants, payment_logs)   │
│ - Supabase Auth (owner authentication)                  │
│ - Edge Functions (Deno runtime)                         │
│ - Row Level Security (RLS) policies                     │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ AWS Lambda   │ │ Stripe API   │ │ Communication│
│ AI Engine    │ │ Payments     │ │ APIs         │
│ - Tenant     │ │ - Checkout   │ │ - Resend     │
│   insights   │ │   sessions   │ │   (Email)    │
│ - Location   │ │ - Webhooks   │ │ - Twilio     │
│   analysis   │ │              │ │   (SMS)      │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Background Jobs**: None - all processing is triggered synchronously via user actions (CSV upload → immediate processing → Lambda call). No cron jobs or queues detected.

**Integrations**:
- AWS Lambda (us-west-1) - Tenant & location AI analysis
- Stripe - Payment processing
- Resend - Email delivery
- Twilio - SMS delivery  
- Google OAuth - Gmail connection (partial implementation)

## 3. Feature Inventory

| Feature/Module | Where It Lives | Inputs | Outputs | Core/Exp/Demo | Dependencies | Reliability Risks |
|----------------|----------------|--------|---------|---------------|--------------|-------------------|
| **CSV Ingestion** | `src/components/Dashboard.tsx`, `supabase/functions/merge-data/index.ts` | CSV files (rent roll, delinquency, directory, or combined report) | Normalized tenant records (property, unit, tenant, rent, aging buckets, lease dates) | **Core** | papaparse library | CSV format variations can cause parsing failures. Name normalization logic is brittle. |
| **Tenant Scoring/AI Insights** | `supabase/functions/generate-insights/index.ts`, AWS Lambda `zv54onyhgk.execute-api.us-west-1.amazonaws.com/prod/insight` | Normalized tenant data array | Tenant scores (0-100), turnover_risk, predicted_delinquency, recommended_actions, reasoning_summary | **Core** | AWS Lambda endpoint (external, no fallback), Supabase database | Lambda failures cause complete insight generation failure. No retry logic. Response format inconsistencies observed in code. |
| **Location/Market Insights** | `supabase/functions/generate-location-insights/index.ts`, AWS Lambda `o5unvls7x8.execute-api.us-west-1.amazonaws.com/PROD/insight` | Property addresses | Market strength scores, vacancy rates, rent trends, competitor analysis | **Experimental** | AWS Lambda endpoint, location_insights table | Lambda dependency, manual coordinate mapping in Dashboard.tsx (propertyLatLng object) |
| **Gmail Ingestion** | `supabase/functions/oauth-google-start/index.ts`, `oauth-google-callback/index.ts`, `gmail-status/index.ts`, `src/components/GmailCallback.tsx` | OAuth code from Google, Gmail API access | OAuth tokens stored in gmail_connections table | **Experimental** | Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET), Gmail API | Incomplete implementation - no actual email parsing/pulling logic visible. Only OAuth flow exists. |
| **Tenant Portal** | `src/components/TenantApp.tsx`, `TenantDashboard.tsx`, `TenantLogin.tsx` | Tenant name verification, email/password | Tenant session, insight display, payment interface | **Core** | Custom tenants table (not Supabase Auth), tenant_insights_v2 for data lookup | Custom auth system with password hashing in Edge Function - security concerns vs Supabase Auth. Name matching may fail with variations. |
| **Owner Dashboard** | `src/components/Dashboard.tsx`, `MainContent.tsx` | User session (Supabase Auth) | Insight visualization, property grouping, risk charts, delinquency lists | **Core** | tenant_insights_v2 table, RLS policies | Heavy component with 2000+ lines - maintenance risk. Real-time subscriptions not consistently implemented. |
| **Payment Processing** | `supabase/functions/create-checkout-session/index.ts`, `check-payment-status/index.ts`, `src/components/RentPaymentModal.tsx` | Payment amount, tenant metadata | Stripe Checkout URL, payment_logs entries | **Core** | Stripe API (STRIPE_SECRET_KEY), payment_logs table | No webhook handler visible - relies on polling/status checks. Payment logs may not sync with actual Stripe events. |
| **Tenant Communication** | `supabase/functions/send-notification/index.ts`, `src/components/MessageTenantButton.tsx` | Message content, tenant email/phone | Email via Resend, SMS via Twilio, communication_logs entries | **Experimental** | Resend API, Twilio API (hardcoded credentials visible in code) | Twilio credentials hardcoded in function - security risk. No rate limiting. Error handling may silently fail. |
| **Lease Timeline** | `src/components/LeaseTimeline.tsx` | lease_end_date from insights | Visual timeline of upcoming lease expirations | **Core** | tenant_insights_v2.lease_end_date | Derived from CSV data - not a source of truth. No lease management beyond visualization. |
| **Historical Change Tracking** | `supabase/functions/generate-insights/index.ts` (compareInsights function) | Previous vs new insight records | changes JSONB field with old/new values | **Core** | previous_insight_id foreign key | Depends on previous_insight_id linkage - may break if insights deleted or orphaned. |
| **Data Preview** | `src/components/DataPreview.tsx` | Merged CSV data | Formatted table display of uploaded data | **Core** | None | Simple display component - low risk. |
| **Risk Visualization** | `src/components/RiskBar.tsx`, `RiskDistributionBar.tsx`, `RiskPieChart.tsx` | Insight scores and risk categories | Chart visualizations | **Core** | Chart.js, react-chartjs-2 | Standard library - low risk. |

## 4. Data Model Inventory

| Entity/Table | Key Fields | Source of Truth / Derived | Notes |
|--------------|------------|---------------------------|-------|
| **tenant_insights_v2** | id, tenant_name, tenant_score (0-100), renewal_recommendation, turnover_risk, predicted_delinquency, property, unit, rent_amount, past_due, delinquent_rent, aging_30/60/90/over_90, lease_start_date, lease_end_date, email, phone_number, reasoning_summary, recommended_actions[], changes (jsonb), report_id, previous_insight_id, user_id, created_at | **Derived** - Generated from CSV uploads via Lambda AI analysis | Primary insight storage. Contains both source data (rent, past_due) and AI-generated predictions. RLS enforced by user_id. |
| **location_insights** | id, property (address), user_id, rental_market_strength_score, vacancy_rate, rent_trend, new_construction_supply, competitor_summary, overall_market_summary, latitude, longitude, recent_news_summary, created_at | **Derived** - Generated from property addresses via Lambda | Market analysis data. Upsert logic on property+user_id conflict. |
| **gmail_connections** | id, user_id, email, access_token, refresh_token, expires_at, created_at, updated_at | **Source of Truth** - OAuth tokens from Google | Stores Gmail OAuth credentials. No actual email ingestion logic visible. |
| **tenants** | id, name, email, password_hash, phone, created_at | **Source of Truth** - Created via tenant signup | Custom tenant authentication table (not Supabase Auth). Used for tenant portal login. |
| **payment_logs** | payment_intent_id, tenant_name, property, unit, amount, payment_type, status, created_at | **Derived** - Created when Stripe checkout session created | Tracks payment attempts. Status may not reflect actual Stripe payment completion (no webhook handler visible). |
| **insight_reports** | id, user_id, created_at | **Source of Truth** - Created per insight generation run | Groups insights by generation batch. Referenced by tenant_insights_v2.report_id. |
| **communication_logs** | (referenced in code but schema not visible in migrations) | **Derived** - Created when sending notifications | Logs email/SMS communication attempts. Schema not found in migrations - may not exist. |
| **auth.users** | (Supabase managed) | **Source of Truth** - Owner authentication | Standard Supabase Auth table for property owner accounts. |

**Key Observations**:
- No `properties` table - property names are stored as text strings in tenant_insights_v2
- No `units` table - units are text fields
- No `leases` table - lease data (dates) stored directly in insights
- No `transactions` or `ledger` table - no accounting/financial record-keeping
- No `maintenance_requests` or work order system
- No `applications` or leasing workflow tables

## 5. Ingestion and Sync Paths

### CSV Ingestion Flow

**Source**: Manual file upload via `src/components/FileUpload.tsx`
- Supports 3-file upload (delinquency report, rent roll, tenant directory) OR
- Single combined report file
- Files converted to base64 in frontend (`Dashboard.tsx:926-970`)

**Processing** (`supabase/functions/merge-data/index.ts`):
1. Base64 → CSV parsing using `csv-parse` library
2. Name normalization: `cleanName()` function removes punctuation, normalizes whitespace, handles "Last, First" format
3. Record matching: Creates composite key `${property}-${unit}-${cleanName(tenant)}` to match across files
4. Data merging: Combines rent roll (base) + delinquency (aging buckets, notes) + directory (contact info)
5. Validation: Filters rows where Status !== 'Current', removes summary rows, validates required fields
6. Returns JSON array to frontend (no database write at this stage)

**Storage**: Data stored in React state (`mergedData`) until user triggers insight generation

**Triggers**: Manual user action - clicking "Generate Insights" button in Dashboard

### Gmail Ingestion Flow

**Status**: **INCOMPLETE** - Only OAuth flow implemented, no actual email ingestion

**OAuth Flow**:
1. User clicks "Connect Gmail" → `supabase/functions/oauth-google-start` generates OAuth URL
2. Redirect to Google → User authorizes → Redirect back with code
3. `supabase/functions/oauth-google-callback` exchanges code for tokens
4. Tokens stored in `gmail_connections` table (access_token, refresh_token, expires_at)
5. Connection status checked via `supabase/functions/gmail-status` (reads from gmail_connections)

**Missing**:
- No Gmail API calls to fetch emails
- No email parsing logic
- No extraction of rent roll/delinquency data from emails
- No scheduled sync (cron, queue, or manual trigger)
- No deduplication logic

**Scheduling**: None - no cron jobs, queues, or scheduled sync mechanisms found in codebase

## 6. Tenant Scoring / Insights

**Where Scoring Runs**: 
- AWS Lambda function at `zv54onyhgk.execute-api.us-west-1.amazonaws.com/prod/insight`
- Invoked via `supabase/functions/generate-insights/index.ts`

**Triggers**:
- Manual user action: User uploads CSV → merges data → clicks "Generate Insights" button
- No automatic recomputation on data changes
- No scheduled re-scoring (cron, etc.)
- Previous insights linked via `previous_insight_id` for change detection

**Inputs to Lambda**:
```typescript
{
  tenants: Array<{
    property, unit, tenant, rentAmount, pastDue, delinquentRent,
    aging30/60/90/over90, tenureMonths, latePaymentRate,
    leaseEndDate, moveInDate, phoneNumbers, emails
  }>,
  user_id: string,
  job_id?: string (optional)
}
```

**Output Fields** (from Lambda, stored in tenant_insights_v2):
- `tenant_score`: integer 0-100
- `renewal_recommendation`: text (likely "Renew" / "Do Not Renew" / "Conditional")
- `turnover_risk`: text ("low" / "medium" / "high")
- `predicted_delinquency`: text ("low" / "medium" / "high")
- `raise_rent_opportunity`: boolean
- `retention_outreach_needed`: boolean
- `high_delinquency_alert`: boolean
- `notes_analysis`: text (AI-generated analysis)
- `recommended_actions`: string array
- `reasoning_summary`: text (explanation of score)

**Processing Flow**:
1. Frontend calls `generate-insights` Edge Function with tenant data array
2. Function creates `insight_reports` record
3. Function calls AWS Lambda with tenant data
4. Lambda returns insights array
5. Function maps Lambda response to database schema, enriches with source data (rent, past_due, etc.)
6. Inserts into `tenant_insights_v2`
7. Function calls `updateInsightWithHistory()` to compare with previous insights and populate `changes` JSONB field
8. Returns insights to frontend

**Current Limitations**:
- **No retry logic** - Lambda failures cause complete failure
- **Response format inconsistencies** - Code handles multiple Lambda response shapes (array, {body: array}, {statusCode, ...}), suggesting instability
- **Synchronous processing** - Blocks until Lambda completes (no async job queue)
- **No partial success handling** - All tenants processed or none
- **No model versioning** - Can't track which AI model version generated insights
- **Hard dependency on external Lambda** - No fallback or local scoring option
- **Change detection only works if previous_insight_id links correctly** - May fail if insights deleted/recreated

## 7. Gaps for PMS-First Roadmap

To become a real Property Management System + Leasing Hub, the following are **missing**:

### Core PMS Features
- **General Ledger / Accounting**: No transactions table, no double-entry bookkeeping, no chart of accounts, no financial reporting
- **Unit Management**: No `units` table with unit details (bedrooms, bathrooms, sqft, amenities, status), no unit-level rent roll
- **Properties Master Data**: No `properties` table (addresses, ownership, management details, tax info)
- **Lease Management**: No `leases` table with lease terms, rent escalations, renewals, amendments. Lease dates stored only in insights.
- **Rent Roll as Source of Truth**: Current rent roll is CSV upload → insights. Need persistent rent roll table that updates over time.
- **Receivables/Payables**: No AR/AP tracking, no vendor management, no expense tracking
- **Maintenance Management**: No work orders, maintenance requests, vendor assignments, or maintenance history
- **Document Management**: No lease document storage, no file attachments, no document signing workflow

### Leasing Hub Features
- **Applicant Management**: No `applicants` table, no application workflow, no credit checks, no screening
- **Leasing Pipeline**: No stages (inquiry → application → approval → lease signing → move-in)
- **Unit Availability**: No vacancy tracking, no unit availability calendar, no showing scheduling
- **Lease Generation**: No lease document templates, no e-signature integration (beyond Stripe Checkout)
- **Application Fees / Deposits**: Stripe integration exists but no application-specific payment flows

### Data Integrity
- **Audit Trails**: Limited to `changes` JSONB in insights. No comprehensive audit log table.
- **Data Validation**: CSV parsing has basic validation but no business rule enforcement (e.g., rent can't be negative, lease end > lease start)
- **Data Sync**: No reconciliation between uploaded CSV and database state. Manual uploads don't merge with existing data intelligently.

### Integration Gaps
- **Banking Integration**: No bank account connections, no automatic rent collection, no ACH processing
- **Accounting Software**: No QuickBooks/Xero integration
- **PMS Integrations**: No AppFolio/Buildium/Yardi integration for data sync
- **Background Checks**: No integration with screening services (TransUnion, etc.)

## 8. Recommendations

### Remove (Technical Debt / Unused)
1. **Gmail Integration (OAuth only)** - Remove `oauth-google-start`, `oauth-google-callback`, `gmail-status`, `GmailCallback.tsx` unless email ingestion is prioritized. Currently incomplete and adds complexity.
2. **Location Insights Lambda dependency** - If not actively used, remove `generate-location-insights` function. Market analysis can be added later with better data sources.
3. **Hardcoded credentials** - Remove hardcoded Twilio credentials from `send-notification/index.ts` (lines 252-254 in API_INTEGRATION_GUIDE.md). Move to environment variables.
4. **Debug code** - Remove `debugSupabase` function from `Dashboard.tsx` (line 30-49) and `showDebugPanel` state/logic.

### Keep (Core Functionality)
1. **CSV ingestion pipeline** (`merge-data` function) - Well-structured, handles multiple file formats. Keep but add validation.
2. **Tenant scoring system** - Core differentiator. Keep but add retry logic and error handling.
3. **Owner Dashboard UI** - Functional but needs refactoring (2000+ lines). Keep UI, refactor component structure.
4. **Tenant Portal** - Working payment flow and insight display. Keep but migrate to Supabase Auth.
5. **Stripe Payment Integration** - Working checkout flow. Keep but add webhook handler for payment completion.
6. **Historical change tracking** - Useful feature. Keep `changes` JSONB and `previous_insight_id` logic.

### Refactor (Improve Without Rebuilding)
1. **Dashboard.tsx** - Break into smaller components (currently 2372 lines). Extract: PropertyGrouping, InsightFilters, DelinquencyView, LeaseTimelineView.
2. **Tenant Authentication** - Migrate from custom `tenants` table to Supabase Auth. Current custom password hashing is security risk.
3. **Error Handling** - Add retry logic for Lambda calls, better error messages, graceful degradation when Lambda fails.
4. **Data Model** - Create `properties` and `units` tables, migrate property/unit strings to foreign keys. This enables proper property management.
5. **Payment Webhooks** - Add Stripe webhook handler to update `payment_logs` and reconcile payments with rent roll automatically.
6. **CSV Validation** - Add business rule validation (positive rent, valid dates, etc.) in `merge-data` function.

### Build New (For PMS Roadmap)
1. **Properties & Units Master Data**
   - Create `properties` table (id, name, address, ownership, management_company, created_at)
   - Create `units` table (id, property_id, unit_number, bedrooms, bathrooms, sqft, rent, status, created_at)
   - Migrate existing property/unit strings to foreign keys
   - **Priority**: High - Foundation for all PMS features

2. **Lease Management**
   - Create `leases` table (id, unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, status, created_at)
   - Link `tenant_insights_v2` to leases via tenant_name + unit_id
   - Add lease renewal workflow
   - **Priority**: High - Required for lease expirations, renewals

3. **Transactions / Ledger**
   - Create `transactions` table (id, lease_id, type, amount, date, description, payment_method, stripe_payment_id)
   - Link Stripe payments to transactions automatically
   - Create rent charges automatically based on leases
   - **Priority**: High - Core accounting functionality

4. **Rent Roll as Source of Truth**
   - Create `rent_roll_entries` table (id, unit_id, lease_id, rent_amount, due_date, status, paid_date, created_at)
   - Replace CSV upload with API/sync that updates rent roll entries
   - Generate insights from rent roll entries instead of CSV
   - **Priority**: High - Enables real-time rent tracking

5. **Applicant Management (Leasing Hub)**
   - Create `applicants` table (id, name, email, phone, property_id, unit_id, application_date, status, created_at)
   - Add application workflow stages
   - Link to Stripe for application fees
   - **Priority**: Medium - Needed for leasing hub but can come after core PMS

6. **Maintenance Requests**
   - Create `maintenance_requests` table (id, unit_id, tenant_id, description, priority, status, created_at, completed_at)
   - Add vendor assignment and work order tracking
   - **Priority**: Medium - Common PMS feature but not critical for pilot

### Quick Wins for Pilot Property Goal
1. **Properties & Units tables** (2-3 days) - Enables proper property/unit management
2. **Leases table** (1-2 days) - Enables lease expiration tracking and renewals
3. **Transactions table + Stripe webhook** (2-3 days) - Automatic rent payment reconciliation
4. **Rent roll entries table** (2-3 days) - Replace CSV upload with persistent rent roll
5. **Refactor Dashboard component** (2-3 days) - Improve maintainability

**Total Quick Wins Timeline**: ~2 weeks to have basic PMS structure in place for single property pilot.







