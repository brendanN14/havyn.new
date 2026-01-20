# Havyn UI/UX Audit & Design Specification

## 1) Current UI Map

### Core PMS Routes (under `/core/*`)

| Route | Component | Primary Purpose | Main Components | User Actions |
|-------|-----------|-----------------|-----------------|--------------|
| `/core/dashboard` | `CoreDashboard.tsx` | Main dashboard with KPIs and today's queue | Property selector, KPI cards, Delinquency queue table, Expiring leases table, Vacant units table | View KPIs, filter by property, open lease/unit detail |
| `/core/properties` | `CorePropertiesPage.tsx` | Property list/management | Property cards (grid), Create property modal | Create property, edit property, delete property, navigate to property detail |
| `/core/properties/:propertyId` | `CorePropertyDetailPage.tsx` | Property hub with tabs | Header, KPI strip, Tab navigation | Switch tabs (Units, Leases, Residents, Collections) |
| `/core/properties/:propertyId/units` | `PropertyScopedUnitsPage.tsx` | Property-scoped units list | Unit cards/grid, Bulk add units modal | View units, bulk add units, navigate to unit detail |
| `/core/properties/:propertyId/leases` | `PropertyScopedLeasesPage.tsx` | Property-scoped leases list | Leases table, Create lease modal, Lease detail modal | Create lease, view lease details, edit lease |
| `/core/properties/:propertyId/residents` | `PropertyScopedResidentsPage.tsx` | Property-scoped residents list | Residents table, Lease detail modal | View resident ledger |
| `/core/properties/:propertyId/collections` | `PropertyScopedCollectionsPage.tsx` | Property-scoped delinquency queue | Delinquency table, Tenant detail drawer | View delinquent leases, mark contacted, set promise-to-pay, log notes |
| `/core/units` | `CoreUnitsPage.tsx` | Global units list | Property filter tabs, Unit cards/grid, Vacancy board view | Filter by property, view units, bulk add, toggle vacancy board |
| `/core/units/:unitId` | `UnitDetailPage.tsx` | Unit detail page | Unit header, Lease info, Financial summary, Quick actions | View unit details, navigate to lease/resident, draft outreach |
| `/core/leases` | `CoreLeasesPage.tsx` | Global leases list | Property filter, Leases table, Create lease modal | Filter by property, create lease, view lease details |
| `/core/residents` | `CoreResidentsPage.tsx` | Global residents list | Property filter, Residents table | Filter by property, view resident ledger |
| `/core/financial` | `CoreInsightsPage.tsx` | Financial/delinquency insights | Delinquency table, Filters (category, days past due), Tenant detail drawer | Filter delinquencies, mark contacted, set promise-to-pay, log notes |
| `/core/delinquency` | `CoreInsightsPage.tsx` | Delinquency queue (alias) | Same as `/core/financial` | Same as `/core/financial` |
| `/core/collections` | `CoreInsightsPage.tsx` | Collections queue (alias) | Same as `/core/financial` | Same as `/core/financial` |
| `/core/setup` | `CoreSetupWizard.tsx` | Onboarding wizard | 3-step wizard (Property → Units → Finish), Demo data button | Create first property, add units, create demo data |

### Legacy Routes

| Route | Component | Primary Purpose | Main Components | User Actions |
|-------|-----------|-----------------|-----------------|--------------|
| `/dashboard` | `Dashboard.tsx` (via `MainContent.tsx`) | Legacy CSV-based insights dashboard | File upload, Data preview, Property groups, Metric cards, Delinquency list, Location insights | Upload CSV, view insights, generate analysis |
| `/owner/dashboard` | `Dashboard.tsx` (via `MainContent.tsx`) | Owner readonly dashboard | Same as `/dashboard` | Same as `/dashboard` (read-only) |

### Common Components

| Component | File Path | Purpose | Usage |
|-----------|-----------|---------|-------|
| `LeaseDetailModal` | `src/components/core/LeaseDetailModal.tsx` | Full lease detail with ledger | Used across leases/residents/units pages |
| `TransactionModal` | `src/components/core/TransactionModal.tsx` | Post transactions (rent/payment/charge/credit) | Used in lease detail modal |
| `TenantDetailDrawer` | `src/components/core/TenantDetailDrawer.tsx` | Tenant detail with ledger/comms/insights | Used in delinquency/collections pages |
| `CreatePropertyModal` | `src/components/core/CreatePropertyModal.tsx` | Create/edit property | Used in properties page |
| `CreateLeaseModal` | `src/components/core/CreateLeaseModal.tsx` | Create lease | Used in leases pages |
| `BulkAddUnitsModal` | `src/components/core/BulkAddUnitsModal.tsx` | Bulk add units via paste | Used in units pages |
| `VacancyBoard` | `src/components/core/VacancyBoard.tsx` | Vacancy board view | Used in units page |
| `SummarizeTenantModal` | `src/components/core/SummarizeTenantModal.tsx` | AI tenant summary | Used in lease detail modal |
| `DraftOutreachModal` | `src/components/core/DraftOutreachModal.tsx` | AI message draft | Used in lease detail modal |

