# MATERIAL DETAIL PAGE - CODE EXAMPLES
## Concrete Implementation Templates

---

## 1. PAGE COMPONENT TEMPLATE

File: src/app/(teacher)/teacher/materials/[materialId]/page.tsx

Key sections:
- Async server component with dynamic [materialId] segment
- Fetch material via apiGet()
- Check ownership before rendering edit form
- Display metadata, approval status, rejection reason
- Download button if file exists

## 2. EDIT FORM COMPONENT TEMPLATE

File: src/app/(teacher)/teacher/materials/[materialId]/MaterialDetailForm.tsx

Key sections:
- Client component with useState for form state
- Form fields: title (required), description (optional)
- Submit handler: PATCH /api/v1/teacher/materials/[materialId]
- Loading state during submission
- Error display from API response
- Success feedback with auto-hide

## 3. DOWNLOAD ROUTE TEMPLATE

File: src/app/api/v1/teacher/materials/[materialId]/download/route.ts

Key sections:
- withAuth middleware with requiredRole: "teacher"
- Fetch material from Supabase
- Check ownership (personal or org membership)
- Generate signed URL with 1-hour expiry
- Redirect to Supabase Storage URL (302)

## 4. UNIT TEST TEMPLATE

File: tests/materials-detail.test.ts

Test cases:
- GET: Owner can fetch, non-owner gets 403, deleted returns 404
- PATCH: Owner can update, validation errors, non-owner gets 403
- Download: Owner can download, non-owner gets 403, no file returns 404

## 5. E2E TEST TEMPLATE

File: tests/e2e/materials-detail.pw.ts

Test scenarios:
- Display material details
- Edit title and description
- Download material file
- Show rejection reason if rejected
- Prevent non-owner from editing

---

## IMPLEMENTATION CHECKLIST

Phase 1: Page Component
- [ ] Create: src/app/(teacher)/teacher/materials/[materialId]/page.tsx
- [ ] Import: requireAreaAccess, apiGet, Card, Button, StatusChip, Badge
- [ ] Fetch material via: apiGet(/api/v1/teacher/materials/{materialId})
- [ ] Handle: notFound() for missing materials
- [ ] Validate: ownership before rendering edit controls
- [ ] Layout sections:
  - [ ] Back button to /teacher/materials
  - [ ] Header with icon, title, status badge
  - [ ] Metadata card (created, updated, approval timeline)
  - [ ] Edit form section (only for owner)
  - [ ] Download section (if file exists)

Phase 2: Edit Form Component
- [ ] Create: src/app/(teacher)/teacher/materials/[materialId]/MaterialDetailForm.tsx
- [ ] Client component with useState
- [ ] Form fields: title (required), description (optional)
- [ ] Submit handler: PATCH /api/v1/teacher/materials/{materialId}
- [ ] Loading state during submission
- [ ] Error display from API response
- [ ] Success feedback (toast or inline message)
- [ ] Revalidate: /teacher/materials and /teacher/materials/{materialId}

Phase 3: Download Functionality
- [ ] Create: src/app/api/v1/teacher/materials/[materialId]/download/route.ts
- [ ] Copy pattern from: /api/v1/admin/materials/[materialId]/download/route.ts
- [ ] Change: requiredRole from "super_admin" to "teacher"
- [ ] Add: ownership check (personal or org membership)
- [ ] Generate signed URL with 1-hour expiry
- [ ] Redirect to Supabase Storage URL
- [ ] Add download button to detail page

Phase 4: Testing
- [ ] Unit tests: API route handlers (GET, PATCH, download)
  - [ ] Owner can fetch/update/download
  - [ ] Non-owner gets 403 FORBIDDEN
  - [ ] Deleted material returns 404
  - [ ] Validation errors handled
- [ ] E2E tests: User flows
  - [ ] View material details
  - [ ] Edit title/description
  - [ ] Download file
  - [ ] Navigate back to list
- [ ] Accessibility: Keyboard nav, screen reader, ARIA labels
- [ ] Performance: No unnecessary re-renders, lazy-load previews

---

## KEY PATTERNS TO FOLLOW

Pattern 1: Async Server Component
- Use async function for page component
- Fetch data server-side with apiGet()
- Check ownership before rendering
- Use notFound() for missing resources

Pattern 2: Ownership Validation
- Server-side: Check in API route before returning data
- Client-side: Check before rendering edit controls
- Never trust client-side checks for security

Pattern 3: Form Submission
- Client component with useState for form state
- Submit via PATCH API endpoint
- Show loading state during submission
- Display validation errors from API
- Revalidate related paths after success

Pattern 4: Download Route
- Use withAuth middleware with requiredRole
- Fetch material and check ownership
- Generate signed URL with expiry
- Redirect to Supabase Storage URL

---

## REFERENCE FILES

Detail Page Example:
src/app/(admin)/admin/organizations/[organizationId]/page.tsx (361 lines)

API Route Examples:
src/app/api/v1/teacher/materials/[materialId]/route.ts (225 lines)
src/app/api/v1/admin/materials/[materialId]/download/route.ts (92 lines)

Form Component Example:
src/app/(teacher)/teacher/materials/MaterialUploadForm.tsx

Card Component Example:
src/app/(teacher)/teacher/materials/MaterialCard.tsx (222 lines)

---

## SUMMARY

Framework: Next.js 15 App Router (async server components + route handlers)
Data: Supabase with RLS + soft deletes
UI: Radix UI + custom design system
Auth: Session-based with role guards
Testing: Bun + Playwright

Implementation Order:
1. Page component (fetch + display)
2. Edit form (client component)
3. Download route (API handler)
4. Tests (unit + E2E)

Estimated Effort: 4-6 hours (including tests)
