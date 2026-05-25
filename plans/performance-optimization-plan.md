# Performance Optimization Plan

## Overview
This plan outlines actionable steps to improve page load performance from current 2-10 seconds to target <1 second for most page transitions.

---

## Phase 1: Quick Wins (Immediate Impact)

### 1.1 Implement React Query for Client-Side Caching
**Priority**: Critical
**Estimated Impact**: 50-70% reduction in perceived load time

**Actions**:
- Install `@tanstack/react-query`
- Create a QueryProvider component
- Wrap app with QueryProvider
- Configure staleTime and cacheTime for different data types
- Use `useQuery` hooks for dashboard data fetching

**Files to Modify**:
- `src/app/layout.tsx` - Add QueryProvider
- `src/app/(teacher)/teacher/page.tsx` - Convert to client components with useQuery
- `src/app/(student)/student/page.tsx` - Convert to client components with useQuery
- `src/app/(admin)/admin/page.tsx` - Convert to client components with useQuery

**Benefits**:
- Automatic caching of API responses
- Background refetching
- Optimistic updates
- Reduced network requests

---

### 1.2 Add Next.js Data Caching
**Priority**: Critical
**Estimated Impact**: 30-50% reduction in server load

**Actions**:
- Add `revalidate` tags to API routes
- Implement `fetch` with `next: { revalidate: 60 }` for semi-static data
- Use `unstable_cache` for expensive computations
- Cache user session data for 5 minutes

**Files to Modify**:
- All API routes in `src/app/api/v1/`
- Create `src/lib/cache.ts` for cache utilities

**Example**:
```typescript
// Cache user data for 5 minutes
const getCachedUserData = unstable_cache(
  async (userId) => getUserData(userId),
  ['user-data'],
  { revalidate: 300 }
);
```

---

### 1.3 Optimize Middleware
**Priority**: High
**Estimated Impact**: 100-300ms per request

**Actions**:
- Cache verified sessions in memory
- Use Node crypto instead of Web Crypto for server-side
- Add early returns for static assets
- Exclude public routes from middleware matcher

**Files to Modify**:
- `src/middleware.ts`

**Changes**:
```typescript
// Add session cache
const sessionCache = new Map<string, { session: SessionEnvelope['session'], expires: number }>();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = matchProtectedArea(pathname);
  if (!match) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!cookie) return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(match.area);

  // Check cache first
  const cached = sessionCache.get(cookie);
  if (cached && cached.expires > Date.now()) {
    return validateRole(cached.session, match.area, pathname, request);
  }

  // Verify and cache
  const session = await verifyAndCacheSession(cookie);
  // ...
}
```

---

### 1.4 Fix Webpack Cache Issues
**Priority**: High
**Estimated Impact**: 1-3 seconds during development

**Actions**:
- Clear `.next/cache` directory
- Add `.gitignore` entry for cache
- Configure webpack cache properly in `next.config.ts`
- Ensure file system permissions are correct

**Files to Modify**:
- `next.config.ts`
- `.gitignore`

---

## Phase 2: Architectural Improvements

### 2.1 Replace HTTP Fetch with Direct Database Access
**Priority**: Critical
**Estimated Impact**: 40-60% reduction in response time

**Actions**:
- Create server-side data access layer
- Move business logic from API routes to service functions
- Update dashboard pages to use direct data access
- Keep API routes for client-side mutations only

**New Files to Create**:
- `src/lib/data-access/` - Data access layer
- `src/lib/data-access/teacher.ts` - Teacher data access
- `src/lib/data-access/student.ts` - Student data access
- `src/lib/data-access/admin.ts` - Admin data access

**Example Structure**:
```typescript
// src/lib/data-access/teacher.ts
export async function getTeacherDashboardData(userId: string) {
  const supabase = createServerClient();
  
  const [reviews, classes, publications, notifications] = await Promise.all([
    getPendingReviews(supabase, userId),
    getTeacherClasses(supabase, userId),
    getActivePublications(supabase, userId),
    getUnreadNotifications(supabase, userId),
  ]);

  return { reviews, classes, publications, notifications };
}
```

**Files to Modify**:
- `src/app/(teacher)/teacher/page.tsx`
- `src/app/(student)/student/page.tsx`
- `src/app/(admin)/admin/page.tsx`

---

### 2.2 Implement Query Batching
**Priority**: Medium
**Estimated Impact**: 20-30% reduction in database queries

**Actions**:
- Combine related queries into single database calls
- Use Supabase joins instead of separate queries
- Implement DataLoader pattern for N+1 queries

**Example**:
```typescript
// Instead of multiple queries
const classes = await getClasses(userId);
const classIds = classes.map(c => c.id);
const students = await getStudentsForClasses(classIds);

// Use join
const classesWithStudents = await supabase
  .from('classes')
  .select(`
    *,
    class_students (
      student:student_profiles(*)
    )
  `)
  .eq('teacher_id', userId);
```

---

### 2.3 Add Database Indexes
**Priority**: Medium
**Estimated Impact**: 10-40% reduction in query time

**Actions**:
- Analyze slow queries
- Add indexes on frequently queried columns
- Create composite indexes for common query patterns

