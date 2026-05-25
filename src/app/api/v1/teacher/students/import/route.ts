/**
 * POST /api/v1/teacher/students/import — Org-level bulk import.
 *
 * Finds a class the teacher owns in the selected org and delegates
 * to the per-class import logic.
 */

import { z } from "zod/v4";
import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { hashPin } from "@/lib/crypto/pin-hash";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

const studentImportSchema = z.object({
  studentLogin: z.string().min(1).max(255),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  middleName: z.string().max(255).optional(),
  displayName: z.string().max(255).optional(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

const importSchema = z.object({
  classId: z.string().uuid().optional(),
  students: z.array(studentImportSchema).min(1).max(100),
});

export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const cookieStore = await cookies();
      const cookieOrgId = cookieStore.get(SELECTED_ORG_COOKIE)?.value ?? null;

      const supabase = createServerClient();

      let selectedOrgId: string | null = null;

      // If a cookie exists, verify the teacher still has an active membership
      if (cookieOrgId) {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("platform_user_id", session.userId)
          .eq("organization_id", cookieOrgId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[teacher/students/import] Membership check error:", membershipError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
          );
        }

        if (membership) {
          selectedOrgId = cookieOrgId;
        }
      }

      // No cookie or stale cookie: fall back to first active membership
      if (!selectedOrgId) {
        const { data: firstMembership, error: fetchError } = await supabase
          .from("organization_memberships")
          .select("id, organization_id, role, status, organizations!inner(id, name, slug)")
          .eq("platform_user_id", session.userId)
          .eq("status", "active")
          .is("deleted_at", null)
          .is("organizations.deleted_at", null)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error("[teacher/students/import] Fallback membership fetch error:", fetchError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organization membership."),
          );
        }

        if (!firstMembership) {
          return toResponse(
            errorResponse(ErrorCodes.VALIDATION_ERROR, "No organization selected. Please select an organization first."),
          );
        }

        selectedOrgId = firstMembership.organization_id;
      }

      const body = await request.json();
      const validation = importSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid import data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { classId, students } = validation.data;

      // Determine which class to import into
      let targetClassId = classId;

      if (!targetClassId) {
        // Find the first class the teacher teaches in this org
        const { data: classTeacher, error: classError } = await supabase
          .from("class_teachers")
          .select("class_id")
          .eq("platform_user_id", session.userId)
          .eq("status", "active")
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();

        if (classError) {
          console.error("[teacher/students/import] Class lookup error:", classError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to find a class for import."),
          );
        }

        if (!classTeacher) {
          return toResponse(
            errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "No class found for this teacher in the selected organization. Please create a class first."),
          );
        }

        targetClassId = classTeacher.class_id;
      }

      // Verify teacher has access to this class and it belongs to the selected org
      const { data: classData, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id, classes!inner(id, organization_id)")
        .eq("class_id", targetClassId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/students/import] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classData) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      const classInfo = classData.classes as unknown as Record<string, unknown> | null;
      const organizationId = classInfo?.organization_id as string;

      if (organizationId !== selectedOrgId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "This class does not belong to the selected organization."),
        );
      }

      // Process each student (same logic as per-class import)
      const results = {
        created: 0,
        existing: 0,
        failed: 0,
        errors: [] as Array<{ studentLogin: string; error: string }>,
      };

      for (const student of students) {
        try {
          const { studentLogin, firstName, lastName, middleName, displayName, pin } = student;

          // Check if student profile already exists
          const { data: existingProfile, error: profileCheckError } = await supabase
            .from("student_profiles")
            .select("id, status")
            .eq("student_login", studentLogin)
            .is("deleted_at", null)
            .maybeSingle();

          if (profileCheckError) {
            results.failed++;
            results.errors.push({ studentLogin, error: "Failed to check existing student" });
            continue;
          }

          let studentProfileId: string;

          if (existingProfile) {
            studentProfileId = existingProfile.id;
            results.existing++;

            // Check if already enrolled
            const { data: existingEnrollment } = await supabase
              .from("class_enrollments")
              .select("id, status")
              .eq("class_id", targetClassId)
              .eq("student_profile_id", studentProfileId)
              .is("deleted_at", null)
              .maybeSingle();

            if (existingEnrollment) {
              if (existingEnrollment.status === "active") {
                results.errors.push({ studentLogin, error: "Already enrolled in this class" });
              }
              continue;
            }
          } else {
            // Create new student profile
            const { data: newProfile, error: profileError } = await supabase
              .from("student_profiles")
              .insert({
                student_login: studentLogin,
                first_name: firstName,
                last_name: lastName,
                middle_name: middleName || null,
                display_name: displayName || `${firstName} ${lastName}`,
                status: "active",
              })
              .select("id")
              .single();

            if (profileError || !newProfile) {
              results.failed++;
              results.errors.push({ studentLogin, error: "Failed to create student profile" });
              continue;
            }

            studentProfileId = newProfile.id;
            results.created++;

            // Create student credentials with bcrypt hashed PIN
            const pinHash = await hashPin(pin);
            const { error: credError } = await supabase
              .from("student_credentials")
              .insert({
                student_profile_id: studentProfileId,
                pin_hash: pinHash,
                status: "active",
              });

            if (credError) {
              console.error(`[teacher/students/import] Credentials error for ${studentLogin}:`, credError);
            }
          }

          // Get or create organization_student record
          const { data: orgStudent } = await supabase
            .from("organization_students")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("student_profile_id", studentProfileId)
            .is("deleted_at", null)
            .maybeSingle();

          let organizationStudentId: string | null = null;

          if (orgStudent) {
            organizationStudentId = orgStudent.id;
          } else {
            const { data: newOrgStudent } = await supabase
              .from("organization_students")
              .insert({
                organization_id: organizationId,
                student_profile_id: studentProfileId,
                status: "active",
              })
              .select("id")
              .single();

            if (newOrgStudent) {
              organizationStudentId = newOrgStudent.id;
            }
          }

          // Create enrollment
          const { error: enrollmentError } = await supabase
            .from("class_enrollments")
            .insert({
              organization_id: organizationId,
              class_id: targetClassId,
              student_profile_id: studentProfileId,
              organization_student_id: organizationStudentId,
              status: "active",
              source: "bulk_import",
            });

          if (enrollmentError) {
            results.failed++;
            results.errors.push({ studentLogin, error: "Failed to create enrollment" });
            continue;
          }
        } catch (err) {
          results.failed++;
          results.errors.push({
            studentLogin: student.studentLogin,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return toResponse(
        successResponse({
          classId: targetClassId,
          totalProcessed: students.length,
          profilesCreated: results.created,
          existingProfilesUsed: results.existing,
          failed: results.failed,
          errors: results.errors.length > 0 ? results.errors : undefined,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/students/import] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to import students."),
      );
    }
  },
  { requiredRole: "teacher" },
);
