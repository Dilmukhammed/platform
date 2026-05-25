/**
 * GET /api/v1/student/assignments/{assignmentResultId} — Get assignment detail.
 *
 * Returns detailed information about a specific assignment result.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid assignment result ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { assignmentResultId } = validation.data;
      const supabase = createServerClient();

      // Get assignment result with all related data
      const { data: result, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          practice_started_at,
          practice_submitted_at,
          test_started_at,
          test_submitted_at,
          released_at,
          created_at,
          updated_at,
          assignment_publication_classes!inner(
            id,
            deadline_override,
            class_id,
            classes!inner(
              id,
              title,
              description
            ),
            assignment_publications!inner(
              id,
              default_deadline,
              published_at,
              assignment_templates!inner(
                id,
                title,
                description,
                has_practice,
                has_test,
                linked_test_id
              )
            )
          ),
          class_enrollments!inner(
            id,
            student_profile_id
          )
        `,
        )
        .eq("id", assignmentResultId)
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[student/assignments/detail] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment details."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment not found."),
        );
      }

      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

      const deadline = pubClass?.deadline_override ?? publication?.default_deadline;

      // Get submission files
      const { data: submissionFiles, error: filesError } = await supabase
        .from("submission_files")
        .select(
          `
          id,
          file_role,
          file_kind,
          original_filename,
          mime_type,
          file_size_bytes,
          sort_order,
          is_current,
          created_at
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("is_current", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (filesError) {
        console.error("[student/assignments/detail] Files query error:", filesError);
      }

      // Get test attempts
      const { data: testAttempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          test_id,
          attempt_number,
          is_current,
          score_raw,
          started_at,
          submitted_at,
          responses_json,
          created_at
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .order("attempt_number", { ascending: false });

      if (attemptsError) {
        console.error("[student/assignments/detail] Test attempts query error:", attemptsError);
      }

      // Get grade record if released
      let gradeRecord = null;
      if (result.status === "released" && result.released_at) {
        const { data: grade, error: gradeError } = await supabase
          .from("grade_records")
          .select(
            `
            id,
            mapped_grade,
            practice_score_raw,
            test_score_raw,
            final_score_raw,
            is_overridden
          `,
          )
          .eq("assignment_result_id", assignmentResultId)
          .eq("status", "current")
          .is("deleted_at", null)
          .maybeSingle();

        if (!gradeError && grade) {
          gradeRecord = {
            mappedGrade: grade.mapped_grade,
            practiceScore: grade.practice_score_raw,
            testScore: grade.test_score_raw,
            finalScore: grade.final_score_raw,
            isOverridden: grade.is_overridden,
          };
        }
      }

      // Get linked materials for the assignment template
      const templateId = template?.id as string | undefined;
      let linkedMaterials: Array<{
        id: string;
        title: string;
        description: string | null;
        sourceFilePath: string;
      }> = [];

      if (templateId) {
        const { data: materials, error: materialsError } = await supabase
          .from("assignment_template_materials")
          .select(
            `
            material_id,
            materials!inner(
              id,
              title,
              description,
              source_file_path
            )
          `,
          )
          .eq("assignment_template_id", templateId)
          .is("deleted_at", null)
          .eq("materials.status", "active")
          .is("materials.deleted_at", null);

        if (materialsError) {
          console.error("[student/assignments/detail] Materials query error:", materialsError);
        } else if (materials) {
          linkedMaterials = materials.map((m: Record<string, unknown>) => {
            const material = m.materials as Record<string, unknown>;
            return {
              id: material.id as string,
              title: material.title as string,
              description: material.description as string | null,
              sourceFilePath: material.source_file_path as string,
            };
          });
        }
      }

      return toResponse(
        successResponse({
          assignmentResultId: result.id,
          status: result.status,
          classId: classData?.id,
          classTitle: classData?.title,
          classDescription: classData?.description,
          assignmentTemplateId: template?.id,
          assignmentTitle: template?.title,
          assignmentDescription: template?.description,
          hasPractice: template?.has_practice,
          hasTest: template?.has_test,
          linkedTestId: template?.linked_test_id,
          deadline: deadline,
          publishedAt: publication?.published_at,
          practiceStartedAt: result.practice_started_at,
          practiceSubmittedAt: result.practice_submitted_at,
          testStartedAt: result.test_started_at,
          testSubmittedAt: result.test_submitted_at,
          releasedAt: result.released_at,
          submissionFiles: (submissionFiles ?? []).map((f: Record<string, unknown>) => ({
            id: f.id,
            fileRole: f.file_role,
            fileKind: f.file_kind,
            originalFilename: f.original_filename,
            mimeType: f.mime_type,
            fileSizeBytes: f.file_size_bytes,
            sortOrder: f.sort_order,
            createdAt: f.created_at,
          })),
          testAttempts: (testAttempts ?? []).map((a: Record<string, unknown>) => ({
            id: a.id,
            testId: a.test_id,
            attemptNumber: a.attempt_number,
            isCurrent: a.is_current,
            scoreRaw: a.score_raw,
            startedAt: a.started_at,
            submittedAt: a.submitted_at,
            responsesJson: a.responses_json,
          })),
          gradeRecord,
          linkedMaterials,
        }),
      );
    } catch (err) {
      console.error("[student/assignments/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment details."),
      );
    }
  },
  { requiredRole: "student" },
);
