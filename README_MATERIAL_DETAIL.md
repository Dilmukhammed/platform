# MATERIAL DETAIL PAGE - RESEARCH INDEX
## Complete Pattern Analysis for Implementation

**Date**: April 18, 2026  
**Framework**: Next.js 15.3.5 + React 19 + TypeScript 5.7 + Supabase  
**Scope**: Read-only codebase analysis for material detail page with edit/download

---

## DOCUMENT GUIDE

### 1. MATERIAL_DETAIL_SUMMARY.md (10 KB)
**Start here** - Executive summary with quick reference

Contains:
- Existing patterns overview (detail page, API routes, form, card)
- Implementation checklist (4 phases)
- Key patterns to follow (code snippets)
- TDD verification steps
- File locations to reference

**Best for**: Getting oriented, understanding scope, planning implementation

---

### 2. MATERIAL_DETAIL_PAGE_PATTERNS.md (18 KB)
**Deep dive** - Comprehensive pattern analysis

Contains:
- Framework patterns (App Router, RSC, API routes)
- Data layer patterns (Supabase, material structure, permissions)
- UI component patterns (detail layout, forms, status display)
- File download/view patterns
- Testing patterns (unit, E2E, coverage checklist)
- Best practice verification steps
- Implementation roadmap
- Key dependencies & imports

**Best for**: Understanding architecture, learning patterns, detailed reference

---

### 3. MATERIAL_DETAIL_CODE_EXAMPLES.md (5 KB)
**Implementation guide** - Concrete code templates

Contains:
- Page component template (async server component)
- Edit form component template (client component)
- Download route template (API handler)
- Unit test template (Bun)
- E2E test template (Playwright)
- Implementation checklist
- Key patterns to follow
- Key imports reference

**Best for**: Copy-paste templates, implementation reference, code structure

---

## QUICK START

### For Developers
1. Read: MATERIAL_DETAIL_SUMMARY.md (5 min)
2. Review: Reference files in codebase
3. Code: Use MATERIAL_DETAIL_CODE_EXAMPLES.md templates
4. Test: Follow testing patterns from MATERIAL_DETAIL_PAGE_PATTERNS.md

### For Architects
1. Read: MATERIAL_DETAIL_PAGE_PATTERNS.md (15 min)
2. Review: Framework patterns section
3. Verify: Best practice verification steps
4. Plan: Implementation roadmap

### For QA/Testing
1. Read: Testing patterns section in MATERIAL_DETAIL_PAGE_PATTERNS.md
2. Review: Test coverage checklist
3. Use: E2E test template from MATERIAL_DETAIL_CODE_EXAMPLES.md
4. Verify: TDD verification steps

---

## KEY FINDINGS

### Framework Pattern
**Next.js 15 App Router** with async server components

```
src/app/(teacher)/teacher/materials/[materialId]/page.tsx
├── Async server component
├── Dynamic [materialId] segment
├── Server-side data fetch via apiGet()
├── Ownership validation
└── Multi-section layout
```

### API Routes (Already Exist)
- GET /api/v1/teacher/materials/[materialId] - Fetch details
- PATCH /api/v1/teacher/materials/[materialId] - Update title/description
- GET /api/v1/admin/materials/[materialId]/download - Download (adapt for teacher)

### Data Structure
```typescript
MaterialDetail {
  materialId: string;
  title: string;
  description: string | null;
  scopeType: "personal" | "organization";
  ownerTeacherId: string;
  status: "draft" | "active" | "archived";
  sourceFilePath: string | null;
  createdAt: string;
  updatedAt: string;
  pendingApproval: { approvalId, decision, requestedAt } | null;
  lastDecision: { approvalId, decision, decisionReason, reviewedAt } | null;
}
```

### Ownership Rules
- **Personal scope**: Only owner (ownerTeacherId) can view/edit
- **Organization scope**: Only members can view/edit
- **Download**: Check ownership before generating signed URL

### UI Layout
1. Back navigation
2. Header card (title + status badge)
3. Metadata card (created, updated, approval timeline)
4. Rejection reason (if applicable)
5. Edit form (only for owner)
6. Download section (if file exists)

### Form Pattern
- Client component with useState
- PATCH API submission
- Loading state during submission
- Error display from API
- Success feedback with auto-hide

### Download Pattern
- Signed Supabase Storage URL
- 1-hour expiry
- 302 redirect
- Ownership check before generation

