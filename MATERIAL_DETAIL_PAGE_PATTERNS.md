# Material Detail Page Implementation Patterns
## Framework & Runtime Analysis

Project: Next.js 15.3.5 + React 19 + TypeScript 5.7 + Supabase
Date: April 18, 2026
Scope: Read-only pattern analysis for dedicated material detail page with edit/download capabilities

---

## 1. FRAMEWORK PATTERNS IDENTIFIED

### 1.1 Next.js App Router Architecture
Pattern: File-based routing with dynamic segments

src/app/(teacher)/teacher/materials/
├── page.tsx                    # List view (264 lines)
├── MaterialCard.tsx            # Card component (222 lines)
├── MaterialUploadForm.tsx       # Form component
└── AddToClassModal.tsx         # Modal component

src/app/(admin)/admin/organizations/[organizationId]/page.tsx  # Detail page example (361 lines)

Inference for Material Detail Page:
- Create: src/app/(teacher)/teacher/materials/[materialId]/page.tsx
- Pattern: Dynamic segment [materialId] for route parameterization
- Async server component with params: Promise<{ materialId: string }>

### 1.2 Server Component Pattern (RSC)
Evidence: All page components are async server components

From organizations detail page (line 18-20):
export default async function AdminOrganizationDetailPage({
  params,
}: AdminOrganizationDetailPageProps) {
  await requireAreaAccess("admin");
  const { organizationId } = await params;

For Material Detail Page:
- Use async page component
- Fetch material data server-side via apiGet()
- Handle notFound() for missing materials
- Implement requireAreaAccess("teacher") guard

### 1.3 API Route Pattern (Route Handlers)
Evidence: RESTful API routes with role-based auth

From /api/v1/teacher/materials/[materialId]/route.ts (lines 20-110):
export const GET = withAuth(
  async (request, context, { session }) => {
    // Fetch material with approval info
    const { data: material, error } = await supabase
      .from("materials")
      .select("*, material_approvals!left(*)")
      .eq("id", materialId)
      .is("deleted_at", null)
      .single();
    
    // Check ownership/permissions
    if (material.scope_type === "personal") {
      if (material.owner_teacher_id !== session.userId) {
        return toResponse(errorResponse(ErrorCodes.FORBIDDEN, ...));
      }
    }
  },
  { requiredRole: "teacher" },
);

export const PATCH = withAuth(
  async (request, context, { session }) => {
    // Update material with validation
    const validation = updateMaterialSchema.safeParse(body);
    // ... update logic
  },
  { requiredRole: "teacher" },
);

For Material Detail Page:
- Existing PATCH route handles title/description updates
- GET route already fetches material details with approval info
- Use withAuth middleware for role-based access control
- Validation via Zod schemas (line 13-18)

---

## 2. DATA LAYER PATTERNS

### 2.1 Supabase Client Pattern
Evidence: Server-side Supabase client usage

From /api/v1/teacher/materials/[materialId]/route.ts (line 27):
const supabase = createServerClient();

Query with relationships:
const { data: material, error } = await supabase
  .from("materials")
  .select("*, material_approvals!left(*)")
  .eq("id", materialId)
  .is("deleted_at", null)
  .single();

For Material Detail Page:
- Use createServerClient() from @/lib/supabase/server-client
- Query: materials table with material_approvals relationship
- Include soft-delete check: .is("deleted_at", null)
- Handle null/error cases with notFound()

### 2.2 Material Data Structure
Evidence: From /src/modules/materials/types.ts and API responses

Core material record:
type MaterialRecord = {
  id: string;
  teacherId: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByAdminId: string | null;
  rejectedAt: string | null;
  rejectedByAdminId: string | null;
  rejectionReason: string | null;
};

API response format (from route.ts line 96-114):
{
  materialId: material.id,
  title: material.title,
  description: material.description,
  scopeType: material.scope_type,
  ownerTeacherId: material.owner_teacher_id,
  ownerOrganizationId: material.owner_organization_id,
  status: material.status,
  sourceFilePath: material.source_file_path,
  createdAt: material.created_at,
  updatedAt: material.updated_at,
  pendingApproval: {
    approvalId: pendingApproval.id,
    decision: pendingApproval.decision,
    requestedAt: pendingApproval.created_at,
  } | null,
  lastDecision: {
    approvalId: lastDecision.id,
    decision: lastDecision.decision,
    decisionReason: lastDecision.decision_reason,
    reviewedAt: lastDecision.reviewed_at,
  } | null,
}

For Detail Page:
- Display: title, description, status, timestamps, approval info
- Edit fields: title, description (PATCH endpoint ready)
- Show: sourceFilePath for download link

### 2.3 Ownership & Permission Pattern
Evidence: From /api/v1/teacher/materials/[materialId]/route.ts (lines 43-65)

Personal scope: owner must match session user
if (material.scope_type === "personal") {
  if (material.owner_teacher_id !== session.userId) {
    return toResponse(
      errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
    );
  }
}

Organization scope: check membership
if (material.scope_type === "organization") {
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", material.owner_organization_id)
    .eq("platform_user_id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!membership) {
    return toResponse(
      errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
    );
  }
}

For Detail Page:
- Check ownership before rendering edit controls
- Personal materials: only owner can edit
- Organization materials: only members can view/edit

---

## 3. UI COMPONENT PATTERNS

### 3.1 Detail Page Layout Pattern
Evidence: From /src/app/(admin)/admin/organizations/[organizationId]/page.tsx (lines 64-360)

Structure:
1. Back navigation (lines 66-73)
2. Header card with title + status (lines 75-126)
3. Timeline/metadata card (lines 128-193)
4. Two-column grid for related data (lines 195-309)
5. Full-width table for detailed view (lines 311-358)

For Material Detail Page:
- Use max-w-6xl container
- Back button to /teacher/materials
- Header with icon, title, status badge
- Metadata card with created/updated dates
- Edit form section (inline or modal)
- Download/view file section

### 3.2 Form Pattern (Inline Editing)
Evidence: From /src/app/(teacher)/teacher/materials/MaterialUploadForm.tsx

Pattern: Client component with form state
"use client";

export function MaterialUploadForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      // Submit via server action or API
    } catch (err) {
      setError(error instanceof Error ? error.message : "Failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Title" name="title" required />
      <FormField label="Description" name="description" />
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}

For Material Detail Page:
- Create MaterialDetailForm.tsx (client component)
- Use useState for form state (title, description)
- Call PATCH /api/v1/teacher/materials/[materialId] on submit
- Show loading state during submission
- Display validation errors from API

---

## 4. FILE DOWNLOAD/VIEW PATTERNS

### 4.1 Download Route Pattern
Evidence: From /src/app/api/v1/admin/materials/[materialId]/download/route.ts (lines 19-92)

export const GET = withAuth(
  async (_request, context) => {
    try {
      const params = await context.params;
      const { materialId } = params;

      const supabase = createServerClient();

      // 1. Get material info
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select("id, source_file_path")
        .eq("id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!material || !material.source_file_path) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material has no attached file."),
        );
      }

      // 2. Generate signed URL from Supabase Storage
      const bucketName = process.env.SUPABASE_UPLOADS_BUCKET
        ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
        ?? "uploads";

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(material.source_file_path, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate download URL."),
        );
      }

      // 3. Redirect to signed URL
      return Response.redirect(signedUrlData.signedUrl, 302);
    } catch (err) {
      console.error("[admin/materials/download] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to process download request."),
      );
    }
  },
  { requiredRole: "super_admin" },
);

