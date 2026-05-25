# REVIEW SYSTEM RESEARCH SUMMARY
# Repository-Local Documentation, Code Comments, Tests, and API Usage Patterns
# Generated: 2026-04-22

## PERSISTENCE ARCHITECTURE

### Database Schema (Supabase)
**File**: supabase/migrations/20260411001000_reviews.sql

**Core Tables**:
1. **submission_reviews** (parent entity)
   - id (uuid, PK)
   - assignment_result_id (uuid, FK → assignment_results)
   - reviewed_by_teacher_id (uuid, FK → platform_users)
   - status (enum: 'draft' | 'released')
   - released_at (timestamptz, nullable)
   - created_at, updated_at, deleted_at (soft-delete)
   - Unique constraint: one current review per result (where deleted_at IS NULL and status IN ('draft', 'released'))

2. **review_comments** (threaded comments)
   - id (uuid, PK)
   - submission_review_id (uuid, FK → submission_reviews)
   - author_type (enum: 'teacher' | 'student')
   - author_platform_user_id (uuid, nullable)
   - author_student_profile_id (uuid, nullable)
   - parent_comment_id (uuid, nullable, self-referential)
   - body (text, non-empty)
   - is_internal (boolean, default false)
   - created_at, updated_at, deleted_at
   - Constraints: exactly one author (XOR check), author_type consistency

3. **annotation_documents** (versioned JSON payloads)
   - id (uuid, PK)
   - submission_review_id (uuid, FK → submission_reviews)
   - derived_asset_id (uuid, FK → derived_assets)
   - page_index (integer, nullable)
   - version (integer, default 1, immutable)
   - is_current (boolean, default true)
   - base_width, base_height (integers, positive)
   - payload_json (jsonb, default {})
   - created_at, updated_at, deleted_at
   - Unique constraint: one current annotation per (review, asset, page)

### In-Memory Module (Legacy/Bootstrap)
**Files**: 
- src/modules/reviews/types.ts
- src/modules/reviews/store.ts
- src/modules/reviews/service.ts
- src/modules/reviews/bootstrap-data.ts

**Status**: ORPHANED - superseded by DB-backed API endpoints
- ReviewRecord type: id, submissionId, resultId, publicationId, studentId, teacherId, status, comment, createdAt, updatedAt, releasedAt
- Store: globalThis-based in-memory state (REVIEWS_STORE_KEY = "__platformArchitectureReviewsStore")
- Service: createOrUpdateReview(), getReviewBySubmissionId(), getReviewsByResultId()
- Bootstrap: initialReviewsData = [] (empty)
- **Note**: Access control in ccess.ts reads from in-memory submissions store (dead code path)

---

## RELEASE BEHAVIOR

### Teacher-Initiated Release
**Endpoint**: POST /api/v1/teacher/assignment-results/{assignmentResultId}/review/release
**File**: src/app/api/v1/teacher/assignment-results/[assignmentResultId]/review/release/route.ts

**Workflow**:
1. Verify teacher owns the assignment result (3-step auth chain: result → pub_class → class_teachers)
2. Check if review exists:
   - If NOT: create new review with status='released' and released_at=now()
   - If EXISTS: validate status != 'released' (idempotency check), validate teacher ownership
3. Update submission_reviews: status='released', released_at=now(), updated_at=now()
4. Update assignment_results: status='released', released_at=now(), updated_at=now()
5. Optional: create notification for student (type='review_released')

**Idempotency**: Returns CONFLICT (409) if already released

**Student Notification**:
- Payload: { assignmentResultId, reviewId, message: "Your assignment review has been released" }
- Recipient: student_profile (via notifications table)
- Optional: controlled by notifyStudent boolean in request body (default true)

### Test Attempt Review Completion
**Endpoint**: POST /api/v1/teacher/test-attempts/{attemptId}/complete-review
**File**: src/app/api/v1/teacher/test-attempts/[attemptId]/complete-review/route.ts

**Workflow**:
1. Fetch test_attempts with authorization chain (attempt → result → pub_class → test)
2. Validate: submitted_at exists, review_completed_at is null
3. Validate ALL non-autoScored questions have scores (no null scores)
4. Recalculate totalScore from question_results array
5. Update test_attempts: review_completed_at=now(), score_raw=totalScore
6. Update grade_records.test_score_raw (or create if missing)
7. If test.show_results='after_review': update assignment_results to status='released'

**Validation**: Returns VALIDATION_ERROR (422) with unscoredQuestionIds if incomplete

**Results Visibility**: Controlled by test.show_results enum:
- 'immediate': results visible after submission
- 'after_review': results visible after review_completed_at is set
- 'never': results never visible to student

---

## STUDENT-FACING REVIEW/RESULT READS

### Get Released Review (Student)
**Endpoint**: GET /api/v1/student/assignment-results/{assignmentResultId}/review
**File**: src/app/api/v1/student/assignment-results/[assignmentResultId]/review/route.ts

