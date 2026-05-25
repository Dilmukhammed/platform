/**
 * GET /api/v1/teacher/assignment-templates — List teacher's assignment templates.
 * POST /api/v1/teacher/assignment-templates — Create a new assignment template.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const createTemplateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  hasPractice: z.boolean().default(false),
  hasTest: z.boolean().default(false),
  linkedTestId: z.string().uuid().optional(),
  gradingSchemeOverrideId: z.string().uuid().optional(),
  materialIds: z.array(z.string().uuid()).optional(),
});

// GET — List assignment templates
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const statusFilter = searchParams.get("status"); // optional filter: draft | active | archived

      const supabase = createServerClient();

      // Build base query - only templates owned by this teacher
      let query = supabase
        .from("assignment_templates")
        .select("*, assignment_template_materials!left(*)", { count: "exact" })
        .eq("teacher_id", session.userId)
        .is("deleted_at", null);

      // Apply status filter if provided
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data: templates, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/assignment-templates] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment templates."),
        );
      }

      // Transform to response format
      const transformed = (templates ?? []).map((template: Record<string, unknown>) => {
        const materials = (template.assignment_template_materials as Array<Record<string, unknown>>) ?? [];

        return {
          templateId: template.id,
          title: template.title,
          description: template.description,
          hasPractice: template.has_practice,
          hasTest: template.has_test,
          linkedTestId: template.linked_test_id,
          gradingSchemeOverrideId: template.grading_scheme_override_id,
          status: template.status,
          materialCount: materials.length,
          materialIds: materials.map((m) => m.material_id),
          createdAt: template.created_at,
          updatedAt: template.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(transformed, paginationMeta));
    } catch (err) {
      console.error("[teacher/assignment-templates] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment templates."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create assignment template
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = createTemplateSchema.safeParse(body);

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

      const { title, description, hasPractice, hasTest, linkedTestId, gradingSchemeOverrideId, materialIds } = validation.data;
      const supabase = createServerClient();

      // Validate linked test exists if provided
      if (linkedTestId) {
        const { data: test, error: testError } = await supabase
          .from("tests")
          .select("id")
          .eq("id", linkedTestId)
          .is("deleted_at", null)
          .maybeSingle();

        if (testError) {
          console.error("[teacher/assignment-templates] Test validation error:", testError);
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
      if (gradingSchemeOverrideId) {
        const { data: scheme, error: schemeError } = await supabase
          .from("grading_schemes")
          .select("id")
          .eq("id", gradingSchemeOverrideId)
          .is("deleted_at", null)
          .maybeSingle();

        if (schemeError) {
          console.error("[teacher/assignment-templates] Grading scheme validation error:", schemeError);
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
      if (materialIds && materialIds.length > 0) {
        const { data: materials, error: materialsError } = await supabase
          .from("materials")
          .select("id")
          .in("id", materialIds)
          .is("deleted_at", null);

        if (materialsError) {
          console.error("[teacher/assignment-templates] Materials validation error:", materialsError);
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

      // Create assignment template
      const { data: template, error: createError } = await supabase
        .from("assignment_templates")
        .insert({
          teacher_id: session.userId,
          title,
          description,
          has_practice: hasPractice,
          has_test: hasTest,
          linked_test_id: linkedTestId,
          grading_scheme_override_id: gradingSchemeOverrideId,
          status: "draft",
        })
        .select("id, teacher_id, title, description, has_practice, has_test, linked_test_id, grading_scheme_override_id, status, created_at, updated_at")
        .single();

      if (createError || !template) {
        console.error("[teacher/assignment-templates] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create assignment template."),
        );
      }

      // Create material links if provided
      let createdMaterials: Array<Record<string, unknown>> = [];
      if (materialIds && materialIds.length > 0) {
        const materialInsertData = materialIds.map((materialId) => ({
          assignment_template_id: template.id,
          material_id: materialId,
        }));

        const { data: materials, error: materialsError } = await supabase
          .from("assignment_template_materials")
          .insert(materialInsertData)
          .select("id, assignment_template_id, material_id");

        if (materialsError) {
          console.error("[teacher/assignment-templates] Materials link error:", materialsError);
          // Don't fail the request, but log the error
        } else {
          createdMaterials = materials ?? [];
        }
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
          gradingSchemeOverrideId: template.grading_scheme_override_id,
          status: template.status,
          materialCount: createdMaterials.length,
          materialIds: createdMaterials.map((m) => m.material_id),
          createdAt: template.created_at,
          updatedAt: template.updated_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/assignment-templates] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create assignment template."),
      );
    }
  },
  { requiredRole: "teacher" },
);