For Material Detail Page:
- Create teacher-accessible download route: /api/v1/teacher/materials/[materialId]/download
- Check ownership (personal or org membership)
- Generate signed URL with 1-hour expiry
- Redirect to Supabase Storage URL
- Add download button in detail page

---

## 5. TESTING PATTERNS (TDD VERIFICATION)

### 5.1 Unit Test Pattern
Evidence: From test files structure

tests/
├── api-teacher-endpoints.test.ts
├── api-uploads.test.ts
├── assignments-publications.test.ts
└── auth.test.ts

For Material Detail Page - Unit Tests:
describe("Material Detail Page", () => {
  describe("GET /api/v1/teacher/materials/[materialId]", () => {
    it("should return material with approval info for owner", async () => {
      // Setup: Create material, authenticate as owner
      // Assert: Response includes material + approval data
    });

    it("should forbid access for non-owner", async () => {
      // Setup: Create material, authenticate as different user
      // Assert: Returns 403 FORBIDDEN
    });

    it("should return 404 for deleted material", async () => {
      // Setup: Create material, soft-delete it
      // Assert: Returns 404 NOT_FOUND
    });
  });

  describe("PATCH /api/v1/teacher/materials/[materialId]", () => {
    it("should update title and description", async () => {
      // Setup: Create material, authenticate as owner
      // Action: PATCH with new title/description
      // Assert: Material updated, timestamps changed
    });

    it("should validate title length", async () => {
      // Setup: Create material
      // Action: PATCH with empty title
      // Assert: Returns VALIDATION_ERROR
    });

    it("should forbid update for non-owner", async () => {
      // Setup: Create material, authenticate as different user
      // Action: PATCH
      // Assert: Returns 403 FORBIDDEN
    });
  });
});