### Layout Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| `CorePMSLayout` | `src/components/core/CorePMSLayout.tsx` | Core PMS app shell (header + sidebar + main) |
| `MainContent` | `src/components/MainContent.tsx` | Legacy dashboard layout (header + sidebar + main) |
| `NavigationSidebar` | `src/components/NavigationSidebar.tsx` | Legacy sidebar navigation |

---

## 2) Visual Consistency Audit

### Typography Inconsistencies

**Headings:**
- Page titles: `text-3xl font-bold` (CorePropertiesPage, CoreUnitsPage, CoreLeasesPage) vs `text-xl font-semibold` (LeaseDetailModal) vs `text-2xl font-bold` (CoreDashboard KPI cards)
- Section headings: Mix of `text-lg font-semibold`, `text-xl font-semibold`, `text-base font-semibold`
- Subheadings: Inconsistent use of `text-sm font-medium`, `text-sm font-semibold`, `text-xs font-medium`

**Body Text:**
- Labels: Mix of `text-sm text-gray-600`, `text-sm text-gray-500`, `text-xs text-gray-500`
- Descriptions: Mix of `text-gray-600`, `text-gray-500`, `text-gray-400` with various sizes

**Examples:**
- `CorePropertiesPage.tsx:94`: `<h1 className="text-3xl font-bold">`
- `CoreUnitsPage.tsx:149`: `<h1 className="text-3xl font-bold">`
- `CoreDashboard.tsx` (KPI cards): `<p className="text-2xl font-bold">`
- `LeaseDetailModal.tsx:394`: `<h2 className="text-xl font-semibold">`

### Spacing Inconsistencies

**Container Padding:**
- Page containers: `p-6` (CorePropertiesPage, CoreUnitsPage) vs `p-4 sm:p-6 lg:p-8` (MainContent header) vs no padding on some modals
- Section spacing: `space-y-6` vs `space-y-4` vs `gap-6` vs `gap-4`

**Button Padding:**
- Primary buttons: `px-4 py-2` (most places) vs `px-3 py-2` (some navigation) vs `p-2` (icon buttons)
- Inconsistent gaps: `gap-2` vs `gap-3` vs `gap-4`

**Examples:**
- `CorePropertiesPage.tsx:91`: `<div className="p-6 space-y-6">`
- `CoreUnitsPage.tsx:146`: `<div className="p-6 space-y-6">`
- `LeaseDetailModal.tsx:326`: `<div className="p-6 overflow-y-auto flex-1">`
- `CorePMSLayout.tsx:36`: `<div className="flex justify-between items-center h-20 px-4 sm:px-6 lg:px-8">`

### Color Inconsistencies

**Primary Color:**
- Custom color `havyn-primary` (`#3F6B28` - dark green) used inconsistently
- Some places use `bg-havyn-primary` with `dark:text-green-400` (mismatch)
- Some buttons use `bg-blue-600` (Draft Outreach) vs `bg-purple-600` (Summarize Tenant) vs `bg-havyn-primary`
- Legacy dashboard uses different color scheme entirely

**Neutral Colors:**
- Backgrounds: Mix of `bg-white`, `bg-gray-50`, `bg-gray-100`, `bg-gradient-to-br from-gray-50 to-gray-100`
- Borders: Mix of `border-gray-200`, `border-gray-300`, `border-gray-700` in dark mode
- Text: Inconsistent gray scales (`text-gray-600`, `text-gray-500`, `text-gray-400`)

**Status Colors:**
- Success: Mix of `text-green-600`, `bg-green-50`, `border-green-200`
- Warning: Mix of `text-yellow-800`, `bg-yellow-50`, `border-yellow-200`
- Danger: Mix of `text-red-600`, `bg-red-50`, `border-red-200`
- Info: Mix of `text-blue-600`, `bg-blue-50`, `border-blue-200`

**Examples:**
- `CorePropertiesPage.tsx:102`: `bg-havyn-primary` (consistent)
- `LeaseDetailModal.tsx:401`: `bg-purple-600` (inconsistent - AI button)
- `LeaseDetailModal.tsx:432`: `bg-blue-600` (inconsistent - outreach button)
- `CoreDashboard.tsx` (KPI cards): Custom gradient backgrounds
- Dark mode fallbacks: Some components use `dark:text-green-400` instead of `dark:text-havyn-primary`

### Border Inconsistencies

**Radius:**
- Mix of `rounded-lg` (most common), `rounded-md`, `rounded-sm`, `rounded-xl`
- Buttons: Mostly `rounded-lg`, some use `rounded`
- Cards: Mix of `rounded-lg` and `rounded`
- Modals: `rounded-lg` for containers

**Width:**
- Mix of `border`, `border-2`, `border-4` (for tooltip arrows)
- No consistent border width system

**Examples:**
- `CorePropertiesPage.tsx:110`: `rounded-lg` (error banner)
- `CorePropertiesPage.tsx:144`: `rounded-lg` (property card)
- `LeaseDetailModal.tsx:438`: `rounded-lg` (tooltip)
- `LeaseDetailModal.tsx:454`: `rounded-lg` (ledger summary card)

### Shadow Inconsistencies

