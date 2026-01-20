# Core PMS UI Refactor Summary

## Design Tokens (tailwind.config.js)

### Colors
- **Havyn Brand**: primary (#3F6B28), dark, hover, light, lighter, lightest, subtle
- **Status Colors**: success, warning, danger, info (each with bg, bg-dark, text, text-dark variants)
- **Neutral**: gray scale (50-900) for backgrounds, borders, text

### Spacing
- Standard Tailwind spacing scale
- Added: 18 (4.5rem), 88 (22rem)

### Z-Index
- Added: 60, 70, 80, 90, 100 for modals, drawers, dropdowns

## UI Kit Components Created/Updated

### New Components
1. **StatCard** (`src/components/ui/StatCard.tsx`)
   - Standardized KPI card with label, value, helper text, optional icon
   - Neutral styling, consistent padding

2. **Tabs** (`src/components/ui/Tabs.tsx`)
   - Tab navigation component with active state
   - Supports icons

3. **Breadcrumb** (`src/components/ui/Breadcrumb.tsx`)
   - Breadcrumb navigation with separator icons

4. **Drawer** (`src/components/ui/Drawer.tsx`)
   - Side drawer component (replaces TenantDetailDrawer custom drawer)
   - Configurable side (left/right), size, keyboard navigation

5. **Skeleton** (`src/components/ui/Skeleton.tsx`)
   - Loading skeleton component with variants

### Existing Components (Standardized)
- Button (primary, secondary, ghost, danger, icon)
- Badge (unit status, delinquency, lease status variants)
- Card, CardHeader, CardBody, CardFooter
- Modal
- DataTable
- PageHeader
- EmptyState
- Spinner
- ActivityTimeline

## Pages Refactored

### Layout
- **CorePMSLayout**: 
  - Added active route highlighting
  - Added Leads and Collections to navigation
  - Consistent spacing and styling

### Dashboard
- **CoreDashboard**: 
  - Already refactored in previous task
  - Uses StatCard for KPIs
  - Consistent table styling

## Remaining Refactoring Work

Due to the large scope, the following pages need systematic refactoring:

1. CorePropertiesPage
2. CreatePropertyModal
3. CorePropertyDetailPage
4. PropertyScopedUnitsPage
5. PropertyScopedLeasesPage
6. PropertyScopedResidentsPage
7. PropertyScopedCollectionsPage
8. CoreUnitsPage
9. UnitDetailPage
10. BulkAddUnitsModal
11. VacancyBoard
12. CoreLeasesPage
13. LeaseDetailModal
14. CreateLeaseModal
15. TransactionModal
16. CoreResidentsPage
17. TenantDetailDrawer
18. CoreLeadsPage
19. CoreInsightsPage (Collections)
20. CoreSetupWizard
21. SummarizeTenantModal
22. DraftOutreachModal

## Patterns to Apply

1. Replace custom KPI cards with StatCard
2. Replace custom tables with DataTable
3. Replace custom modals with Modal component
4. Replace custom drawers with Drawer component
5. Replace status pills with Badge variants
6. Replace all buttons with Button component variants
7. Use consistent spacing (p-6 for pages, space-y-6 for sections)
8. Remove gradients
9. Remove random colors (bg-blue-600, bg-purple-600, etc.)
10. Use PageHeader for all page titles
11. Use Tabs component for tabbed interfaces
12. Use Breadcrumb for navigation hierarchy