**Recommended Indexes**:
```sql
-- Teacher queries
CREATE INDEX idx_class_teacher_id ON classes(teacher_id);
CREATE INDEX idx_publication_teacher_id ON assignment_publications(published_by_teacher_id);

-- Student queries
CREATE INDEX idx_enrollment_student_id ON class_enrollments(student_id);
CREATE INDEX idx_assignment_result_student_id ON assignment_results(student_id);

-- Notification queries
CREATE INDEX idx_notification_recipient_read ON notifications(recipient_platform_user_id, is_read);
```

---

### 2.4 Optimize Session Management
**Priority**: Medium
**Estimated Impact**: 50-200ms per request

**Actions**:
- Store minimal data in session cookie
- Cache session verification results
- Use JWT instead of HMAC-signed cookies
- Implement session refresh token pattern

**Files to Modify**:
- `src/lib/auth/session.ts`
- `src/middleware.ts`

---

## Phase 3: Code Optimization

### 3.1 Split Large Page Files
**Priority**: Medium
**Estimated Impact**: 500-2000ms faster compilation

**Actions**:
- Extract components to separate files
- Create component directories for each dashboard
- Move types to separate files
- Use barrel exports for cleaner imports

**New Structure**:
```
src/app/(teacher)/teacher/
├── page.tsx (main entry)
├── components/
│   ├── dashboard-content.tsx
│   ├── pending-reviews-section.tsx
│   ├── classes-summary-section.tsx
│   ├── active-publications-section.tsx
│   └── notifications-preview.tsx
├── types.ts
└── api.ts
```

---

### 3.2 Implement Code Splitting
**Priority**: Low
**Estimated Impact**: 10-20% faster initial load

**Actions**:
- Use dynamic imports for heavy components
- Split route groups
- Lazy load non-critical components

**Example**:
```typescript
const HeavyChart = dynamic(() => import('@/components/charts/heavy-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});
```

---

### 3.3 Optimize Bundle Size
**Priority**: Low
**Estimated Impact**: 5-15% faster load time

**Actions**:
- Analyze bundle with `@next/bundle-analyzer`
- Remove unused dependencies
- Tree-shake imports
- Use lighter alternatives for heavy libraries

---

### 3.4 Add Loading States and Skeletons
**Priority**: Low
**Estimated Impact**: Improved perceived performance

**Actions**:
- Implement proper Suspense boundaries
- Add skeleton screens for all data loading
- Show optimistic updates for mutations
- Add progress indicators for long operations

---

## Phase 4: Advanced Optimizations

### 4.1 Implement Edge Runtime for Static Routes
**Priority**: Low
**Estimated Impact**: 50-100ms faster for static routes

**Actions**:
- Move static routes to Edge runtime
- Use Edge functions for auth checks
- Cache static content at edge

---

### 4.2 Add Server-Side Streaming
**Priority**: Low
**Estimated Impact**: Improved perceived load time

**Actions**:
- Use React Server Components streaming
- Implement progressive rendering
- Stream large data sets

---

### 4.3 Implement CDN for Static Assets
**Priority**: Low
**Estimated Impact**: 100-500ms faster asset loading

**Actions**:
- Configure CDN for images
- Optimize images with next/image
- Use CDN for JavaScript bundles

---

## Implementation Priority

### Sprint 1 (Week 1) - Critical Fixes
1. Fix Webpack cache issues
2. Implement React Query for client-side caching
3. Add Next.js data caching
4. Optimize middleware

**Expected Improvement**: 60-80% reduction in load time

### Sprint 2 (Week 2) - Architectural Changes
1. Replace HTTP fetch with direct database access
2. Implement query batching
3. Add database indexes
4. Optimize session management

**Expected Improvement**: Additional 40-60% reduction

### Sprint 3 (Week 3) - Code Optimization
1. Split large page files
2. Implement code splitting
3. Optimize bundle size
4. Add loading states

**Expected Improvement**: Additional 10-20% reduction

### Sprint 4 (Week 4) - Advanced Optimizations
1. Implement Edge runtime
2. Add server-side streaming
3. Configure CDN

**Expected Improvement**: Additional 5-10% reduction

---

## Success Metrics

### Target Performance Goals
- **Initial Page Load**: <2 seconds
- **Page Transitions**: <500ms
- **Time to Interactive**: <1.5 seconds
- **First Contentful Paint**: <800ms

### Monitoring
- Add performance monitoring with Web Vitals
- Track API response times
- Monitor database query performance
- Measure cache hit rates

---

## Risk Assessment

### High Risk Changes
- Replacing HTTP fetch with direct database access
- Changing session management approach

**Mitigation**:
- Implement feature flags
- Gradual rollout
- Extensive testing
- Rollback plan

### Medium Risk Changes
- Optimizing middleware
- Adding database indexes

**Mitigation**:
- Test in staging environment
- Monitor performance metrics
- Have rollback procedures ready

### Low Risk Changes
- Adding React Query
- Implementing caching
- Splitting files

**Mitigation**:
- Standard code review
- Unit tests

---

## Testing Strategy

### Performance Testing
1. Load testing with k6 or Artillery
2. Measure before and after metrics
3. Test with realistic data volumes
4. Monitor memory usage

### Regression Testing
1. Ensure all functionality still works
2. Test authentication flows
3. Verify data consistency
4. Check error handling

---

## Rollback Plan

If performance degrades after changes:
1. Revert to previous commit
2. Identify the problematic change
3. Fix and re-deploy
4. Monitor closely

---

## Next Steps

1. Review this plan with the team
2. Prioritize based on business impact
3. Assign tasks to developers
4. Set up monitoring and metrics
5. Begin Sprint 1 implementation