**Access Control**:
- Student can only read their own assignment result (class_enrollments.student_profile_id = session.userId)
- Review must have status='released'

**Response Structure**:
`
{
  assignmentResultId,
  status: 'released',
  releasedAt,
  assignment: { templateId, title, description },
  review: {
    reviewId,
    status: 'released',
    releasedAt,
    reviewedAt (fallback: updated_at),
    createdAt, updatedAt,
    teacherFeedback (fallback chain: teacher_feedback → feedback → overall_feedback),
    teacherSummary (fallback: teacher_summary → summary),
    reviewMetadata: {
      rubricSnapshot (fallback: rubric_snapshot_json → grade_breakdown_json),
      criteriaScores (fallback: criteria_scores_json → scores_json)
    }
  },
  comments: [{ commentId, authorType, parentCommentId, body, createdAt, updatedAt }],
  annotations: [{ annotationId, derivedAssetId, pageIndex, version, isCurrent, baseWidth, baseHeight, payloadJson, createdAt }],
  grade: { mappedGrade, practiceScore, testScore, finalScore, isOverridden, overrideReason, formulaSnapshot }
}
`

**Filtering**: 
- Comments: excludes is_internal=true (teacher-only comments hidden)
- Annotations: includes all (no filtering)

### Get Test Attempt Review (Teacher)
**Endpoint**: GET /api/v1/teacher/test-attempts/{attemptId}/review
**File**: src/app/api/v1/teacher/test-attempts/[attemptId]/review/route.ts

**Authorization**: Teacher must own the test (scope_type='personal' → owner_teacher_id, or scope_type='organization' → membership check)

**Response Structure**:
`
{
  attemptId,
  testId, testTitle, showResults,
  studentInfo: { studentProfileId, studentName },
  questions: [{
    questionId, orderIndex, questionType, prompt, optionsJson,
    studentAnswer, correctAnswer, explanation,
    currentScore, isCorrect, autoScored
  }],
  scoreRaw,
  submittedAt,
  reviewCompletedAt
}
`

**Question Data**:
- studentAnswer: from responses_json[questionId]
- correctAnswer: from answer_json (teacher-only, includes correct answers)
- currentScore: from question_results[questionId].score
- autoScored: from question_results[questionId].autoScored

---

## MIGRATION TOWARD ONE SOURCE OF TRUTH

### Current State: Dual Architecture
**DB-Backed (Primary)**:
- submission_reviews, review_comments, annotation_documents (Supabase)
- test_attempts.question_results (jsonb array)
- test_attempts.review_completed_at (timestamp)
- assignment_results.status, released_at

**In-Memory (Legacy/Orphaned)**:
- ReviewRecord store (globalThis-based)
- Access control via in-memory submissions store
- Bootstrap data (empty)

### API Endpoints (All DB-Backed)
**Teacher Review Management**:
- GET /api/v1/teacher/assignment-results/{id}/review - fetch review details
- POST /api/v1/teacher/assignment-results/{id}/review/release - release review
- GET /api/v1/teacher/reviews/pending - list pending reviews (status='submitted')
- GET /api/v1/teacher/test-attempts/{id}/review - fetch test attempt review
- POST /api/v1/teacher/test-attempts/{id}/complete-review - mark review complete

**Student Review Access**:
- GET /api/v1/student/assignment-results/{id}/review - fetch released review (status='released' only)

**Annotations** (via teacher review workspace):
- POST /api/v1/teacher/reviews/{reviewId}/annotations - save/update annotations

### Components (DB-Backed)
**Files**:
- src/components/review/ReviewWorkspace.tsx - submission review UI (uses saveReviewAction server action)
- src/components/review/TestQuestionReview.tsx - test question review UI (read-only for students, scoring for teachers)

**Server Actions**:
- src/modules/reviews/actions.ts - saveReviewAction (calls reviewsService, revalidates paths)

### Pending Cleanup
**Orphaned In-Memory Code** (from codebase audit):
- src/modules/reviews/store.ts - REMOVE (DB is source of truth)
- src/modules/reviews/service.ts - REMOVE (API endpoints replace)
- src/modules/reviews/bootstrap-data.ts - REMOVE (empty)
- src/modules/reviews/access.ts - REMOVE (reads dead in-memory store)
- src/modules/reviews/actions.ts - KEEP (still used by ReviewWorkspace component)

**Test Coverage**:
- 	ests/reviews-annotations.test.ts - tests in-memory service (will fail after cleanup)

---

## KEY ARCHITECTURAL PATTERNS

### Authorization Chain (3-Step Verification)
Used consistently across all teacher endpoints:
1. Fetch resource with inner join to verify ownership
2. Walk FK chain to get class_id
3. Verify teacher in class_teachers with status='active'

