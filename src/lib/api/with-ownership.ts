/**
 * Ownership/membership middleware for API routes.
 *
 * Checks that the authenticated user belongs to the specified organization
 * or owns the specified class. These helpers are designed to be called
 * inside route handlers after withAuth has verified the session.
 *
 * Uses the Supabase service role client to query membership tables.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { errorResponse, toResponse } from "./envelope";
import { ErrorCodes } from "./errors";
import { t } from "@/lib/translations";

type OwnershipCheckResult =
  | { ok: true }
  | { ok: false; response: Response };

/**
 * Verify that a user is a member of the given organization.
 */
export async function requireOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<OwnershipCheckResult> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: toResponse(
        errorResponse(
          ErrorCodes.INTERNAL_ERROR,
          t.api.ownership.failedToVerifyOrgMembership,
        ),
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: toResponse(
        errorResponse(
          ErrorCodes.FORBIDDEN,
          t.api.ownership.notMemberOfOrganization,
        ),
      ),
    };
  }

  return { ok: true };
}

/**
 * Verify that a user owns (is the teacher of) the given class.
 */
export async function requireClassOwnership(
  supabase: SupabaseClient,
  userId: string,
  classId: string,
): Promise<OwnershipCheckResult> {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", userId)
    .eq("id", classId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: toResponse(
        errorResponse(
          ErrorCodes.INTERNAL_ERROR,
          t.api.ownership.failedToVerifyClassOwnership,
        ),
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: toResponse(
        errorResponse(
          ErrorCodes.FORBIDDEN,
          t.api.ownership.doNotOwnClass,
        ),
      ),
    };
  }

  return { ok: true };
}