**Card Shadows:**
- Mix of `shadow`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`
- Hover states: `hover:shadow-lg`, `hover:shadow-md`
- Modals: `shadow-xl`

**Examples:**
- `CorePropertiesPage.tsx:144`: `shadow` + `hover:shadow-lg`
- `CorePMSLayout.tsx:77`: `shadow-xl` (sidebar)
- `LeaseDetailModal.tsx:234`: No shadow on backdrop div

### Button Style Inconsistencies

**Primary Buttons:**
- Most use: `px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark`
- Some use: `px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700` (Draft Outreach)
- Some use: `px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700` (Summarize Tenant)
- Some use: `px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700` (Record Payment)

**Secondary Buttons:**
- Mix of: `px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`
- Some use: `px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`

**Icon Buttons:**
- Mix of: `p-1`, `p-2`, `p-3`
- Inconsistent hover states

**Disabled States:**
- Mix of: `disabled:opacity-50 disabled:cursor-not-allowed` vs `disabled:opacity-50` only

**Examples:**
- `CorePropertiesPage.tsx:102`: Primary button (consistent)
- `LeaseDetailModal.tsx:401`: `bg-purple-600` (AI button - inconsistent)
- `LeaseDetailModal.tsx:432`: `bg-blue-600` (outreach button - inconsistent)
- `CoreUnitsPage.tsx:157`: Secondary button (consistent)

### Table Style Inconsistencies

**Table Structure:**
- Some tables use `min-w-full divide-y divide-gray-200 dark:divide-gray-700`
- Some use `min-w-full` without consistent dividers
- Inconsistent header styling: `px-4 py-3`, `px-6 py-4`, `px-6 py-3`

**Header Cells:**
- Mix of: `text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`
- Some use: `bg-gray-50 dark:bg-gray-900`, some don't
- Inconsistent padding

**Body Cells:**
- Mix of: `px-4 py-3`, `px-6 py-4`, `px-4 py-4`
- Inconsistent text sizes: `text-sm`, `text-xs`
- Inconsistent hover states

**Examples:**
- `CoreInsightsPage.tsx`: Table headers use `px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`
- `LeaseDetailModal.tsx:527`: Table headers use `px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`
- `CoreLeasesPage.tsx`: Inconsistent cell padding

### Modal Style Inconsistencies

**Modal Containers:**
- Backdrop: `bg-black bg-opacity-50` (consistent)
- Container: Mix of `max-w-4xl`, `max-w-5xl`, `max-w-2xl`, `w-full max-w-2xl`
- Padding: Mix of `p-4`, `p-6`, `px-6 py-4`
- Border radius: Mostly `rounded-lg`, some `rounded-xl`

**Modal Headers:**
- Inconsistent padding: `p-6`, `px-6 py-4`, `p-4`
- Inconsistent border: `border-b border-gray-200 dark:border-gray-700` vs no border

**Modal Footer:**
- Inconsistent padding: `p-6`, `px-6 py-4`
- Inconsistent border: `border-t border-gray-200 dark:border-gray-700` vs no border

**Examples:**
- `LeaseDetailModal.tsx:231`: `max-w-5xl`
- `TransactionModal.tsx`: `max-w-2xl`
- `SummarizeTenantModal.tsx`: `max-w-2xl`

### Empty State Inconsistencies

**Structure:**
- Some use centered layout with icon + heading + description + button
- Some use different icon sizes: `w-16 h-16` vs `w-12 h-12`
- Inconsistent text colors and sizes
- Inconsistent button placement

**Examples:**
- `CorePropertiesPage.tsx:125`: Centered, icon `w-16 h-16`, heading `text-lg font-semibold`, button below
- `CoreUnitsPage.tsx:226`: Centered, icon `w-16 h-16`, heading `text-lg font-semibold`, button below
- Some pages have no empty state at all

### Loading State Inconsistencies

**Spinners:**
- Mix of: `Loader2` component with different sizes (`w-8 h-8`, `w-12 h-12`)
- Inconsistent colors: `text-havyn-primary`, `text-gray-400`, `animate-spin`
- Inconsistent container: Some centered with flex, some inline

**Examples:**
- `CorePropertiesPage.tsx:85`: `<Loader2 className="w-8 h-8 animate-spin text-havyn-primary" />` in centered flex container
- `CorePMSLayout.tsx:29`: `<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-havyn-primary"></div>`

### Icon Inconsistencies

**Sizes:**
- Mix of: `w-4 h-4`, `w-5 h-5`, `w-6 h-6`, `w-8 h-8`, `w-16 h-16`
- No clear system for icon sizes

**Colors:**
- Icons use various colors: `text-havyn-primary`, `text-gray-400`, `text-gray-600`, `text-blue-600`
- Some icons inherit text color, some have explicit colors

**Examples:**
- Buttons: Mostly `w-4 h-4` or `w-5 h-5`
- Empty states: `w-16 h-16`
- Navigation: `w-5 h-5`

### "Vibe-Coded" Patterns (Random Tailwind Usage)

1. **Gradient Backgrounds:**
   - `LeaseDetailModal.tsx:454`: `bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800` (unnecessary gradient)
   - Some KPI cards use gradients, some don't

