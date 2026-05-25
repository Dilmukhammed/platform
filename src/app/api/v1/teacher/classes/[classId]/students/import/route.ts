/**
 * POST /api/v1/teacher/classes/{classId}/students/import — Bulk import students.
 *
 * Creates student profiles, credentials, and enrollments in bulk.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { hashPin } from "@/lib/crypto/pin-hash";

const studentImportSchema = z.object({
  studentLogin: z.string().min(1).max(255),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  middleName: z.string().max(255).optional(),
  displayName: z.string().max(255).optional(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

const importSchema = z.object({
  students: z.array(studentImportSchema).min(1).max(100),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

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

      const { students } = validation.data;
      const supabase = createServerClient();

      // Verify teacher has access to this class and get class details
      const { data: classData, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id, classes!inner(id, organization_id)")
        .eq("class_id", classId)
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

      const results = {
        created: 0,
        existing: 0,
        failed: 0,
        errors: [] as Array<{ studentLogin: string; error: string }>,
      };

      // Process each student
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
            // Use existing profile
            studentProfileId = existingProfile.id;
            results.existing++;

            // Check if already enrolled
            const { data: existingEnrollment } = await supabase
              .from("class_enrollments")
              .select("id, status")
              .eq("class_id", classId)
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
              class_id: classId,
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
