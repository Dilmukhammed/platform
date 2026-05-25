import "server-only";

/**
 * Password reset token storage and management.
 *
 * Uses Supabase password_reset_tokens table for serverless-safe operation.
 *
 * Security features:
 * - Tokens expire after 1 hour
 * - Tokens are single-use (invalidated after use)
 * - Same response regardless of whether email exists (timing attack protection)
 * - Uses RLS-denied table (service role only) to prevent client access
 */

import { randomBytes, createHash } from "node:crypto";
import { createServerClient } from "@/lib/supabase/server-client";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hash a token before storage to prevent plaintext token leaks from DB.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically secure reset token (64 hex chars).
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Store a reset token for an email address.
 * Invalidates any existing active tokens for the same email.
 * Returns the generated token (plaintext, for email delivery).
 */
export async function storeResetToken(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createServerClient();
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

  // Invalidate any existing active tokens for this email
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("email", normalizedEmail)
    .is("used_at", null);

  // Store the new token
  const { error } = await supabase
    .from("password_reset_tokens")
    .insert({
      email: normalizedEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (error) {
    console.error("[reset-tokens] Failed to store token:", error);
    throw new Error("Failed to store reset token");
  }

  return token;
}

/**
 * Validate a reset token.
 * Returns the associated email if valid, null otherwise.
 * Token is marked as used after validation (single-use).
 */
export async function validateResetToken(token: string): Promise<string | null> {
  const supabase = createServerClient();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  // Find the token
  const { data, error } = await supabase
    .from("password_reset_tokens")
    .select("id, email, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date(now)) {
    return null;
  }

  // Check if already used
  if (data.used_at) {
    return null;
  }

  // Mark as used (single-use token)
  const { error: updateError } = await supabase
    .from("password_reset_tokens")
    .update({ used_at: now })
    .eq("id", data.id)
    .is("used_at", null); // optimistic concurrency guard

  if (updateError) {
    // Token was already consumed by a concurrent request
    return null;
  }

  return data.email;
}

/**
 * Invalidate a specific token by its plaintext value.
 */
export async function invalidateResetToken(token: string): Promise<void> {
  const supabase = createServerClient();
  const tokenHash = hashToken(token);

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null);
}

/**
 * Clean up expired tokens.
 * Called periodically to prevent table bloat.
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const supabase = createServerClient();
  const now = new Date().toISOString();

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: now })
    .lt("expires_at", now)
    .is("used_at", null);
}

/**
 * Get token expiry time in milliseconds from now.
 */
export function getTokenExpiryMs(): number {
  return TOKEN_EXPIRY_MS;
}