---

## IMPLEMENTATION ROADMAP

### Phase 1: Page Component (1-2 hours)
- Create: src/app/(teacher)/teacher/materials/[materialId]/page.tsx
- Fetch material via apiGet()
- Render detail layout
- Check ownership for edit controls

### Phase 2: Edit Form (1-2 hours)
- Create: MaterialDetailForm.tsx (client component)
- Form state management
- PATCH API submission
- Error/success handling

### Phase 3: Download Route (30 min - 1 hour)
- Create: /api/v1/teacher/materials/[materialId]/download/route.ts
- Adapt from admin download route
- Add ownership check
- Test file download

### Phase 4: Testing (1-2 hours)
- Unit tests: API routes
- E2E tests: User flows
- Accessibility audit
- Performance verification

**Total Estimated Effort**: 4-6 hours

---

## REFERENCE FILES IN CODEBASE

### Detail Page Example (361 lines)
`src/app/(admin)/admin/organizations/[organizationId]/page.tsx`
- Layout structure
- Server component pattern
- Data fetching
- Ownership validation
- Multi-section rendering

### API Route Examples
`src/app/api/v1/teacher/materials/[materialId]/route.ts` (225 lines)
- GET: Fetch with approval info
- PATCH: Update with validation
- Ownership checks
- Zod validation

`src/app/api/v1/admin/materials/[materialId]/download/route.ts` (92 lines)
- Download route pattern
- Signed URL generation
- Error handling

### Form Component Example
`src/app/(teacher)/teacher/materials/MaterialUploadForm.tsx`
- Client component pattern
- Form state management
- Error handling
- Loading states

### Card Component Example
`src/app/(teacher)/teacher/materials/MaterialCard.tsx` (222 lines)
- Status mapping
- Conditional rendering
- Modal integration
- Success messages

---

## TESTING CHECKLIST

### Unit Tests
- [ ] GET: Owner can fetch, non-owner gets 403, deleted returns 404
- [ ] PATCH: Owner can update, validation errors, non-owner gets 403
- [ ] Download: Owner can download, non-owner gets 403, no file returns 404

### E2E Tests
- [ ] Display material details
- [ ] Edit title and description
- [ ] Download material file
- [ ] Show rejection reason if rejected
- [ ] Prevent non-owner from editing

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] ARIA labels present
- [ ] Focus management correct

### Performance
- [ ] No unnecessary re-renders
- [ ] Lazy-load file previews
- [ ] Optimize images
- [ ] Minimize bundle size

---

## BEST PRACTICES

### Security
- Validate ownership server-side (never trust client)
- Check permissions before returning data
- Use signed URLs with expiry for downloads
- Validate all user input with Zod

### Performance
- Fetch data server-side (RSC)
- Memoize components to prevent re-renders
- Lazy-load file previews
- Use optimistic updates for forms

### Accessibility
- Use semantic HTML
- Add ARIA labels
- Support keyboard navigation
- Test with screen readers

### Testing
- Write tests before implementation (TDD)
- Test happy path and error cases
- Test edge cases (deleted, permission denied)
- Test accessibility compliance

---

## SUMMARY

**Framework**: Next.js 15 App Router with async server components  
**Data**: Supabase with RLS policies and soft deletes  
**UI**: Radix UI primitives + custom design system  
**Auth**: Session-based with role guards (teacher/admin)  
**Testing**: Bun test runner + Playwright for E2E  

**Key Patterns**:
1. Dynamic routes with [materialId] segment
2. Server-side data fetching with apiGet()
3. Ownership validation before rendering
4. Form submission via PATCH API
5. File download via signed Supabase URLs
6. Error handling with user-friendly messages
7. Revalidation of related paths after mutations

**Implementation Order**:
1. Page component (fetch + display)
2. Edit form (client component)
3. Download route (API handler)
4. Tests (unit + E2E)

**Estimated Effort**: 4-6 hours (including tests)

---

## NEXT STEPS

1. **Review**: Read MATERIAL_DETAIL_SUMMARY.md
2. **Understand**: Study MATERIAL_DETAIL_PAGE_PATTERNS.md
3. **Implement**: Use MATERIAL_DETAIL_CODE_EXAMPLES.md templates
4. **Test**: Follow testing patterns and checklist
5. **Verify**: Run TDD verification steps

Good luck with implementation!
