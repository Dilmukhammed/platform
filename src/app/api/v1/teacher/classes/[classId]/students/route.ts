/**
 * GET /api/v1/teacher/classes/{classId}/students — List students in class.
 * POST /api/v1/teacher/classes/{classId}/students — Add a single student to class.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";
import { hashPin, comparePin } from "@/lib/crypto/pin-hash";

const addStudentSchema = z.object({
  studentLogin: z.string().min(1).max(255),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  middleName: z.string().max(255).optional(),
  displayName: z.string().max(255).optional(),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

// GET — List students
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const status = searchParams.get("status");

      const supabase = createServerClient();

      // Verify teacher has access to this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/students] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Build query for enrollments with student details
      let dbQuery = supabase
        .from("class_enrollments")
        .select(
          `
          id,
          status,
          joined_at,
          left_at,
          source,
          student_profiles!inner(
            id,
            student_login,
            first_name,
            last_name,
            middle_name,
            display_name,
            status
          )
        `,
          { count: "exact" },
        )
        .eq("class_id", classId)
        .is("deleted_at", null);

      if (status) {
        dbQuery = dbQuery.eq("status", status);
      }

      // Apply pagination
      const { data: enrollments, error, count } = await dbQuery
        .order("joined_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/students] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch students."),
        );
      }

      // Transform to response format
      const students = (enrollments ?? []).map((enrollment: Record<string, unknown>) => {
        const profile = enrollment.student_profiles as unknown as Record<string, unknown> | null;
        return {
          enrollmentId: enrollment.id,
          studentProfileId: profile?.id,
          studentLogin: profile?.student_login,
          firstName: profile?.first_name,
          lastName: profile?.last_name,
          middleName: profile?.middle_name,
          displayName: profile?.display_name,
          studentStatus: profile?.status,
          enrollmentStatus: enrollment.status,
          joinedAt: enrollment.joined_at,
          leftAt: enrollment.left_at,
          source: enrollment.source,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(students, paginationMeta));
    } catch (err) {
      console.error("[teacher/students] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch students."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Add single student
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const body = await request.json();
      const validation = addStudentSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid student data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { studentLogin, firstName, lastName, middleName, displayName, pin } = validation.data;
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
        console.error("[teacher/students] Teacher check error:", teacherError);
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

      // Check if student profile already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("student_profiles")
        .select("id, status")
        .eq("student_login", studentLogin)
        .is("deleted_at", null)
        .maybeSingle();

      if (profileCheckError) {
        console.error("[teacher/students] Profile check error:", profileCheckError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check existing student."),
        );
      }

      let studentProfileId: string;

      if (existingProfile) {
        // Use existing profile - but verify PIN matches
        studentProfileId = existingProfile.id;

        // Check if the provided PIN matches the existing student's PIN
        const { data: existingCredentials, error: credCheckError } = await supabase
          .from("student_credentials")
          .select("pin_hash")
          .eq("student_profile_id", studentProfileId)
          .is("deleted_at", null)
          .maybeSingle();

        if (credCheckError) {
          console.error("[teacher/students] Credential check error:", credCheckError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify student credentials."),
          );
        }

        if (existingCredentials) {
          const { matches } = await comparePin(pin, existingCredentials.pin_hash);
          if (!matches) {
            return toResponse(
              errorResponse(ErrorCodes.CONFLICT, "A student with this login already exists with a different PIN. Use the correct PIN to add them to this class, or choose a different login for a new student."),
            );
          }
        }

        // Check if already enrolled in this class
        const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
          .from("class_enrollments")
          .select("id, status")
          .eq("class_id", classId)
          .eq("student_profile_id", studentProfileId)
          .is("deleted_at", null)
          .maybeSingle();

        if (enrollmentCheckError) {
          console.error("[teacher/students] Enrollment check error:", enrollmentCheckError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check existing enrollment."),
          );
        }

        if (existingEnrollment) {
          if (existingEnrollment.status === "active") {
            return toResponse(
              errorResponse(ErrorCodes.CONFLICT, "Student is already enrolled in this class."),
            );
          }
          // Could reactivate - for now treat as conflict
          return toResponse(
            errorResponse(ErrorCodes.CONFLICT, "Student has a previous enrollment in this class."),
          );
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
          console.error("[teacher/students] Profile creation error:", profileError);
          
          // Check for unique constraint violation on student_login
          if (profileError?.code === "23505" || profileError?.message?.includes("student_login")) {
            return toResponse(
              errorResponse(ErrorCodes.CONFLICT, "A student with this login already exists."),
            );
          }
          
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create student profile."),
          );
        }

        studentProfileId = newProfile.id;

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
          console.error("[teacher/students] Credentials creation error:", credError);
        }
      }

      // Get or create organization_student record
      const { data: orgStudent, error: orgStudentError } = await supabase
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
        // Create organization student record
        const { data: newOrgStudent, error: createOrgStudentError } = await supabase
          .from("organization_students")
          .insert({
            organization_id: organizationId,
            student_profile_id: studentProfileId,
            status: "active",
          })
          .select("id")
          .single();

        if (createOrgStudentError) {
          console.error("[teacher/students] Org student creation error:", createOrgStudentError);
        } else if (newOrgStudent) {
          organizationStudentId = newOrgStudent.id;
        }
      }

      // Create enrollment
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("class_enrollments")
        .insert({
          organization_id: organizationId,
          class_id: classId,
          student_profile_id: studentProfileId,
          organization_student_id: organizationStudentId,
          status: "active",
          source: "manual",
        })
        .select("id, status, joined_at")
        .single();

      if (enrollmentError || !enrollment) {
        console.error("[teacher/students] Enrollment creation error:", enrollmentError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create enrollment."),
        );
      }

      return toResponse(
        successResponse({
          enrollmentId: enrollment.id,
          studentProfileId,
          studentLogin,
          firstName,
          lastName,
          displayName: displayName || `${firstName} ${lastName}`,
          status: enrollment.status,
          joinedAt: enrollment.joined_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/students] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to add student."),
      );
    }
  },
  { requiredRole: "teacher" },
);