2. **Complex Conditional Classes:**
   - `LeaseDetailModal.tsx:423-433`: Inline IIFE for button disable logic creates deeply nested conditional classes
   - Many components have ternary operators for className strings making them hard to read

3. **Inconsistent Dark Mode Patterns:**
   - Some use `dark:bg-gray-800`, some use `dark:bg-gray-900`
   - Some use `dark:text-green-400` as fallback for `havyn-primary` instead of creating a dark mode token

4. **Magic Numbers:**
   - Various z-index values: `z-40`, `z-50`, no system
   - Various max-widths: `max-w-2xl`, `max-w-4xl`, `max-w-5xl`, no system

5. **Mixed Spacing Units:**
   - Mix of `space-y-6`, `gap-6`, `gap-4`, `space-y-4`
   - No clear 8px grid system

---

## 3) Component Inventory

### Reusable Components (Existing)

| Component | File | Reusability | Status |
|-----------|------|-------------|--------|
| `MetricCard` | `src/components/MetricCard.tsx` | High | Used in legacy dashboard, could be standardized |
| `InsightCard` | `src/components/InsightCard.tsx` | Medium | Used in legacy dashboard, specific to insights |
| `LeaseDetailModal` | `src/components/core/LeaseDetailModal.tsx` | High | Reusable but needs standardization |
| `TransactionModal` | `src/components/core/TransactionModal.tsx` | High | Good pattern, reusable |
| `CreatePropertyModal` | `src/components/core/CreatePropertyModal.tsx` | High | Reusable pattern |
| `CreateLeaseModal` | `src/components/core/CreateLeaseModal.tsx` | High | Reusable pattern |
| `BulkAddUnitsModal` | `src/components/core/BulkAddUnitsModal.tsx` | Medium | Specific use case |
| `VacancyBoard` | `src/components/core/VacancyBoard.tsx` | Medium | Specific view, could be standardized |
| `SummarizeTenantModal` | `src/components/core/SummarizeTenantModal.tsx` | High | Reusable pattern |
| `DraftOutreachModal` | `src/components/core/DraftOutreachModal.tsx` | High | Reusable pattern |
| `TenantDetailDrawer` | `src/components/core/TenantDetailDrawer.tsx` | High | Reusable pattern |

### One-Off Page Components

| Component | File | Notes |
|-----------|------|-------|
| `CoreDashboard` | `src/components/core/CoreDashboard.tsx` | Custom KPI cards, custom tables |
| `CorePropertiesPage` | `src/components/core/CorePropertiesPage.tsx` | Custom property cards |
| `CoreUnitsPage` | `src/components/core/CoreUnitsPage.tsx` | Custom unit cards |
| `CoreLeasesPage` | `src/components/core/CoreLeasesPage.tsx` | Custom table |
| `CoreResidentsPage` | `src/components/core/CoreResidentsPage.tsx` | Custom table |
| `CoreInsightsPage` | `src/components/core/CoreInsightsPage.tsx` | Custom table with filters |
| `CorePropertyDetailPage` | `src/components/core/CorePropertyDetailPage.tsx` | Custom header + tabs |
| `PropertyScopedUnitsPage` | `src/components/core/PropertyScopedUnitsPage.tsx` | Similar to CoreUnitsPage but scoped |
| `PropertyScopedLeasesPage` | `src/components/core/PropertyScopedLeasesPage.tsx` | Similar to CoreLeasesPage but scoped |
| `PropertyScopedResidentsPage` | `src/components/core/PropertyScopedResidentsPage.tsx` | Similar to CoreResidentsPage but scoped |
| `PropertyScopedCollectionsPage` | `src/components/core/PropertyScopedCollectionsPage.tsx` | Similar to CoreInsightsPage but scoped |
| `UnitDetailPage` | `src/components/core/UnitDetailPage.tsx` | Custom detail page |

### Components That Should Become Standardized

| Component | Purpose | Current State | Priority |
|-----------|---------|---------------|----------|
| **DataTable** | Reusable table component with sorting/filtering | Currently inline tables in each page | **HIGH** - Used in 6+ pages |
| **StatCard / KPI Card** | Dashboard metric display | Currently custom cards in CoreDashboard | **HIGH** - Used in dashboard + property detail |
| **Badge / Chip** | Status indicators (unit status, delinquency category, lease status) | Currently inline `<span>` with various styles | **HIGH** - Used throughout |
| **PageHeader** | Consistent page title + actions | Currently custom in each page | **HIGH** - Used in 10+ pages |
| **EmptyState** | Consistent empty states | Currently custom in each page | **MEDIUM** - Used in 5+ pages |
| **Modal** | Base modal wrapper | Currently custom backdrop + container in each modal | **HIGH** - Used in 8+ modals |
| **Button** | Standardized button variants | Currently inline with various classes | **HIGH** - Used everywhere |
| **Input / FormField** | Standardized form inputs | Currently custom inputs in modals | **MEDIUM** - Used in forms |
| **Breadcrumb** | Navigation breadcrumbs | Currently custom in some pages | **MEDIUM** - Used in property/unit/lease detail |
| **Tabs** | Tab navigation | Currently custom in property detail + lease detail | **MEDIUM** - Used in 2+ places |

