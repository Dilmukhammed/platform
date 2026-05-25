/**
 * POST /api/v1/teacher/assignment-templates/{templateId}/publications — Publish template to classes.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const publishTemplateSchema = z.object({
  defaultDeadline: z.string().datetime().optional(),
  classIds: z.array(z.string().uuid()).min(1).max(50),
  deadlineOverrides: z.record(z.string().uuid(), z.string().datetime()).optional(),
});

// POST — Publish template to classes
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const templateId = params.templateId as string;

      const body = await request.json();
      const validation = publishTemplateSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid publication data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { defaultDeadline, classIds, deadlineOverrides } = validation.data;
      const supabase = createServerClient();

      // Fetch template to check ownership
      const { data: template, error: templateError } = await supabase
        .from("assignment_templates")
        .select("id, teacher_id, title, status")
        .eq("id", templateId)
        .is("deleted_at", null)
        .single();

      if (templateError || !template) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment template not found."),
        );
      }

      // Check ownership - teacher must own this template
      if (template.teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to publish this assignment template."),
        );
      }

      // Verify teacher has access to all specified classes
      const { data: classTeachers, error: classError } = await supabase
        .from("class_teachers")
        .select("class_id, classes!inner(id, status)")
        .eq("platform_user_id", session.userId)
        .in("class_id", classIds)
        .eq("status", "active")
        .is("deleted_at", null);

      if (classError) {
        console.error("[teacher/assignment-templates/publications] Class validation error:", classError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to validate classes."),
        );
      }

      const accessibleClassIds = (classTeachers ?? []).map((ct) => ct.class_id);
      const inaccessibleClassIds = classIds.filter((id) => !accessibleClassIds.includes(id));

      if (inaccessibleClassIds.length > 0) {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "You do not have access to one or more selected classes.",
            undefined,
            { inaccessibleClassIds },
          ),
        );
      }

      // Create publication
      const { data: publication, error: pubError } = await supabase
        .from("assignment_publications")
        .insert({
          assignment_template_id: templateId,
          published_by_teacher_id: session.userId,
          default_deadline: defaultDeadline ?? null,
          status: "published",
          published_at: new Date().toISOString(),
        })
        .select("id, assignment_template_id, published_by_teacher_id, default_deadline, status, published_at, created_at, updated_at")
        .single();

      if (pubError || !publication) {
        console.error("[teacher/assignment-templates/publications] Publication creation error:", pubError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create publication."),
        );
      }

      // Create publication classes
      const publicationClassData = classIds.map((classId) => ({
        assignment_publication_id: publication.id,
        class_id: classId,
        deadline_override: deadlineOverrides?.[classId] ?? null,
        status: "published",
      }));

      const { data: pubClasses, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .insert(publicationClassData)
        .select("id, assignment_publication_id, class_id, deadline_override, status");

      if (pubClassError) {
        console.error("[teacher/assignment-templates/publications] Publication class creation error:", pubClassError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create publication classes."),
        );
      }

      // Create assignment_results for all enrolled students in each class
      const createdPubClasses = pubClasses ?? [];
      const resultsData: Array<{
        assignment_publication_class_id: string;
        class_enrollment_id: string;
        status: string;
      }> = [];

      for (const pubClass of createdPubClasses) {
        // Get all active enrollments for this class
        const { data: enrollments, error: enrollError } = await supabase
          .from("class_enrollments")
          .select("id")
          .eq("class_id", pubClass.class_id)
          .eq("status", "active")
          .is("deleted_at", null);

        if (enrollError) {
          console.error("[teacher/assignment-templates/publications] Enrollment fetch error:", enrollError);
          continue;
        }

        for (const enrollment of (enrollments ?? [])) {
          resultsData.push({
            assignment_publication_class_id: pubClass.id,
            class_enrollment_id: enrollment.id,
            status: "not_started",
          });
        }
      }

      // Bulk insert assignment results if any
      if (resultsData.length > 0) {
        const { error: resultsError } = await supabase
          .from("assignment_results")
          .insert(resultsData);

        if (resultsError) {
          console.error("[teacher/assignment-templates/publications] Results creation error:", resultsError);
          // Don't fail the request, but log the error
        }
      }

      // Fetch template materials for response
      const { data: templateMaterials } = await supabase
        .from("assignment_template_materials")
        .select("material_id")
        .eq("assignment_template_id", templateId)
        .is("deleted_at", null);

      return toResponse(
        successResponse({
          publicationId: publication.id,
          templateId: publication.assignment_template_id,
          publishedByTeacherId: publication.published_by_teacher_id,
          defaultDeadline: publication.default_deadline,
          status: publication.status,
          publishedAt: publication.published_at,
          createdAt: publication.created_at,
          updatedAt: publication.updated_at,
          classTargets: createdPubClasses.map((pc) => ({
            publicationClassId: pc.id,
            classId: pc.class_id,
            deadlineOverride: pc.deadline_override,
            effectiveDeadline: pc.deadline_override ?? publication.default_deadline,
            status: pc.status,
          })),
          studentResultsCreated: resultsData.length,
          linkedMaterialIds: (templateMaterials ?? []).map((m) => m.material_id),
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/assignment-templates/publications] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to publish assignment template."),
      );
    }
  },
  { requiredRole: "teacher" },
);