Example (review/release):
`
assignment_results → assignment_publication_classes → class_teachers
`

### Soft-Delete Pattern
All review tables use deleted_at (timestamptz, nullable):
- Unique constraints filter on deleted_at IS NULL
- Queries use .is("deleted_at", null)
- No hard deletes (preserve audit trail)

### Immutable Versioning (Annotations)
- annotation_documents.version increments on each save
- New record created (new id) for each version
- is_current=true marks latest
- Unique constraint: one current per (review, asset, page)
- History preserved (getAnnotationHistory returns all versions)

### Fallback Field Chains (Student API)
Review response includes fallback chains for flexible schema evolution:
- teacherFeedback: teacher_feedback → feedback → overall_feedback → null
- teacherSummary: teacher_summary → summary → null
- rubricSnapshot: rubric_snapshot_json → grade_breakdown_json → null
- criteriaScores: criteria_scores_json → scores_json → null

### Enum Consistency
**Test Show Results** (controls student result visibility):
- 'immediate': visible after submission
- 'after_review': visible after review_completed_at set
- 'never': never visible

**Review Status**:
- 'draft': in-progress
- 'released': visible to student

**Review Comment Author Type**:
- 'teacher': author_platform_user_id set, author_student_profile_id null
- 'student': author_student_profile_id set, author_platform_user_id null

---

## TESTING & VALIDATION

### Unit Tests
**File**: 	ests/reviews-annotations.test.ts
- Tests in-memory service (createOrUpdateReview, saveAnnotation, getAnnotationsByReviewId)
- Tests immutable versioning (version increments, new ids)
- Tests access control (requireTeacherOwnedSubmission, requireTeacherOwnedReview)
- **Status**: Will fail after in-memory code removal

### Test Scenarios (Manual QA)
**File**: QA_TEST_SCENARIOS.md
- Review release workflow (TC-REVIEW-T-001 through TC-REVIEW-T-010)
- Student review access (TC-REVIEW-S-001 through TC-REVIEW-S-005)
- Test attempt review and scoring (TC-TEST-REVIEW-T-001 through TC-TEST-REVIEW-T-010)

### Recent Migrations
**File**: supabase/migrations/20260421000100_test_scoring_review.sql
- Added test.show_results enum (immediate | after_review | never)
- Added test_attempts.question_results jsonb array
- Enables per-question scoring and conditional result visibility

---

## KNOWN ISSUES & TECHNICAL DEBT

### From Codebase Audit (2026-04-19)
1. **In-Memory Stores Superseded**: 13 bootstrap-data files, 13 store.ts files, 3 access.ts files (orphaned)
2. **Dual Architecture**: DB-backed APIs coexist with legacy in-memory modules
3. **Access Control**: In-memory access.ts reads from dead submissions store
4. **Test Coverage**: reviews-annotations.test.ts tests orphaned in-memory service

### Migration Blockers
- ReviewWorkspace component still calls saveReviewAction (which uses in-memory service)
- Need to migrate to direct API calls before removing in-memory code
- Test suite will fail after cleanup (needs rewrite for DB-backed tests)

---

## FILE PATHS SUMMARY

### Core Review System
- src/modules/reviews/types.ts - ReviewRecord, ReviewStatus types
- src/modules/reviews/service.ts - in-memory service (ORPHANED)
- src/modules/reviews/store.ts - in-memory store (ORPHANED)
- src/modules/reviews/actions.ts - saveReviewAction server action (KEEP)
- src/modules/reviews/access.ts - access control (ORPHANED)
- src/modules/reviews/bootstrap-data.ts - empty bootstrap (ORPHANED)

### API Endpoints
- src/app/api/v1/teacher/assignment-results/[assignmentResultId]/review/route.ts - GET review details
- src/app/api/v1/teacher/assignment-results/[assignmentResultId]/review/release/route.ts - POST release review
- src/app/api/v1/teacher/reviews/pending/route.ts - GET pending reviews list
- src/app/api/v1/teacher/test-attempts/[attemptId]/review/route.ts - GET test attempt review
- src/app/api/v1/teacher/test-attempts/[attemptId]/complete-review/route.ts - POST complete review
- src/app/api/v1/student/assignment-results/[assignmentResultId]/review/route.ts - GET released review
- src/app/api/v1/teacher/reviews/[reviewId]/annotations/route.ts - POST annotations

### Components
- src/components/review/ReviewWorkspace.tsx - submission review UI
- src/components/review/TestQuestionReview.tsx - test question review UI

### Database
- supabase/migrations/20260411001000_reviews.sql - submission_reviews, review_comments, annotation_documents schema
- supabase/migrations/20260421000100_test_scoring_review.sql - test.show_results enum, test_attempts.question_results

### Tests
- 	ests/reviews-annotations.test.ts - in-memory service tests (ORPHANED)
- QA_TEST_SCENARIOS.md - manual QA test cases

