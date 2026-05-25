/**
 * GET /api/v1/admin/teachers/{teacherId} — Get teacher details.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request, context) => {
    try {
      const params = await context.params;
      const teacherId = params.teacherId as string;

      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      // Fetch teacher details
      const { data: teacher, error: teacherError } = await supabase
        .from("platform_users")
        .select(
          `
          id,
          auth_user_id,
          display_name,
          role,
          status,
          created_at,
          updated_at
        `,
        )
        .eq("id", teacherId)
        .eq("role", "teacher")
        .is("deleted_at", null)
        .single();

      if (teacherError || !teacher) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Teacher not found."),
        );
      }

      // Fetch organization memberships
      const { data: memberships, error: membershipError } = await supabase
        .from("organization_memberships")
        .select(
          `
          id,
          role,
          status,
          joined_at,
          organizations!inner(
            id,
            name,
            slug,
            status
          )
        `,
        )
        .eq("platform_user_id", teacherId)
        .is("deleted_at", null);

      if (membershipError) {
        console.error("[admin/teachers/detail] Membership error:", membershipError);
      }

      // Fetch class memberships
      const { data: classTeachers, error: classError } = await supabase
        .from("class_teachers")
        .select(
          `
          id,
          role,
          is_primary,
          status,
          classes!inner(
            id,
            title,
            status,
            organization_id
          )
        `,
        )
        .eq("platform_user_id", teacherId)
        .is("deleted_at", null);

      if (classError) {
        console.error("[admin/teachers/detail] Class error:", classError);
      }

      // Format organization memberships
      const formattedMemberships = (memberships ?? []).map((membership: Record<string, unknown>) => {
        const org = (Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations) as Record<string, unknown> | null | undefined;
        return {
          membershipId: membership.id,
          organizationId: org?.id,
          organizationName: org?.name,
          organizationSlug: org?.slug,
          organizationStatus: org?.status,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joined_at,
        };
      });

      // Format class memberships
      const formattedClasses = (classTeachers ?? []).map((ct: Record<string, unknown>) => {
        const cls = (Array.isArray(ct.classes) ? ct.classes[0] : ct.classes) as Record<string, unknown> | null | undefined;
        return {
          classTeacherId: ct.id,
          classId: cls?.id,
          classTitle: cls?.title,
          classStatus: cls?.status,
          organizationId: cls?.organization_id,
          role: ct.role,
          isPrimary: ct.is_primary,
          status: ct.status,
        };
      });

      return toResponse(
        successResponse({
          teacherId: teacher.id,
          userId: teacher.id,
          email: teacher.auth_user_id ? (authEmails.get(teacher.auth_user_id) ?? null) : null,
          displayName: teacher.display_name,
          role: teacher.role,
          status: teacher.status,
          organizations: formattedMemberships,
          classes: formattedClasses,
          createdAt: teacher.created_at,
          updatedAt: teacher.updated_at,
        }),
      );
    } catch (err) {
      console.error("[admin/teachers/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch teacher details."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