### 5.2 E2E Test Pattern
Evidence: From playwright.config.ts

tests/e2e/materials-detail.pw.ts
import { test, expect } from "@playwright/test";

test.describe("Material Detail Page", () => {
  test("should display material details and allow editing", async ({ page }) => {
    // 1. Login as teacher
    await page.goto("/teacher/login");
    await page.fill('input[name="email"]', "teacher@example.com");
    await page.fill('input[name="password"]', "password");
    await page.click("button:has-text('Sign in')");

    // 2. Navigate to materials list
    await page.goto("/teacher/materials");
    await expect(page.locator("h1")).toContainText("Personal Material Library");

    // 3. Click on a material
    await page.click("text=My Material");

    // 4. Verify detail page loaded
    await expect(page.locator("h1")).toContainText("My Material");
    await expect(page.locator("text=Draft")).toBeVisible();

    // 5. Edit title
    await page.fill('input[name="title"]', "Updated Title");
    await page.click("button:has-text('Save')");

    // 6. Verify update
    await expect(page.locator("text=Updated Title")).toBeVisible();
    await expect(page.locator("text=Material updated successfully")).toBeVisible();
  });

  test("should allow downloading material file", async ({ page }) => {
    // 1. Navigate to material detail
    // 2. Click download button
    // 3. Verify file download initiated
    const downloadPromise = page.waitForEvent("download");
    await page.click("button:has-text('Download')");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".pdf");
  });
});

### 5.3 Test Coverage Checklist
For Material Detail Page Implementation:

Access Control:
- [ ] Owner can view own material
- [ ] Non-owner cannot view material
- [ ] Deleted material returns 404
- [ ] Organization member can view org material

Display:
- [ ] Title, description, status displayed
- [ ] Approval timeline shown
- [ ] Rejection reason shown if rejected
- [ ] File path/download link shown

Editing:
- [ ] Title can be updated (min 1 char, max 255)
- [ ] Description can be updated (max 1000 chars)
- [ ] Empty description allowed
- [ ] Non-owner cannot edit
- [ ] Optimistic UI updates
- [ ] Error handling on failed update

Download:
- [ ] Download button visible if file exists
- [ ] Signed URL generated with 1-hour expiry
- [ ] Redirect to Supabase Storage works
- [ ] 404 if no file attached

Navigation:
- [ ] Back button returns to materials list
- [ ] Breadcrumb navigation works
- [ ] URL structure: /teacher/materials/[materialId]

---

