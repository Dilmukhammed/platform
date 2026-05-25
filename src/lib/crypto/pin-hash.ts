/**
 * PIN hashing utilities using bcrypt with legacy MD5 support.
 *
 * Migration strategy:
 * - New PINs are hashed with bcrypt (cost factor 10)
 * - Existing MD5 hashes are still verified for backward compatibility
 * - On successful MD5 login, PIN is rehashed with bcrypt (rehash-on-login)
 *
 * bcrypt hashes start with "$2a$", "$2b$", or "$2y$" (Modular Crypt Format)
 * MD5 hashes are 32-character hex strings
 */

import { createHash } from "node:crypto";
import bcrypt from "bcrypt";

// bcrypt cost factor (10-12 is recommended for production)
const BCRYPT_SALT_ROUNDS = 10;

// MD5 hash length (32 hex characters)
const MD5_HASH_LENGTH = 32;

// bcrypt hash prefixes (Modular Crypt Format)
const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"];

/**
 * Check if a hash is a bcrypt hash (not MD5)
 */
export function isBcryptHash(hash: string): boolean {
  return BCRYPT_PREFIXES.some((prefix) => hash.startsWith(prefix));
}

/**
 * Check if a hash is an MD5 hash (32 hex characters)
 */
export function isMd5Hash(hash: string): boolean {
  return hash.length === MD5_HASH_LENGTH && /^[a-f0-9]+$/i.test(hash);
}

/**
 * Hash a PIN using bcrypt
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plaintext PIN against a stored hash.
 * Supports both bcrypt and legacy MD5 hashes.
 *
 * Returns an object with:
 * - matches: boolean indicating if PIN is correct
 * - needsRehash: boolean indicating if hash should be upgraded to bcrypt
 */
export async function comparePin(
  pin: string,
  storedHash: string,
): Promise<{ matches: boolean; needsRehash: boolean }> {
  // If it's already a bcrypt hash, use bcrypt compare
  if (isBcryptHash(storedHash)) {
    const matches = await bcrypt.compare(pin, storedHash);
    return { matches, needsRehash: false };
  }

  // If it's an MD5 hash, compare using MD5
  if (isMd5Hash(storedHash)) {
    const md5Hash = createHash("md5").update(pin).digest("hex");
    const matches = md5Hash === storedHash;
    // If MD5 matches, we need to rehash with bcrypt
    return { matches, needsRehash: matches };
  }

  // Unknown hash format
  return { matches: false, needsRehash: false };
}

/**
 * Legacy MD5 hash function - for internal use only during migration.
 * @deprecated Use hashPin() for new PINs
 */
export function md5Hash(input: string): string {
  return createHash("md5").update(input).digest("hex");
}
