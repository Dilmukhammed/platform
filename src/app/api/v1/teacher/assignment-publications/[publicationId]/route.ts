/**
 * GET /api/v1/teacher/assignment-publications/{publicationId} — Get publication details with class results summary.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// GET — Get publication details with class results summary
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const publicationId = params.publicationId as string;

      const supabase = createServerClient();

      // Fetch publication with template info
      const { data: publication, error: pubError } = await supabase
        .from("assignment_publications")
        .select(
          `*,
          assignment_templates!inner(id, title, description, has_practice, has_test, linked_test_id, grading_scheme_override_id)`
        )
        .eq("id", publicationId)
        .is("deleted_at", null)
        .single();

      if (pubError || !publication) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment publication not found."),
        );
      }

      // Check ownership - teacher must have published this
      if (publication.published_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this assignment publication."),
        );
      }

      const template = publication.assignment_templates as Record<string, unknown>;

      // Fetch publication classes with class details
      const { data: pubClasses, error: classError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `*,
          classes!inner(id, title, status)`
        )
        .eq("assignment_publication_id", publicationId)
        .is("deleted_at", null);

      if (classError) {
        console.error("[teacher/assignment-publications/[publicationId]] Class fetch error:", classError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch publication classes."),
        );
      }

      // Fetch template materials
      const { data: templateMaterials } = await supabase
        .from("assignment_template_materials")
        .select("material_id")
        .eq("assignment_template_id", template.id)
        .is("deleted_at", null);

      // Build class results summary for each class
      const classTargets = [];
      for (const pubClass of (pubClasses ?? [])) {
        const classInfo = pubClass.classes as Record<string, unknown>;

        // Count results by status for this publication class
        const { data: results, error: resultsError } = await supabase
          .from("assignment_results")
          .select("status")
          .eq("assignment_publication_class_id", pubClass.id)
          .is("deleted_at", null);

        if (resultsError) {
          console.error("[teacher/assignment-publications/[publicationId]] Results fetch error:", resultsError);
        }

        const resultsList = results ?? [];
        const statusCounts = {
          notStarted: resultsList.filter((r) => r.status === "not_started").length,
          inProgress: resultsList.filter((r) => r.status === "in_progress").length,
          submitted: resultsList.filter((r) => r.status === "submitted").length,
          graded: resultsList.filter((r) => r.status === "graded").length,
          released: resultsList.filter((r) => r.status === "released").length,
        };

        classTargets.push({
          publicationClassId: pubClass.id,
          classId: pubClass.class_id,
          classTitle: classInfo?.title,
          classStatus: classInfo?.status,
          deadlineOverride: pubClass.deadline_override,
          effectiveDeadline: pubClass.deadline_override ?? publication.default_deadline,
          status: pubClass.status,
          resultsSummary: {
            totalStudents: resultsList.length,
            ...statusCounts,
          },
        });
      }

      return toResponse(
        successResponse({
          publicationId: publication.id,
          templateId: publication.assignment_template_id,
          template: {
            templateId: template.id,
            title: template.title,
            description: template.description,
            hasPractice: template.has_practice,
            hasTest: template.has_test,
            linkedTestId: template.linked_test_id,
            gradingSchemeOverrideId: template.grading_scheme_override_id,
          },
          publishedByTeacherId: publication.published_by_teacher_id,
          defaultDeadline: publication.default_deadline,
          status: publication.status,
          publishedAt: publication.published_at,
          createdAt: publication.created_at,
          updatedAt: publication.updated_at,
          linkedMaterialIds: (templateMaterials ?? []).map((m) => m.material_id),
          classTargets,
        }),
      );
    } catch (err) {
      console.error("[teacher/assignment-publications/[publicationId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment publication."),
      );
    }
  },
  { requiredRole: "teacher" },
);
