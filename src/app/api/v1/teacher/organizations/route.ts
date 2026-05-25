/**
 * GET /api/v1/teacher/organizations — List teacher's organizations.
 * POST /api/v1/teacher/organizations — Create a new organization.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens only"),
});

// GET — List organizations
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);

      const supabase = createServerClient();

      // Query organizations through memberships
      const { data: memberships, error, count } = await supabase
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
            status,
            created_at
          )
        `,
          { count: "exact" },
        )
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .is("organizations.deleted_at", null)
        .order("joined_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/organizations] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organizations."),
        );
      }

      // Transform to response format
      const organizations = (memberships ?? []).map((membership: Record<string, unknown>) => {
        const org = membership.organizations as unknown as Record<string, unknown> | null;
        return {
          membershipId: membership.id,
          organizationId: org?.id,
          name: org?.name,
          slug: org?.slug,
          status: org?.status,
          role: membership.role,
          membershipStatus: membership.status,
          joinedAt: membership.joined_at,
          createdAt: org?.created_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(organizations, paginationMeta));
    } catch (err) {
      console.error("[teacher/organizations] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organizations."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create organization
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = createOrgSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid organization data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { name, slug } = validation.data;
      const supabase = createServerClient();

      // Check if slug is already taken
      const { data: existingOrg, error: checkError } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkError) {
        console.error("[teacher/organizations] Slug check error:", checkError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check organization slug."),
        );
      }

      if (existingOrg) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Organization slug is already taken."),
        );
      }

      // Create organization
      const { data: organization, error: createError } = await supabase
        .from("organizations")
        .insert({
          name,
          slug,
          status: "pending",
          created_by_platform_user_id: session.userId,
        })
        .select("id, name, slug, status, created_at")
        .single();

      if (createError || !organization) {
        console.error("[teacher/organizations] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create organization."),
        );
      }

      // Create owner membership
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .insert({
          organization_id: organization.id,
          platform_user_id: session.userId,
          role: "owner",
          status: "active",
        })
        .select("id, role, status, joined_at")
        .single();

      if (membershipError) {
        console.error("[teacher/organizations] Membership error:", membershipError);
        // Don't fail the request, but log the error
      }

      return toResponse(
        successResponse({
          organizationId: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          createdAt: organization.created_at,
          membership: membership
            ? {
                membershipId: membership.id,
                role: membership.role,
                status: membership.status,
                joinedAt: membership.joined_at,
              }
            : null,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/organizations] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create organization."),
      );
    }
  },
  { requiredRole: "teacher" },
);