---

## 4) Design System Proposal

### Typography Scale

```
H1 (Page Title): text-3xl font-bold (30px, 700)
  - Usage: Main page headings
  - Example: "Properties", "Units", "Leases"
  - Classes: .text-h1 or text-3xl font-bold

H2 (Section Title): text-2xl font-semibold (24px, 600)
  - Usage: Modal titles, major sections
  - Example: "Lease Details", "Transaction History"
  - Classes: .text-h2 or text-2xl font-semibold

H3 (Subsection Title): text-xl font-semibold (20px, 600)
  - Usage: Card titles, subsection headings
  - Example: "Resident", "Lease Information"
  - Classes: .text-h3 or text-xl font-semibold

H4 (Card Title): text-lg font-semibold (18px, 600)
  - Usage: Card headers, small section titles
  - Example: "Tenant Insight", "Financial Summary"
  - Classes: .text-h4 or text-lg font-semibold

Body (Default): text-base (16px, 400)
  - Usage: Body text, descriptions
  - Classes: .text-body or text-base

Body Small: text-sm (14px, 400)
  - Usage: Secondary text, helper text
  - Classes: .text-body-sm or text-sm

Label: text-sm font-medium (14px, 500)
  - Usage: Form labels, table headers
  - Classes: .text-label or text-sm font-medium

Caption: text-xs (12px, 400)
  - Usage: Timestamps, metadata, table headers
  - Classes: .text-caption or text-xs

Color Tokens:
  - Primary text: text-gray-900 dark:text-white
  - Secondary text: text-gray-600 dark:text-gray-400
  - Tertiary text: text-gray-500 dark:text-gray-500
  - Disabled: text-gray-400 dark:text-gray-600
```

### Spacing Scale (8px Grid)

```
xs: 4px   (0.5 * 8px)  - gap-1, p-1
sm: 8px   (1 * 8px)    - gap-2, p-2
md: 16px  (2 * 8px)    - gap-4, p-4
lg: 24px  (3 * 8px)    - gap-6, p-6
xl: 32px  (4 * 8px)    - gap-8, p-8
2xl: 48px (6 * 8px)    - gap-12, p-12
3xl: 64px (8 * 8px)    - gap-16, p-16

Container Padding:
  - Page: p-6 (24px)
  - Section: p-4 (16px)
  - Card: p-6 (24px)
  - Modal: p-6 (24px)

Gap System:
  - Tight: gap-2 (8px)
  - Normal: gap-4 (16px)
  - Loose: gap-6 (24px)

Stack Spacing:
  - Tight: space-y-4 (16px)
  - Normal: space-y-6 (24px)
  - Loose: space-y-8 (32px)
```

### Color Tokens

```
Primary:
  - Light: #3F6B28 (havyn-primary)
  - Dark: #4C8032 (havyn-light)
  - Hover: #345A22 (havyn-dark)
  - Dark mode text: #68B359 (havyn-lightest) or use opacity

Neutral:
  - Background: 
    - Page: bg-gray-50 dark:bg-gray-900
    - Card: bg-white dark:bg-gray-800
    - Hover: bg-gray-100 dark:bg-gray-700
  - Border:
    - Default: border-gray-200 dark:border-gray-700
    - Strong: border-gray-300 dark:border-gray-600
  - Text:
    - Primary: text-gray-900 dark:text-white
    - Secondary: text-gray-600 dark:text-gray-400
    - Tertiary: text-gray-500 dark:text-gray-500
    - Disabled: text-gray-400 dark:text-gray-600

Success:
  - Text: text-green-600 dark:text-green-400
  - Background: bg-green-50 dark:bg-green-900/20
  - Border: border-green-200 dark:border-green-800

Warning:
  - Text: text-yellow-600 dark:text-yellow-400
  - Background: bg-yellow-50 dark:bg-yellow-900/20
  - Border: border-yellow-200 dark:border-yellow-800

Danger/Error:
  - Text: text-red-600 dark:text-red-400
  - Background: bg-red-50 dark:bg-red-900/20
  - Border: border-red-200 dark:border-red-800

Info:
  - Text: text-blue-600 dark:text-blue-400
  - Background: bg-blue-50 dark:bg-blue-900/20
  - Border: border-blue-200 dark:border-blue-800
```

### Radius + Shadow Rules

```
Border Radius:
  - Small: rounded-sm (2px) - badges, small elements
  - Medium: rounded-md (4px) - buttons (optional variant)
  - Large: rounded-lg (8px) - default for cards, buttons, modals
  - Extra Large: rounded-xl (12px) - large cards, hero sections
  - Full: rounded-full - badges, avatars

Shadows:
  - None: shadow-none
  - Small: shadow-sm - subtle elevation
  - Medium: shadow-md - cards, default elevation
  - Large: shadow-lg - elevated cards, hover states
  - Extra Large: shadow-xl - modals, sidebars, dropdowns
  - Hover: hover:shadow-lg (one level up from default)

Z-Index Scale:
  - Base: 0
  - Dropdown: z-10
  - Sticky: z-20
  - Fixed: z-30
  - Overlay: z-40
  - Modal: z-50
  - Tooltip: z-50
```

