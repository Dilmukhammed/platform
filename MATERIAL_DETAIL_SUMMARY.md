# MATERIAL DETAIL PAGE - PATTERN RESEARCH SUMMARY
## Key Findings from Codebase Analysis

**Analysis Date**: April 18, 2026
**Framework**: Next.js 15.3.5 + React 19 + TypeScript 5.7 + Supabase
**Scope**: Read-only pattern inference for material detail page with edit/download

---

## QUICK REFERENCE: EXISTING PATTERNS

### 1. DETAIL PAGE TEMPLATE
Location: src/app/(admin)/admin/organizations/[organizationId]/page.tsx (361 lines)
- Async server component with dynamic [organizationId] segment
- Server-side data fetch via apiGet()
- Ownership/permission validation
- Multi-section layout: header + metadata + related data + table view
- Back navigation + status badges

**Apply to**: src/app/(teacher)/teacher/materials/[materialId]/page.tsx

### 2. API ROUTE PATTERNS (ALREADY EXIST)
GET /api/v1/teacher/materials/[materialId]
- Fetches material with material_approvals relationship
- Checks ownership (personal scope) or membership (org scope)
- Returns: materialId, title, description, status, sourceFilePath, approval info
- Error handling: 403 FORBIDDEN, 404 NOT_FOUND

PATCH /api/v1/teacher/materials/[materialId]
- Updates: title, description, status, sourceFilePath
- Validates: title (1-255 chars), description (max 1000 chars)
- Checks ownership before update
- Returns updated material with timestamps

GET /api/v1/admin/materials/[materialId]/download
- Generates signed Supabase Storage URL (1-hour expiry)
- Redirects to signed URL (302)
- Adapt for teacher access: /api/v1/teacher/materials/[materialId]/download

### 3. FORM COMPONENT PATTERN
Location: src/app/(teacher)/teacher/materials/MaterialUploadForm.tsx
- Client component ("use client")
- useState for form state + loading + error
- Form submission with error handling
- Loading state during submission
- Error display with user-friendly messages

**Apply to**: MaterialDetailForm.tsx for title/description editing

### 4. CARD/DISPLAY PATTERN
Location: src/app/(teacher)/teacher/materials/MaterialCard.tsx (222 lines)
- Status mapping function: getStatusChipProps()
- Conditional rendering based on approval state
- StatusChip component for status display
- Modal for secondary actions (AddToClassModal)
- Success message handling

**Apply to**: Detail page status section

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Page Component
- [ ] Create: src/app/(teacher)/teacher/materials/[materialId]/page.tsx
- [ ] Import: requireAreaAccess, apiGet, Card, Button, StatusChip, Badge
- [ ] Fetch material via: apiGet(/api/v1/teacher/materials/)
- [ ] Handle: notFound() for missing materials
- [ ] Validate: ownership before rendering edit controls
- [ ] Layout sections:
  - [ ] Back button to /teacher/materials
  - [ ] Header with icon, title, status badge
  - [ ] Metadata card (created, updated, approval timeline)
  - [ ] Edit form section
  - [ ] Download section (if file exists)

### Phase 2: Edit Form Component
- [ ] Create: src/app/(teacher)/teacher/materials/[materialId]/MaterialDetailForm.tsx
- [ ] Client component with useState
- [ ] Form fields: title (required), description (optional)
- [ ] Submit handler: PATCH /api/v1/teacher/materials/[materialId]
- [ ] Loading state during submission
- [ ] Error display from API response
- [ ] Success feedback (toast or inline message)
- [ ] Revalidate: /teacher/materials and /teacher/materials/[materialId]

### Phase 3: Download Functionality
- [ ] Create: src/app/api/v1/teacher/materials/[materialId]/download/route.ts
- [ ] Copy pattern from: /api/v1/admin/materials/[materialId]/download/route.ts
- [ ] Change: requiredRole from "super_admin" to "teacher"
- [ ] Add: ownership check (personal or org membership)
- [ ] Generate signed URL with 1-hour expiry
- [ ] Redirect to Supabase Storage URL
- [ ] Add download button to detail page

### Phase 4: Testing
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

### Pattern 1: Async Server Component
`	ypescript
export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  await requireAreaAccess("teacher");
  const { materialId } = await params;
  
  const material = await apiGet(/api/v1/teacher/materials/);
  if (!material) notFound();
  
  return <section>...</section>;
}
`

