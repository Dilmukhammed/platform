/**
 * GET /api/v1/teacher/classes/{classId}/materials — List materials linked to a class.
 * POST /api/v1/teacher/classes/{classId}/materials — Add material to class.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { getMaterialSchoolVisibilityStateForOrganization } from "@/modules/materials/school-visibility";

const addMaterialSchema = z.object({
  materialId: z.string().uuid(),
});

// GET — List materials for a class
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const supabase = createServerClient();

      // Verify teacher is in class_teachers for this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id, role, is_primary, status")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/class/materials] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Query class_materials joined with materials
      const { data: classMaterials, error: materialsError } = await supabase
        .from("class_materials")
        .select(
          `
          id,
          material_id,
          added_at,
          materials (
            id,
            title,
            description,
            status,
            scope_type,
            deleted_at,
            owner_teacher_id,
            owner_organization_id
          )
        `
        )
        .eq("class_id", classId)
        .is("deleted_at", null)
        .order("added_at", { ascending: false });

      if (materialsError) {
        console.error("[teacher/class/materials] Materials query error:", materialsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch class materials."),
        );
      }

      // Get owner names for materials
      const teacherIds = new Set<string>();
      const orgIds = new Set<string>();

      (classMaterials ?? []).forEach((cm: Record<string, unknown>) => {
        const material = cm.materials as Record<string, unknown> | null;
        if (material) {
          if (material.owner_teacher_id) teacherIds.add(material.owner_teacher_id as string);
          if (material.owner_organization_id) orgIds.add(material.owner_organization_id as string);
        }
      });

      // Fetch teacher names
      let teacherNames: Record<string, string> = {};
      if (teacherIds.size > 0) {
        const { data: teachers } = await supabase
          .from("platform_users")
          .select("id, display_name")
          .in("id", Array.from(teacherIds));
        
        teacherNames = Object.fromEntries(
          (teachers ?? []).map((t) => [t.id, t.display_name])
        );
      }

      // Fetch organization names
      let orgNames: Record<string, string> = {};
      if (orgIds.size > 0) {
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", Array.from(orgIds));
        
        orgNames = Object.fromEntries(
          (orgs ?? []).map((o) => [o.id, o.name])
        );
      }

      // Transform to response format
      const transformed = (classMaterials ?? []).map((cm: Record<string, unknown>) => {
        const material = cm.materials as Record<string, unknown> | null;
        const isAvailable = material?.deleted_at === null;

        let ownerName: string | null = null;
        if (material) {
          if (material.owner_teacher_id) {
            ownerName = teacherNames[material.owner_teacher_id as string] ?? null;
          } else if (material.owner_organization_id) {
            ownerName = orgNames[material.owner_organization_id as string] ?? null;
          }
        }

        return {
          classMaterialId: cm.id as string,
          materialId: material?.id as string,
          title: material?.title as string,
          description: material?.description as string | null,
          status: material?.status as string,
          scopeType: material?.scope_type as string,
          ownerName,
          addedAt: cm.added_at as string,
          isAvailable,
        };
      });

      return toResponse(
        successResponse({
          data: transformed,
        }),
      );
    } catch (err) {
      console.error("[teacher/class/materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch class materials."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Add material to class
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      // Validate classId is UUID
      const classIdValidation = z.string().uuid().safeParse(classId);
      if (!classIdValidation.success) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid class ID format."),
        );
      }

      // Validate body
      const body = await request.json();
      const validation = addMaterialSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request body.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { materialId } = validation.data;
      const supabase = createServerClient();

      // Verify teacher is in class_teachers
      const { data: teacherMembership, error: membershipError } = await supabase
        .from("class_teachers")
        .select("id, status")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (membershipError) {
        console.error("[class-materials] Membership check error:", membershipError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class membership."),
        );
      }

      if (!teacherMembership || teacherMembership.status !== "active") {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "You must be an active teacher in this class to add materials.",
          ),
        );
      }

      // Fetch material with approval info
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select(
          `id, title, scope_type, owner_teacher_id, owner_organization_id, status`
        )
        .eq("id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (materialError) {
        console.error("[class-materials] Material fetch error:", materialError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material."),
        );
      }

      if (!material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      // Validate material eligibility using canonical visibility predicate
      const isOwnPersonalMaterial =
        material.scope_type === "personal" &&
        material.owner_teacher_id === session.userId;

      let isSchoolVisibleForAnyOrg = false;

      if (!isOwnPersonalMaterial) {
        const { data: memberships } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .eq("status", "active");

        const orgIds = (memberships ?? []).map((m) => m.organization_id);

        if (orgIds.length > 0) {
          const visibilityStates = await Promise.all(
            orgIds.map((orgId) =>
              getMaterialSchoolVisibilityStateForOrganization(supabase, {
                materialId,
                organizationId: orgId,
              })
            )
          );
          isSchoolVisibleForAnyOrg = visibilityStates.some((s) => s.isSchoolVisible);
        }
      }

      if (!isOwnPersonalMaterial && !isSchoolVisibleForAnyOrg) {
        if (material.scope_type === "personal") {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "You can only add your own personal materials or school-approved materials to classes.",
            ),
          );
        }

        if (material.scope_type === "organization") {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "Organization materials must be approved before adding to classes.",
            ),
          );
        }

        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "This material cannot be added to classes."),
        );
      }

      // Check if already linked (active)
      const { data: existingLink, error: linkCheckError } = await supabase
        .from("class_materials")
        .select("id")
        .eq("class_id", classId)
        .eq("material_id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (linkCheckError) {
        console.error("[class-materials] Link check error:", linkCheckError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check existing link."),
        );
      }

      if (existingLink) {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            "This material is already added to the class.",
          ),
        );
      }

      // Insert into class_materials
      const { data: classMaterial, error: insertError } = await supabase
        .from("class_materials")
        .insert({
          class_id: classId,
          material_id: materialId,
          added_by: session.userId,
        })
        .select("id, class_id, material_id, added_by, added_at")
        .single();

      if (insertError || !classMaterial) {
        console.error("[class-materials] Insert error:", insertError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to add material to class."),
        );
      }

      // Get class name for notification
      const { data: classData } = await supabase
        .from("classes")
        .select("title")
        .eq("id", classId)
        .single();

      // Get all enrolled students in the class
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("class_enrollments")
        .select("student_profile_id")
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (enrollmentsError) {
        console.error("[class-materials] Enrollments query error:", enrollmentsError);
        // Don't fail the request, just log the error
      }

      // Create notifications for all enrolled students
      if (enrollments && enrollments.length > 0) {
        const notifications = enrollments.map((enrollment) => ({
          recipient_type: "student_profile" as const,
          recipient_student_profile_id: enrollment.student_profile_id,
          type: "class_material_added",
          payload_json: {
            classId,
            materialId,
            className: classData?.title ?? "Unknown Class",
            materialTitle: material.title,
          },
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) {
          console.error("[class-materials] Notification insert error:", notificationError);
          // Don't fail the request, just log the error
        }
      }

      return toResponse(
        successResponse({
          classMaterialId: classMaterial.id,
          classId: classMaterial.class_id,
          materialId: classMaterial.material_id,
          addedBy: classMaterial.added_by,
          addedAt: classMaterial.added_at,
          material: {
            materialId: material.id,
            title: material.title,
            scopeType: material.scope_type,
          },
        }),
        201,
      );
    } catch (err) {
      console.error("[class-materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to add material to class."),
      );
    }
  },
  { requiredRole: "teacher" },
);
