/**
 * POST /api/v1/student/classes/join-by-code — Join a class using a join code.
 *
 * Validates the join code, checks expiration, creates enrollment and assignment results.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const joinSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Join code must be exactly 6 digits."),
});

type JoinOutcome = "joined" | "already_enrolled" | "previous_enrollment";

export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = joinSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid join code.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { code } = validation.data;
      const supabase = createServerClient();

      // Find active join code
      const { data: joinCode, error: codeError } = await supabase
        .from("class_join_codes")
        .select(
          `
          id,
          class_id,
          code,
          valid_from,
          valid_until,
          status
        `,
        )
        .eq("code", code)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (codeError) {
        console.error("[student/join-by-code] Join code query error:", codeError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to validate join code."),
        );
      }

      if (!joinCode) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Invalid or expired join code."),
        );
      }

      // Check if code is expired
      const now = new Date();
      const validFrom = new Date(joinCode.valid_from);
      const validUntil = joinCode.valid_until ? new Date(joinCode.valid_until) : null;

      if (now < validFrom) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Join code is not yet valid."),
        );
      }

      if (validUntil && now > validUntil) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Join code has expired."),
        );
      }

      const classId = joinCode.class_id;

      // Get class details
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id, title, organization_id, status")
        .eq("id", classId)
        .is("deleted_at", null)
        .maybeSingle();

      if (classError || !classData) {
        console.error("[student/join-by-code] Class query error:", classError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch class details."),
        );
      }

      if (classData.status !== "active") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "This class is not currently active."),
        );
      }

      // Check if already enrolled
      const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
        .from("class_enrollments")
        .select("id, status")
        .eq("class_id", classId)
        .eq("student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (enrollmentCheckError) {
        console.error("[student/join-by-code] Enrollment check error:", enrollmentCheckError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check existing enrollment."),
        );
      }

      if (existingEnrollment) {
        if (existingEnrollment.status === "active") {
          return toResponse(
            successResponse({
              enrollmentId: existingEnrollment.id,
              classId: classData.id,
              classTitle: classData.title,
              status: existingEnrollment.status,
              joinedAt: null,
              assignmentResultsCreated: 0,
              joinOutcome: "already_enrolled" satisfies JoinOutcome,
              message: "Already enrolled in this class.",
            }),
          );
        }
        return toResponse(
          successResponse({
            enrollmentId: existingEnrollment.id,
            classId: classData.id,
            classTitle: classData.title,
            status: existingEnrollment.status,
            joinedAt: null,
            assignmentResultsCreated: 0,
            joinOutcome: "previous_enrollment" satisfies JoinOutcome,
            message: "You have a previous enrollment in this class.",
          }),
        );
      }

      // Get organization_student_id if exists
      const { data: orgStudent, error: orgStudentError } = await supabase
        .from("organization_students")
        .select("id")
        .eq("organization_id", classData.organization_id)
        .eq("student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (orgStudentError) {
        console.error("[student/join-by-code] Org student query error:", orgStudentError);
      }

      // Create enrollment
      const { data: enrollment, error: createError } = await supabase
        .from("class_enrollments")
        .insert({
          organization_id: classData.organization_id,
          class_id: classId,
          student_profile_id: session.userId,
          organization_student_id: orgStudent?.id ?? null,
          status: "active",
          source: "self_join",
        })
        .select("id, status, joined_at")
        .single();

      if (createError || !enrollment) {
        console.error("[student/join-by-code] Enrollment creation error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create enrollment."),
        );
      }

      // Get active assignment publications for this class
      const { data: publicationClasses, error: pubError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
          id,
          assignment_publication_id,
          assignment_publications!inner(
            id,
            status
          )
        `,
        )
        .eq("class_id", classId)
        .is("deleted_at", null)
        .eq("status", "published");

      if (pubError) {
        console.error("[student/join-by-code] Publication query error:", pubError);
      }

      // Create assignment results for each active publication
      const assignmentResults = [];
      if (publicationClasses && publicationClasses.length > 0) {
        const resultsToInsert = publicationClasses
          .filter((pc: Record<string, unknown>) => {
            const pub = pc.assignment_publications as Record<string, unknown>;
            return pub?.status === "published";
          })
          .map((pc: Record<string, unknown>) => ({
            assignment_publication_class_id: pc.id,
            class_enrollment_id: enrollment.id,
            status: "not_started",
          }));

        if (resultsToInsert.length > 0) {
          const { data: createdResults, error: resultsError } = await supabase
            .from("assignment_results")
            .insert(resultsToInsert)
            .select("id, assignment_publication_class_id, status");

          if (resultsError) {
            console.error("[student/join-by-code] Assignment results creation error:", resultsError);
          } else {
            assignmentResults.push(...(createdResults ?? []));
          }
        }
      }

      return toResponse(
        successResponse({
          enrollmentId: enrollment.id,
          classId: classData.id,
          classTitle: classData.title,
          status: enrollment.status,
          joinedAt: enrollment.joined_at,
          assignmentResultsCreated: assignmentResults.length,
          joinOutcome: "joined" satisfies JoinOutcome,
        }),
        201,
      );
    } catch (err) {
      console.error("[student/join-by-code] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to join class."),
      );
    }
  },
  { requiredRole: "student" },
);