### Button Variants

```
Primary:
  - Classes: px-4 py-2 bg-havyn-primary text-white rounded-lg hover:bg-havyn-dark disabled:opacity-50 disabled:cursor-not-allowed
  - Usage: Main actions (Create, Save, Submit)
  - Size variants: sm (px-3 py-1.5 text-sm), md (px-4 py-2), lg (px-6 py-3)

Secondary:
  - Classes: px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700
  - Usage: Cancel, secondary actions
  - Size variants: Same as primary

Tertiary/Ghost:
  - Classes: px-4 py-2 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
  - Usage: Low-priority actions
  - Size variants: Same as primary

Danger:
  - Classes: px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
  - Usage: Delete, destructive actions
  - Size variants: Same as primary

Icon Button:
  - Classes: p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
  - Usage: Icon-only actions
  - Size variants: sm (p-1), md (p-2), lg (p-3)

Link Button:
  - Classes: text-havyn-primary dark:text-green-400 hover:underline
  - Usage: Inline links, navigation
```

### Badge Variants (Unit Status, Delinquency Category, Lease Status)

```
Unit Status:
  - Vacant: bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300
  - Occupied: bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400
  - Make-Ready: bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400
  - Reserved: bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400

Delinquency Category:
  - Current: bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400
  - At Risk: bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400
  - Delinquent: bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400
  - Severe Delinquent: bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400

Lease Status:
  - Active: bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400
  - Expired: bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300
  - Terminated: bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400

Base Badge Classes:
  - px-2 py-1 text-xs font-medium rounded-full
  - Add status-specific background/text colors above
```

### Table Rules

```
Container:
  - Classes: w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden
  - Background: bg-white dark:bg-gray-800

Header Row:
  - Classes: bg-gray-50 dark:bg-gray-900
  - Padding: px-6 py-3
  - Text: text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider

Body Row:
  - Padding: px-6 py-4
  - Text: text-sm text-gray-900 dark:text-white
  - Hover: hover:bg-gray-50 dark:hover:bg-gray-700/50
  - Border: border-b border-gray-200 dark:border-gray-700 (last child: border-0)

Alternating Rows:
  - Optional: Even rows bg-gray-50/50 dark:bg-gray-900/50

Cell Alignment:
  - Default: text-left
  - Numbers: text-right
  - Actions: text-center

Sortable Headers:
  - Add cursor-pointer and hover:bg-gray-100 dark:hover:bg-gray-800
  - Show sort indicator (arrow icon)
```

---

## 5) Recommended UI Structure (Industry Standard)

### App Shell Layout: Sidebar + Top Header

**Current State:**
- Core PMS uses top header only with hamburger menu that opens right-side sidebar
- Legacy uses similar pattern
- No persistent sidebar

**Recommended:**
```
┌─────────────────────────────────────────────────┐
│  Logo | Breadcrumb              User | Theme | Menu │ ← Fixed Header (64px)
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Sidebar  │         Main Content Area            │
│ (256px)  │         (Scrollable)                 │
│          │                                      │
│ • Dashboard                                     │
│ • Properties                                    │
│   └─ Property 1                                 │
│   └─ Property 2                                 │
│ • Units                                         │
│ • Leases                                        │
│ • Residents                                     │
│ • Collections                                   │
│                                                  │
│ ─────────────────                               │
│ Legacy                                          │
│ • CSV Dashboard                                 │
│                                                  │
└──────────┴──────────────────────────────────────┘
```

**Sidebar Structure:**
- Persistent on desktop (256px width)
- Collapsible on mobile (drawer)
- Active route highlighting
- Expandable property list for property-scoped navigation
- Clear separation between Core PMS and Legacy sections

**Header:**
- Left: Logo + Breadcrumb navigation
- Right: Search (optional), User menu, Theme toggle, Notifications (optional)
- Height: 64px (h-16)

### Property Hub Navigation Pattern

**Current State:**
- Property detail page exists with tabs
- But navigation is inconsistent (some global, some property-scoped)

**Recommended Flow:**
```
1. Properties List (/core/properties)
   └─ Click property card
   └─ Navigate to: /core/properties/:propertyId/units

2. Property Detail Hub (/core/properties/:propertyId)
   └─ Header: Property name, address, quick stats
   └─ Tabs: Units | Leases | Residents | Collections | Settings
   └─ Default tab: Units
   └─ URL reflects active tab: /core/properties/:propertyId/:tab

3. Property-Scoped Views:
   - /core/properties/:propertyId/units → Units for this property only
   - /core/properties/:propertyId/leases → Leases for this property only
   - /core/properties/:propertyId/residents → Residents for this property only
   - /core/properties/:propertyId/collections → Delinquencies for this property only
   - /core/properties/:propertyId/settings → Property settings

4. Detail Pages (from property-scoped views):
   - Unit Detail: /core/units/:unitId (shows breadcrumb: Property → Units → Unit)
   - Lease Detail: Modal or /core/leases/:leaseId (shows breadcrumb: Property → Leases → Lease)
   - Resident Detail: Modal or /core/residents/:residentId (shows breadcrumb: Property → Residents → Resident)
```

