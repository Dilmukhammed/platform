/**
 * GET /api/v1/teacher/classes — List teacher's classes.
 * POST /api/v1/teacher/classes — Create a new class.
 */

import { randomBytes } from "crypto";

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const createClassSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

// GET — List classes
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const organizationId = searchParams.get("organizationId");

      const supabase = createServerClient();

      // Build base query for class teachers with class details
      let dbQuery = supabase
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
            description,
            status,
            organization_id,
            created_at
          )
        `,
          { count: "exact" },
        )
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .is("classes.deleted_at", null)
        .eq("status", "active");

      // Filter by organization if provided
      if (organizationId) {
        dbQuery = dbQuery.eq("classes.organization_id", organizationId);
      }

      // Apply pagination
      const { data: classTeachers, error, count } = await dbQuery
        .order("created_at", { ascending: false, referencedTable: "classes" })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/classes] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch classes."),
        );
      }

      // Transform to response format
      const classes = (classTeachers ?? []).map((ct: Record<string, unknown>) => {
        const classData = ct.classes as unknown as Record<string, unknown> | null;
        return {
          classTeacherId: ct.id,
          classId: classData?.id,
          title: classData?.title,
          description: classData?.description,
          status: classData?.status,
          organizationId: classData?.organization_id,
          role: ct.role,
          isPrimary: ct.is_primary,
          createdAt: classData?.created_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(classes, paginationMeta));
    } catch (err) {
      console.error("[teacher/classes] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch classes."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create class
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = createClassSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid class data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { organizationId, title, description } = validation.data;
      const supabase = createServerClient();

      // Verify teacher is a member of the organization
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("id, role, status")
        .eq("organization_id", organizationId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .in("status", ["active", "pending"])
        .maybeSingle();

      if (membershipError) {
        console.error("[teacher/classes] Membership check error:", membershipError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
        );
      }

      if (!membership) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You are not a member of this organization."),
        );
      }

      // Check for duplicate class name in the same organization
      const { data: existingClass, error: dupError } = await supabase
        .from("classes")
        .select("id, title")
        .eq("organization_id", organizationId)
        .eq("title", title)
        .is("deleted_at", null)
        .maybeSingle();

      if (dupError) {
        console.error("[teacher/classes] Duplicate check error:", dupError);
      }

      if (existingClass) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "A class with this name already exists in this organization."),
        );
      }

      // Create class
      const { data: classData, error: createError } = await supabase
        .from("classes")
        .insert({
          organization_id: organizationId,
          title,
          description: description || null,
          status: "active",
        })
        .select("id, title, description, status, organization_id, created_at")
        .single();

      if (createError || !classData) {
        console.error("[teacher/classes] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create class."),
        );
      }

      // Create primary owner teacher record
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .insert({
          class_id: classData.id,
          platform_user_id: session.userId,
          role: "owner",
          is_primary: true,
          status: "active",
        })
        .select("id, role, is_primary, status")
        .single();

      if (teacherError) {
        console.error("[teacher/classes] Teacher assignment error:", teacherError);
        // Don't fail the request, but log the error
      }

      // Generate initial join code
      const joinCode = generateJoinCode();
      const { data: joinCodeData, error: joinCodeError } = await supabase
        .from("class_join_codes")
        .insert({
          class_id: classData.id,
          code: joinCode,
          status: "active",
        })
        .select("id, code, status")
        .single();

      if (joinCodeError) {
        console.error("[teacher/classes] Join code creation error:", joinCodeError);
      }

      return toResponse(
        successResponse({
          classId: classData.id,
          title: classData.title,
          description: classData.description,
          status: classData.status,
          organizationId: classData.organization_id,
          createdAt: classData.created_at,
          teacher: classTeacher
            ? {
                classTeacherId: classTeacher.id,
                role: classTeacher.role,
                isPrimary: classTeacher.is_primary,
                status: classTeacher.status,
              }
            : null,
          joinCode: joinCodeData
            ? {
                joinCodeId: joinCodeData.id,
                code: joinCodeData.code,
                status: joinCodeData.status,
              }
            : null,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/classes] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create class."),
      );
    }
  },
  { requiredRole: "teacher" },
);

/**
 * Generate a random 6-digit join code using crypto-secure random bytes.
 */
function generateJoinCode(): string {
  const bytes = randomBytes(3);
  const code = bytes.readUIntBE(0, 3) % 900000 + 100000;
  return code.toString();
}