## 6. BEST PRACTICE VERIFICATION STEPS

### 6.1 Pre-Implementation Checklist
- [ ] Review existing detail page pattern: /admin/organizations/[organizationId]/page.tsx
- [ ] Verify API route exists: /api/v1/teacher/materials/[materialId] (GET/PATCH)
- [ ] Check download route pattern: /api/v1/admin/materials/[materialId]/download
- [ ] Confirm Supabase schema: materials table with material_approvals relationship
- [ ] Validate auth guards: requireAreaAccess("teacher") and withAuth middleware

### 6.2 Implementation Verification
- [ ] Type Safety: Use TypeScript interfaces matching API response format
- [ ] Error Handling: Catch and display API errors with user-friendly messages
- [ ] Loading States: Show spinners during fetch and form submission
- [ ] Optimistic Updates: Update UI before API response (optional but recommended)
- [ ] Accessibility: Use semantic HTML, ARIA labels, keyboard navigation
- [ ] Performance: Memoize components, lazy-load file previews
- [ ] Security: Validate ownership server-side, never trust client-side checks

### 6.3 Testing Verification
- [ ] Unit Tests: API route handlers (GET, PATCH, download)
- [ ] Integration Tests: Form submission, data persistence
- [ ] E2E Tests: Full user flow (view -> edit -> download)
- [ ] Edge Cases: Deleted materials, permission denied, network errors
- [ ] Accessibility Tests: Screen reader compatibility, keyboard navigation

### 6.4 Code Quality Verification
- [ ] Linting: npm run lint passes
- [ ] Type Checking: tsc --noEmit passes
- [ ] Build: npm run build succeeds
- [ ] No Console Errors: Check browser console for warnings
- [ ] No Unhandled Rejections: All promises properly caught

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: API Layer (Already Exists)
- GET /api/v1/teacher/materials/[materialId] - Fetch material details
- PATCH /api/v1/teacher/materials/[materialId] - Update title/description
- GET /api/v1/admin/materials/[materialId]/download - Download file (adapt for teacher)

### Phase 2: Page Component
- [ ] Create src/app/(teacher)/teacher/materials/[materialId]/page.tsx
- [ ] Implement server-side data fetching
- [ ] Add ownership validation
- [ ] Render detail layout with header, metadata, edit form

### Phase 3: Edit Form Component
- [ ] Create src/app/(teacher)/teacher/materials/[materialId]/MaterialDetailForm.tsx
- [ ] Implement form state management
- [ ] Add validation feedback
- [ ] Handle API errors gracefully

### Phase 4: Download Functionality
- [ ] Create teacher download route: /api/v1/teacher/materials/[materialId]/download
- [ ] Add download button to detail page
- [ ] Test file download flow

### Phase 5: Testing
- [ ] Write unit tests for API routes
- [ ] Write E2E tests for user flows
- [ ] Verify accessibility compliance
- [ ] Performance testing

---

## 8. KEY DEPENDENCIES & IMPORTS

Page component:
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAreaAccess } from "@/lib/auth/guards";
import { apiGet } from "@/lib/api/server-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";

Form component:
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

API route:
import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { z } from "zod/v4";

---

## 9. SUMMARY

Framework: Next.js 15 App Router with async server components
Data Layer: Supabase with RLS policies and soft deletes
UI Components: Radix UI primitives + custom design system
State Management: React hooks (useState) + server-side caching
Testing: Bun test runner + Playwright for E2E
Auth: Session-based with role guards (teacher/admin)

Key Patterns:
1. Dynamic routes with [materialId] segment
2. Server-side data fetching with apiGet()
3. Ownership validation before rendering
4. Form submission via PATCH API
5. File download via signed Supabase URLs
6. Error handling with user-friendly messages
7. Revalidation of related paths after mutations

TDD Approach:
- Write API route tests first (GET, PATCH, download)
- Write E2E tests for user flows
- Verify accessibility and performance
- Use existing patterns as templates