### Breadcrumb Pattern

**Implementation:**
```
<Breadcrumb>
  <Breadcrumb.Item href="/core/properties">Properties</Breadcrumb.Item>
  <Breadcrumb.Separator />
  <Breadcrumb.Item href="/core/properties/:propertyId">Property Name</Breadcrumb.Item>
  <Breadcrumb.Separator />
  <Breadcrumb.Item href="/core/properties/:propertyId/units">Units</Breadcrumb.Item>
  <Breadcrumb.Separator />
  <Breadcrumb.Item active>Unit 101</Breadcrumb.Item>
</Breadcrumb>
```

**Styling:**
- Font size: text-sm
- Separator: text-gray-400 dark:text-gray-500, mx-2
- Links: text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
- Active: text-gray-900 dark:text-white font-medium
- Spacing: mb-4 or mb-6 from content

---

## 6) Refactor Plan (Phased)

### Phase A: Create UI Kit + Tokens (Week 1)

**Goal:** Establish design system foundation without touching existing pages.

**Deliverables:**
1. **Design Tokens File** (`src/styles/tokens.css` or `src/utils/designTokens.ts`)
   - Typography scale (CSS variables or Tailwind config extension)
   - Color tokens (extend tailwind.config.js)
   - Spacing scale (already in Tailwind, document usage)
   - Shadow/radius tokens

2. **Base Components** (`src/components/ui/`)
   - `Button.tsx` - All button variants (Primary, Secondary, Tertiary, Danger, Icon, Link)
   - `Badge.tsx` - Status badges with variants
   - `Modal.tsx` - Base modal wrapper (backdrop + container + header + footer)
   - `Input.tsx` / `FormField.tsx` - Standardized form inputs
   - `LoadingSpinner.tsx` - Standardized loading states

3. **Documentation** (`src/components/ui/README.md`)
   - Component API docs
   - Usage examples
   - Design tokens reference

**Files to Create:**
- `src/components/ui/Button.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/FormField.tsx`
- `src/components/ui/LoadingSpinner.tsx`
- `src/styles/tokens.css` (optional, or extend tailwind.config.js)
- `src/components/ui/README.md`

**Estimated Effort:** 2-3 days

---

### Phase B: Refactor Core Pages to Use the Kit (Week 2-3)

**Goal:** Standardize Core PMS pages using the new UI kit.

**Sub-phases:**

#### B1: Standardize Shared Components (Days 1-2)

**Files to Refactor:**
- `src/components/core/LeaseDetailModal.tsx` - Use Button, Modal, Badge components
- `src/components/core/TransactionModal.tsx` - Use Button, Modal, Input, FormField
- `src/components/core/CreatePropertyModal.tsx` - Use Button, Modal, Input, FormField
- `src/components/core/CreateLeaseModal.tsx` - Use Button, Modal, Input, FormField
- `src/components/core/SummarizeTenantModal.tsx` - Use Modal, Button
- `src/components/core/DraftOutreachModal.tsx` - Use Modal, Button, Input

**Estimated Effort:** 1-2 days

#### B2: Create Standardized Page Components (Days 3-4)

**Files to Create:**
- `src/components/ui/PageHeader.tsx` - Standard page title + actions
- `src/components/ui/DataTable.tsx` - Reusable table with sorting/filtering
- `src/components/ui/StatCard.tsx` - KPI/metric cards
- `src/components/ui/EmptyState.tsx` - Standard empty states
- `src/components/ui/Breadcrumb.tsx` - Breadcrumb navigation
- `src/components/ui/Tabs.tsx` - Tab navigation component

**Estimated Effort:** 2 days

#### B3: Refactor Core Dashboard (Day 5)

**Files to Refactor:**
- `src/components/core/CoreDashboard.tsx`
  - Replace custom KPI cards with `StatCard`
  - Standardize tables (if needed, or keep custom for now)
  - Use `PageHeader` for title + property selector
  - Standardize empty states with `EmptyState`

**Estimated Effort:** 1 day

#### B4: Refactor List Pages (Days 6-8)

**Files to Refactor:**
- `src/components/core/CorePropertiesPage.tsx`
  - Use `PageHeader`
  - Use `EmptyState`
  - Standardize property cards (or create `PropertyCard` component)
  - Use `Button` components

- `src/components/core/CoreUnitsPage.tsx`
  - Use `PageHeader`
  - Use `EmptyState`
  - Standardize unit cards
  - Use `Button`, `Badge` for status

- `src/components/core/CoreLeasesPage.tsx`
  - Use `PageHeader`
  - Use `DataTable` (or standardize custom table)
  - Use `EmptyState`
  - Use `Button`, `Badge`

- `src/components/core/CoreResidentsPage.tsx`
  - Use `PageHeader`
  - Use `DataTable`
  - Use `EmptyState`
  - Use `Button`

- `src/components/core/CoreInsightsPage.tsx`
  - Use `PageHeader`
  - Use `DataTable` with filters
  - Use `EmptyState`
  - Use `Button`, `Badge`

**Estimated Effort:** 3 days

#### B5: Refactor Property Hub Pages (Days 9-10)