### Pattern 2: Ownership Validation
`	ypescript
// Server-side (in API route)
if (material.scope_type === "personal") {
  if (material.owner_teacher_id !== session.userId) {
    return toResponse(errorResponse(ErrorCodes.FORBIDDEN, ...));
  }
}

// Client-side (for UI)
const canEdit = material.ownerTeacherId === currentUserId;
if (canEdit) {
  // Show edit form
}
`

### Pattern 3: Form Submission
`	ypescript
"use client";

export function MaterialDetailForm({ material }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        /api/v1/teacher/materials/,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
          }),
        }
      );
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to update");
      }
      
      // Success: revalidate and show message
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <input name="title" defaultValue={material.title} required />
      <textarea name="description" defaultValue={material.description || ""} />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
`

### Pattern 4: Download Route
`	ypescript
export const GET = withAuth(
  async (_request, context) => {
    const { materialId } = await context.params;
    const supabase = createServerClient();

    // Fetch material
    const { data: material } = await supabase
      .from("materials")
      .select("id, source_file_path")
      .eq("id", materialId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!material?.source_file_path) {
      return toResponse(
        errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "No file attached.")
      );
    }

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = 
      await supabase.storage
        .from("uploads")
        .createSignedUrl(material.source_file_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate URL.")
      );
    }

    return Response.redirect(signedUrlData.signedUrl, 302);
  },
  { requiredRole: "teacher" },
);
`

---

## TDD VERIFICATION STEPS

### Before Implementation
- [ ] Review detail page example: /admin/organizations/[organizationId]/page.tsx
- [ ] Verify API routes exist and work: GET, PATCH, download
- [ ] Check Supabase schema: materials table + material_approvals relationship
- [ ] Confirm auth guards: requireAreaAccess("teacher"), withAuth middleware

### During Implementation
- [ ] Type safety: Match API response types
- [ ] Error handling: Catch and display API errors
- [ ] Loading states: Show spinners during fetch/submit
- [ ] Accessibility: Semantic HTML, ARIA labels, keyboard nav
- [ ] Security: Validate ownership server-side

### After Implementation
- [ ] Unit tests pass: API routes (GET, PATCH, download)
- [ ] E2E tests pass: View, edit, download flows
- [ ] Linting passes: npm run lint
- [ ] Type checking passes: tsc --noEmit
- [ ] Build succeeds: npm run build
- [ ] No console errors: Check browser console
- [ ] Accessibility audit: Screen reader, keyboard nav

---

## FILE LOCATIONS TO REFERENCE

### Detail Page Example
src/app/(admin)/admin/organizations/[organizationId]/page.tsx (361 lines)
- Layout structure
- Server component pattern
- Data fetching
- Ownership validation
- Multi-section rendering

### API Route Examples
src/app/api/v1/teacher/materials/[materialId]/route.ts (225 lines)
- GET: Fetch material with approval info
- PATCH: Update title/description
- Ownership checks
- Zod validation

src/app/api/v1/admin/materials/[materialId]/download/route.ts (92 lines)
- Download route pattern
- Signed URL generation
- Error handling

### Form Component Example
src/app/(teacher)/teacher/materials/MaterialUploadForm.tsx
- Client component pattern
- Form state management
- Error handling
- Loading states

### Card Component Example
src/app/(teacher)/teacher/materials/MaterialCard.tsx (222 lines)
- Status mapping
- Conditional rendering
- Modal integration
- Success messages

---

## SUMMARY

**Framework**: Next.js 15 App Router (async server components + route handlers)
**Data**: Supabase with RLS + soft deletes
**UI**: Radix UI + custom design system
**Auth**: Session-based with role guards
**Testing**: Bun + Playwright

**Key Patterns**:
1. Dynamic routes: [materialId] segment
2. Server-side fetching: apiGet() in async components
3. Ownership validation: Check before rendering/updating
4. Form submission: PATCH API with error handling
5. File download: Signed Supabase URLs with 1-hour expiry
6. Error handling: User-friendly messages from API
7. Revalidation: Update related paths after mutations

**Implementation Order**:
1. Page component (fetch + display)
2. Edit form (client component)
3. Download route (API handler)
4. Tests (unit + E2E)

**Estimated Effort**: 4-6 hours (including tests)
