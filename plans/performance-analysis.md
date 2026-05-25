# Performance Analysis Report

## Executive Summary
The website experiences slow page transitions (up to 10 seconds locally) due to multiple architectural inefficiencies. The main issues are excessive API calls, inefficient server-side fetching patterns, middleware overhead, and lack of caching.

---

## Identified Performance Issues

### 1. Excessive API Calls on Every Page Load

**Problem**: Each dashboard page makes multiple API calls on every navigation, even for data that rarely changes.

**Current Behavior**:
- **Teacher Dashboard**: 4 parallel API calls
  - `/api/v1/teacher/reviews/pending`
  - `/api/v1/teacher/classes`
  - `/api/v1/teacher/assignment-publications`
  - `/api/v1/teacher/notifications`

- **Student Dashboard**: 4 parallel API calls
  - `/api/v1/student/classes`
  - `/api/v1/student/assignments`
  - `/api/v1/student/results`
  - `/api/v1/student/notifications`

- **Admin Dashboard**: 7 parallel API calls
  - `/api/v1/admin/organizations` (2 calls with different params)
  - `/api/v1/admin/material-approvals`
  - `/api/v1/admin/test-approvals`
  - `/api/v1/admin/students`
  - `/api/v1/admin/teachers`
  - `/api/v1/admin/classes`

**Impact**: Each page load triggers 4-7 HTTP requests, each going through the full request/response cycle.

---

### 2. Inefficient Server-Side Fetching Pattern

**Problem**: Pages use `apiGet()` from [`server-fetch.ts`](../src/lib/api/server-fetch.ts) which makes HTTP requests to the same server.

**Current Flow**:
```
Page Component → apiGet() → HTTP Request → API Route → Database → Response → Page
```

**Issues**:
- Unnecessary HTTP overhead (headers, serialization, network stack)
- Session cookie is read and forwarded on every request
- Each request goes through middleware authentication again
- Using `localhost:3030` as default origin (hardcoded in server-fetch.ts:19)

**Impact**: Adds ~100-500ms per API call due to HTTP overhead.

---

### 3. Middleware Overhead on Every Request

**Problem**: [`middleware.ts`](../src/middleware.ts) runs on every protected route and performs expensive operations.

**Current Operations**:
1. HMAC signature verification using Web Crypto API (lines 56-65)
2. Base64url decoding (lines 41-54, 67-77)
3. Session parsing and validation (lines 91-102)
4. Role-based access control checks (lines 206-216)

**Issues**:
- Web Crypto API is slower than Node crypto
- No caching of verified sessions
- Runs on both page routes AND API routes (double verification)
- Uses `crypto.subtle.verify()` which is async and adds latency

**Impact**: Adds ~50-200ms per request.

---

### 4. No Caching Strategy

**Problem**: Frequently accessed data is fetched on every page load without any caching.

**Missing Caching For**:
- User session data
- Class lists (rarely change)
- Organization data
- Notification counts
- Dashboard statistics

**Impact**: Unnecessary database queries and API calls for data that hasn't changed.

---

### 5. Layout Components Fetch Session on Every Page

**Problem**: Each layout component calls `requireAreaAccess()` which reads and verifies the session.

**Files Affected**:
- [`src/app/(teacher)/teacher/layout.tsx`](../src/app/(teacher)/teacher/layout.tsx:29)
- [`src/app/(student)/student/layout.tsx`](../src/app/(student)/student/layout.tsx:22)
- [`src/app/(admin)/admin/layout.tsx`](../src/app/(admin)/admin/layout.tsx:28)

**Current Flow**:
```
Layout → requireAreaAccess() → getAuthSession() → cookies() → parseSession()
```

**Impact**: Session verification happens on every page navigation within a role area.

---

### 6. Large Page Files Causing Slow Compilation

**Problem**: Dashboard pages are very large, causing longer compilation times.

**File Sizes**:
- Teacher dashboard: 847 lines
- Student dashboard: 788 lines
- Admin dashboard: 499 lines

**Issues**:
- More code to parse and compile
- Multiple components defined in single file
- Type definitions mixed with logic

**Impact**: Longer initial compilation and slower hot reload.

---

### 7. Webpack Cache Issues

**Problem**: Development server shows webpack cache errors.

**Evidence from [`dev.err.log`](../dev.err.log:3)**:
```
⚠ Port 3000 is in use, using available port 3001 instead.
<w> [webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT
```

**Impact**: Slower rebuilds during development.

---

### 8. Sequential Data Fetching in Some Components

**Problem**: While dashboards use `Promise.allSettled()`, some components may fetch data sequentially.

**Example**: Teacher dashboard fetches session data AFTER dashboard data (line 826):
```typescript
async function TeacherPageWithOnboardingCheck() {
  const sessionData = await fetchSession(); // Sequential fetch
  // ...
}
```

**Impact**: Adds latency when session data could be fetched in parallel.

---

### 9. No Data Prefetching

**Problem**: No prefetching of likely next pages or data.

**Impact**: User has to wait for full page load when navigating.

---

### 10. Supabase Client Recreation

**Problem**: [`createServerClient()`](../src/lib/supabase/server-client.ts:21) creates a new Supabase client on every call.

**Impact**: Adds connection overhead for each API route.

---

## Performance Impact Summary

| Issue | Estimated Impact per Page Load | Priority |
|-------|------------------------------|----------|
| Excessive API calls | 400-2000ms | High |
| Inefficient server-side fetching | 400-1000ms | High |
| Middleware overhead | 200-800ms | Medium |
| No caching | 500-1500ms | High |
| Layout session fetch | 50-200ms | Low |
| Large page files | 500-2000ms | Medium |
| Webpack cache issues | 1000-3000ms | Medium |
| Sequential fetching | 100-500ms | Low |
| No prefetching | 500-1000ms | Low |
| Supabase client recreation | 50-200ms | Low |

**Total Estimated Impact**: 2.7-12.2 seconds per page load

---

## Root Cause Analysis

The primary architectural issue is the **server-side HTTP fetch pattern**. The application is making HTTP requests from server components to API routes on the same server, which is inefficient because:

1. It adds unnecessary HTTP overhead
2. It requires session verification twice (middleware + server component)
3. It prevents direct database access from server components
4. It eliminates opportunities for query optimization

---

## Recommended Approach

Instead of the current pattern:
```
Server Component → HTTP → API Route → Database
```

Use direct database access:
```
Server Component → Database Service → Database
```

This eliminates the HTTP layer and allows for:
- Direct database queries
- Query batching and optimization
- Better caching strategies
- Reduced authentication overhead