**Files to Refactor:**
- `src/components/core/CorePropertyDetailPage.tsx`
  - Use `PageHeader` with breadcrumb
  - Use `Tabs` component
  - Use `StatCard` for KPI strip
  - Use `Breadcrumb`

- `src/components/core/PropertyScopedUnitsPage.tsx`
  - Use `PageHeader` (inherit from property detail or standalone)
  - Use `Breadcrumb`
  - Standardize unit cards
  - Use `EmptyState`

- `src/components/core/PropertyScopedLeasesPage.tsx`
  - Use `PageHeader`
  - Use `Breadcrumb`
  - Use `DataTable`
  - Use `EmptyState`

- `src/components/core/PropertyScopedResidentsPage.tsx`
  - Use `PageHeader`
  - Use `Breadcrumb`
  - Use `DataTable`
  - Use `EmptyState`

- `src/components/core/PropertyScopedCollectionsPage.tsx`
  - Use `PageHeader`
  - Use `Breadcrumb`
  - Use `DataTable`
  - Use `EmptyState`

**Estimated Effort:** 2 days

#### B6: Refactor Detail Pages (Days 11-12)

**Files to Refactor:**
- `src/components/core/UnitDetailPage.tsx`
  - Use `PageHeader` with breadcrumb
  - Use `Breadcrumb`
  - Use `StatCard` for financial summary
  - Use `Button`, `Badge`
  - Standardize sections

- `src/components/core/LeaseDetailModal.tsx` (already done in B1, verify)
- `src/components/core/TenantDetailDrawer.tsx`
  - Use standardized components
  - Use `Tabs` if not already
  - Use `Button`, `Badge`

**Estimated Effort:** 2 days

#### B7: Refactor Layout (Day 13)

**Files to Refactor:**
- `src/components/core/CorePMSLayout.tsx`
  - Implement persistent sidebar (desktop) + drawer (mobile)
  - Standardize header
  - Use `Button` components in sidebar

**Estimated Effort:** 1 day

**Total Phase B Estimated Effort:** 13 days (2.5 weeks)

---

### Phase C: Refactor Legacy Dashboard (Optional, Week 4)

**Goal:** Apply design system to legacy dashboard for consistency.

**Files to Refactor:**
- `src/components/Dashboard.tsx`
  - Use `PageHeader`
  - Use `StatCard` (replace `MetricCard` or standardize it)
  - Standardize tables
  - Use `Button`, `Badge`
  - Use `EmptyState`
  - Use `Modal` for file upload

- `src/components/MainContent.tsx`
  - Standardize header
  - Use `Button` components

- `src/components/NavigationSidebar.tsx`
  - Standardize to match Core PMS sidebar pattern
  - Use `Button` components

**Estimated Effort:** 3-5 days (optional)

---

## Summary

**Total Estimated Effort:**
- Phase A: 2-3 days
- Phase B: 13 days (2.5 weeks)
- Phase C: 3-5 days (optional)
- **Total: ~3 weeks** (or ~4 weeks with legacy refactor)

**Priority Order:**
1. Phase A (foundation)
2. Phase B1-B2 (shared components + page components)
3. Phase B3-B6 (refactor pages)
4. Phase B7 (layout)
5. Phase C (optional legacy refactor)

**Key Benefits:**
- Consistent UI/UX across all pages
- Maintainable design system
- Faster development for new features
- Professional, industry-standard appearance
- Better accessibility (if built into components)
- Easier theming/dark mode management

---

## Appendix: File Paths Referenced

### Core PMS Pages
- `src/components/core/CoreDashboard.tsx`
- `src/components/core/CorePropertiesPage.tsx`
- `src/components/core/CoreUnitsPage.tsx`
- `src/components/core/CoreLeasesPage.tsx`
- `src/components/core/CoreResidentsPage.tsx`
- `src/components/core/CoreInsightsPage.tsx`
- `src/components/core/CorePropertyDetailPage.tsx`
- `src/components/core/PropertyScopedUnitsPage.tsx`
- `src/components/core/PropertyScopedLeasesPage.tsx`
- `src/components/core/PropertyScopedResidentsPage.tsx`
- `src/components/core/PropertyScopedCollectionsPage.tsx`
- `src/components/core/UnitDetailPage.tsx`
- `src/components/core/CoreSetupWizard.tsx`

### Modals/Overlays
- `src/components/core/LeaseDetailModal.tsx`
- `src/components/core/TransactionModal.tsx`
- `src/components/core/TenantDetailDrawer.tsx`
- `src/components/core/CreatePropertyModal.tsx`
- `src/components/core/CreateLeaseModal.tsx`
- `src/components/core/BulkAddUnitsModal.tsx`
- `src/components/core/SummarizeTenantModal.tsx`
- `src/components/core/DraftOutreachModal.tsx`

### Layout Components
- `src/components/core/CorePMSLayout.tsx`
- `src/components/MainContent.tsx`
- `src/components/NavigationSidebar.tsx`

### Legacy Components
- `src/components/Dashboard.tsx`
- `src/components/MetricCard.tsx`
- `src/components/InsightCard.tsx`

### Configuration
- `tailwind.config.js`
- `src/index.css`
- `src/App.tsx` (routing)



