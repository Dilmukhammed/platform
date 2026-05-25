/**
 * GET /api/v1/system/lookups — Get enum/reference data for frontend dropdowns.
 *
 * Public endpoint - no authentication required. Returns all enum values
 * defined in the database schema for use in frontend forms and filters.
 */

import { successResponse, toResponse } from "@/lib/api/envelope";

/**
 * All enum values from the database schema.
 * These match the PostgreSQL enum types defined in migrations.
 */
const LOOKUP_DATA = {
  // User-related enums
  userRoles: ["super_admin", "teacher"],
  userStatuses: ["active", "suspended", "archived"],

  // Organization-related enums
  organizationStatuses: ["pending", "active", "suspended", "archived"],
  organizationMembershipRoles: ["owner", "manager", "teacher"],
  organizationMembershipStatuses: ["pending", "active", "revoked", "archived"],

  // Student-related enums
  studentStatuses: ["active", "blocked", "archived"],
  studentCredentialStatuses: ["active", "locked", "reset_required", "archived"],

  // Class-related enums
  classStatuses: ["draft", "active", "archived"],
  classTeacherRoles: ["owner", "assistant"],
  joinCodeStatuses: ["active", "inactive", "expired", "revoked"],

  // Enrollment-related enums
  enrollmentStatuses: ["active", "inactive", "left", "archived"],
  enrollmentSources: ["manual", "bulk_import", "self_join"],

  // Library/content enums
  libraryScopes: ["personal", "organization"],
  materialStatuses: ["draft", "active", "archived"],
  testStatuses: ["draft", "active", "archived"],

  // Assignment-related enums
  assignmentTemplateStatuses: ["draft", "active", "archived"],
  assignmentPublicationStatuses: ["draft", "published", "closed", "archived"],
  assignmentResultStatuses: [
    "not_started",
    "in_progress",
    "submitted",
    "reviewed",
    "released",
    "archived",
  ],

  // Submission-related enums
  submissionFileRoles: ["main", "attachment", "reference", "source"],
  submissionFileKinds: ["image", "pdf", "dwg", "other"],

  // Review-related enums
  reviewStatuses: ["draft", "released", "archived"],
  reviewCommentAuthorTypes: ["teacher", "student"],
  approvalDecisions: ["pending", "approved", "rejected"],

  // Grade-related enums
  gradeRecordStatuses: ["current", "superseded", "archived"],

  // Notification-related enums
  notificationRecipientTypes: ["platform_user", "student_profile"],

  // Derived asset enums
  derivedAssetKinds: ["compressed_preview", "thumbnail", "pdf_page_preview"],
};

export async function GET(): Promise<Response> {
  return toResponse(successResponse(LOOKUP_DATA));
}
