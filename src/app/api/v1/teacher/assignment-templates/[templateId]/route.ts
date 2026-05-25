/**
 * GET /api/v1/teacher/assignment-templates/{templateId} — Get template details.
 * PATCH /api/v1/teacher/assignment-templates/{templateId} — Update template.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const updateTemplateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  hasPractice: z.boolean().optional(),
  hasTest: z.boolean().optional(),
  linkedTestId: z.string().uuid().optional().nullable(),
  gradingSchemeOverrideId: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  materialIds: z.array(z.string().uuid()).optional(),
});

// GET — Get template details
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const templateId = params.templateId as string;

      const supabase = createServerClient();

      // Fetch template with materials
      const { data: template, error } = await supabase
        .from("assignment_templates")
        .select("*, assignment_template_materials!left(*)")
        .eq("id", templateId)
        .is("deleted_at", null)
        .single();

      if (error || !template) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment template not found."),
        );
      }

      // Check ownership - teacher must own this template
      if (template.teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this assignment template."),
        );
      }

      const materials = (template.assignment_template_materials as Array<Record<string, unknown>>) ?? [];

      // Fetch material titles
      const materialIds = materials.map((m) => m.material_id as string);
      let materialDetails: Array<{ id: string; title: string }> = [];
      if (materialIds.length > 0) {
        const { data: materialData } = await supabase
          .from("materials")
          .select("id, title")
          .in("id", materialIds)
          .is("deleted_at", null);
        materialDetails = (materialData ?? []) as Array<{ id: string; title: string }>;
      }

      // Fetch linked test title
      let linkedTestDetail: { id: string; title: string } | null = null;
      if (template.linked_test_id) {
        const { data: testData } = await supabase
          .from("tests")
          .select("id, title")
          .eq("id", template.linked_test_id)
          .is("deleted_at", null)
          .maybeSingle();
        linkedTestDetail = testData as { id: string; title: string } | null;
      }

      return toResponse(
        successResponse({
          templateId: template.id,
          teacherId: template.teacher_id,
          title: template.title,
          description: template.description,
          hasPractice: template.has_practice,
          hasTest: template.has_test,
          linkedTestId: template.linked_test_id,
          linkedTest: linkedTestDetail ? { testId: linkedTestDetail.id, title: linkedTestDetail.title } : null,
          gradingSchemeOverrideId: template.grading_scheme_override_id,
          status: template.status,
          materialCount: materials.length,
          materialIds: materials.map((m) => m.material_id),
          materials: materialDetails.map((m) => ({ materialId: m.id, title: m.title })),
          createdAt: template.created_at,
          updatedAt: template.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/assignment-templates/[templateId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment template."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// PATCH — Update template
export const PATCH = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const templateId = params.templateId as string;

      const body = await request.json();
      const validation = updateTemplateSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid assignment template data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const supabase = createServerClient();

      // Fetch template to check ownership
      const { data: template, error: fetchError } = await supabase
        .from("assignment_templates")
        .select("id, teacher_id, status")
        .eq("id", templateId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !template) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment template not found."),
        );
      }

      // Check ownership - teacher must own this template
      if (template.teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this assignment template."),
        );
      }

      const { linkedTestId, gradingSchemeOverrideId, materialIds, ...otherUpdates } = validation.data;

      // Validate linked test exists if provided
      if (linkedTestId !== undefined && linkedTestId !== null) {
        const { data: test, error: testError } = await supabase
          .from("tests")
          .select("id")
          .eq("id", linkedTestId)
          .is("deleted_at", null)
          .maybeSingle();

        if (testError) {
          console.error("[teacher/assignment-templates/[templateId]] Test validation error:", testError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to validate linked test."),
          );
        }

        if (!test) {
          return toResponse(
            errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Linked test not found."),
          );
        }
      }

      // Validate grading scheme exists if provided
      if (gradingSchemeOverrideId !== undefined && gradingSchemeOverrideId !== null) {
        const { data: scheme, error: schemeError } = await supabase
          .from("grading_schemes")
          .select("id")
          .eq("id", gradingSchemeOverrideId)
          .is("deleted_at", null)
          .maybeSingle();

        if (schemeError) {
          console.error("[teacher/assignment-templates/[templateId]] Grading scheme validation error:", schemeError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to validate grading scheme."),
          );
        }

        if (!scheme) {
          return toResponse(
            errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Grading scheme not found."),
          );
        }
      }

      // Validate materials exist if provided
      if (materialIds !== undefined && materialIds.length > 0) {
        const { data: materials, error: materialsError } = await supabase
          .from("materials")
          .select("id")
          .in("id", materialIds)
          .is("deleted_at", null);

        if (materialsError) {
          console.error("[teacher/assignment-templates/[templateId]] Materials validation error:", materialsError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to validate materials."),
          );
        }

        const foundIds = (materials ?? []).map((m) => m.id);
        const missingIds = materialIds.filter((id) => !foundIds.includes(id));

        if (missingIds.length > 0) {
          return toResponse(
            errorResponse(
              ErrorCodes.RESOURCE_NOT_FOUND,
              "One or more materials not found.",
              undefined,
              { missingIds },
            ),
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (otherUpdates.title !== undefined) updateData.title = otherUpdates.title;
      if (otherUpdates.description !== undefined) updateData.description = otherUpdates.description;
      if (otherUpdates.hasPractice !== undefined) updateData.has_practice = otherUpdates.hasPractice;
      if (otherUpdates.hasTest !== undefined) updateData.has_test = otherUpdates.hasTest;
      if (linkedTestId !== undefined) updateData.linked_test_id = linkedTestId;
      if (gradingSchemeOverrideId !== undefined) updateData.grading_scheme_override_id = gradingSchemeOverrideId;
      if (otherUpdates.status !== undefined) updateData.status = otherUpdates.status;
      updateData.updated_at = new Date().toISOString();

      // Update template
      const { data: updatedTemplate, error: updateError } = await supabase
        .from("assignment_templates")
        .update(updateData)
        .eq("id", templateId)
        .is("deleted_at", null)
        .select("id, teacher_id, title, description, has_practice, has_test, linked_test_id, grading_scheme_override_id, status, created_at, updated_at")
        .single();

      if (updateError || !updatedTemplate) {
        console.error("[teacher/assignment-templates/[templateId]] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update assignment template."),
        );
      }

      // Update material links if provided
      let updatedMaterials: Array<Record<string, unknown>> = [];
      if (materialIds !== undefined) {
        // Soft delete existing material links
        await supabase
          .from("assignment_template_materials")
          .update({ deleted_at: new Date().toISOString() })
          .eq("assignment_template_id", templateId)
          .is("deleted_at", null);

        // Create new material links
        if (materialIds.length > 0) {
          const materialInsertData = materialIds.map((materialId) => ({
            assignment_template_id: templateId,
            material_id: materialId,
          }));

          const { data: materials, error: materialsError } = await supabase
            .from("assignment_template_materials")
            .insert(materialInsertData)
            .select("id, assignment_template_id, material_id");

          if (materialsError) {
            console.error("[teacher/assignment-templates/[templateId]] Materials link error:", materialsError);
          } else {
            updatedMaterials = materials ?? [];
          }
        }
      } else {
        // Fetch existing materials for response
        const { data: existingMaterials } = await supabase
          .from("assignment_template_materials")
          .select("id, assignment_template_id, material_id")
          .eq("assignment_template_id", templateId)
          .is("deleted_at", null);
        updatedMaterials = existingMaterials ?? [];
      }

      return toResponse(
        successResponse({
          templateId: updatedTemplate.id,
          teacherId: updatedTemplate.teacher_id,
          title: updatedTemplate.title,
          description: updatedTemplate.description,
          hasPractice: updatedTemplate.has_practice,
          hasTest: updatedTemplate.has_test,
          linkedTestId: updatedTemplate.linked_test_id,
          gradingSchemeOverrideId: updatedTemplate.grading_scheme_override_id,
          status: updatedTemplate.status,
          materialCount: updatedMaterials.length,
          materialIds: updatedMaterials.map((m) => m.material_id),
          createdAt: updatedTemplate.created_at,
          updatedAt: updatedTemplate.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/assignment-templates/[templateId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update assignment template."),
      );
    }
  },
  { requiredRole: "teacher" },
);
