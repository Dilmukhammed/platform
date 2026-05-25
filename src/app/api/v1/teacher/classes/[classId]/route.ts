/**
 * GET /api/v1/teacher/classes/{classId} — Get class details.
 * PATCH /api/v1/teacher/classes/{classId} — Update class details.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const updateClassSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

// GET — Get class details
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const supabase = createServerClient();

      // Verify teacher owns or teaches this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id, role, is_primary, status")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/class] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Get class details
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id, title, description, status, organization_id, created_at, updated_at")
        .eq("id", classId)
        .is("deleted_at", null)
        .maybeSingle();

      if (classError || !classData) {
        console.error("[teacher/class] Class query error:", classError);
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Class not found."),
        );
      }

      // Get organization details
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("id", classData.organization_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (orgError) {
        console.error("[teacher/class] Organization query error:", orgError);
      }

      // Get active join code
      const { data: joinCode, error: joinCodeError } = await supabase
        .from("class_join_codes")
        .select("id, code, status, valid_from, valid_until")
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (joinCodeError) {
        console.error("[teacher/class] Join code query error:", joinCodeError);
      }

      // Get student count
      const { count: studentCount, error: countError } = await supabase
        .from("class_enrollments")
        .select("id", { count: "exact" })
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (countError) {
        console.error("[teacher/class] Student count error:", countError);
      }

      return toResponse(
        successResponse({
          classId: classData.id,
          title: classData.title,
          description: classData.description,
          status: classData.status,
          organization: organization
            ? {
                organizationId: organization.id,
                name: organization.name,
                slug: organization.slug,
              }
            : null,
          teacherRole: classTeacher.role,
          isPrimary: classTeacher.is_primary,
          studentCount: studentCount ?? 0,
          joinCode: joinCode
            ? {
                joinCodeId: joinCode.id,
                code: joinCode.code,
                status: joinCode.status,
                validFrom: joinCode.valid_from,
                validUntil: joinCode.valid_until,
              }
            : null,
          createdAt: classData.created_at,
          updatedAt: classData.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/class] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch class details."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// PATCH — Update class
export const PATCH = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const body = await request.json();
      const validation = updateClassSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid update data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const supabase = createServerClient();

      // Verify teacher owns or teaches this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id, role, is_primary, status")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/class] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Check if teacher has permission to update (only primary owners and admins)
      if (!classTeacher.is_primary && classTeacher.role !== "owner") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Only primary owners can update class details."),
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (validation.data.title !== undefined) updateData.title = validation.data.title;
      if (validation.data.description !== undefined) updateData.description = validation.data.description;
      if (validation.data.status !== undefined) updateData.status = validation.data.status;

      if (Object.keys(updateData).length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "No fields to update."),
        );
      }

      // Update class
      const { data: updatedClass, error: updateError } = await supabase
        .from("classes")
        .update(updateData)
        .eq("id", classId)
        .is("deleted_at", null)
        .select("id, title, description, status, organization_id, created_at, updated_at")
        .single();

      if (updateError || !updatedClass) {
        console.error("[teacher/class] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update class."),
        );
      }

      return toResponse(
        successResponse({
          classId: updatedClass.id,
          title: updatedClass.title,
          description: updatedClass.description,
          status: updatedClass.status,
          organizationId: updatedClass.organization_id,
          createdAt: updatedClass.created_at,
          updatedAt: updatedClass.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/class] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update class."),
      );
    }
  },
  { requiredRole: "teacher" },
);
