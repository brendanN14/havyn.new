# Core UI Refactor Audit Checklist

## HIGH PRIORITY (Ledger/Daily-Path Screens)

| File | Non-Compliant Items | Severity | Lines/Snippets |
|------|---------------------|----------|----------------|
| `TenantDetailDrawer.tsx` | Hardcoded colors (`text-red-600`, `text-green-600`), not using Card for ledger snapshot | HIGH | Line 314: `text-red-600 dark:text-red-400` |
| `TransactionModal.tsx` | Hardcoded colors (`text-red-500` for required asterisks) | HIGH | Lines 231, 244, 263: `<span className="text-red-500">*</span>` |
| `UnitDetailPage.tsx` | Hardcoded colors (`text-red-600`, `bg-blue-600`, `bg-purple-600`, `bg-green-600`), raw buttons, not using Card/DataTable | HIGH | Lines 342, 348, 362, 385, 393, 402: hardcoded colors; Lines 383-407: raw `<button>` |
| `CoreLeasesPage.tsx` | Custom table, hardcoded colors (`text-red-600`, `bg-green-100`, `bg-red-100`), raw button | HIGH | Lines 248-309: custom `<table>`; Line 291: `text-red-600`; Line 299: raw `<button>` |
| `CoreResidentsPage.tsx` | Custom table, hardcoded colors (`text-red-600`, badge colors), raw button | HIGH | Lines 242-315: custom `<table>`; Lines 274, 291: hardcoded colors; Line 302: raw `<button>` |
| `CoreUnitsPage.tsx` | Hardcoded colors (`bg-blue-100`, `bg-purple-100`), raw buttons, not using PageHeader | HIGH | Lines 380, 382: badge colors; Lines 211, 217, 333, 358: raw `<button>`; Line 205: not PageHeader |
| `LeaseDetailModal.tsx` | Already mostly compliant - verify ledger tab | HIGH | Verify ledger tab uses DataTable |

## MEDIUM PRIORITY (Modals)

| File | Non-Compliant Items | Severity | Lines/Snippets |
|------|---------------------|----------|----------------|
| `CreatePropertyModal.tsx` | Not using Modal component, hardcoded error colors | MEDIUM | Line 110: `fixed inset-0` custom modal; Line 126: `text-red-800` |
| `CreateLeaseModal.tsx` | Not using Modal component, hardcoded error colors | MEDIUM | Line 125: `fixed inset-0` custom modal; Line 136: `text-red-800` |
| `BulkAddUnitsModal.tsx` | Not using Modal component, hardcoded error colors | MEDIUM | Line 82: `fixed inset-0` custom modal; Line 96: `text-red-800` |
| `DraftOutreachModal.tsx` | Not using Modal component | MEDIUM | Line 118: `fixed inset-0` custom modal |
| `SummarizeTenantModal.tsx` | Not using Modal component | MEDIUM | Lines 41, 71: `fixed inset-0` custom modal |

## LOW PRIORITY (Setup/Edge Cases)

| File | Non-Compliant Items | Severity | Lines/Snippets |
|------|---------------------|----------|----------------|
| `CoreSetupWizard.tsx` | Gradients (`bg-gradient-to-br`), hardcoded colors | LOW | Lines 176, 180, 403: gradients; Lines 222, 224, 225: hardcoded colors |
| `VacancyBoard.tsx` | Hardcoded badge colors (`bg-purple-50`) | LOW | Line 71: `bg-purple-50` |
| `CoreFinancialPage.tsx` | Custom table, hardcoded colors | LOW | Custom table; hardcoded colors |
| `PropertyScopedLeasesPage.tsx` | Hardcoded error colors | LOW | Lines 122-125: `text-red-*` |
| `PropertyScopedResidentsPage.tsx` | Hardcoded error colors, badge colors | LOW | Lines 121-124, 181, 194: hardcoded colors |

## Summary

**HIGH Priority Files to Fix:**
1. TenantDetailDrawer.tsx - Ledger snapshot colors
2. TransactionModal.tsx - Required asterisk colors
3. UnitDetailPage.tsx - Financial summary colors, buttons, Card usage
4. CoreLeasesPage.tsx - Custom table, colors, buttons
5. CoreResidentsPage.tsx - Custom table, colors, buttons
6. CoreUnitsPage.tsx - Colors, buttons, PageHeader

**MEDIUM Priority Files:**
- All modals (CreatePropertyModal, CreateLeaseModal, BulkAddUnitsModal, DraftOutreachModal, SummarizeTenantModal)

**LOW Priority Files:**
- CoreSetupWizard, VacancyBoard, CoreFinancialPage, PropertyScoped pages



