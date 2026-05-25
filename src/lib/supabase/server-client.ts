/**
 * Server-side Supabase client using the service role key.
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * The service role key bypasses RLS — only use in trusted server contexts.
 */

import { createClient } from "@supabase/supabase-js";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to your .env.local file.`,
    );
  }
  return value;
}

export function createServerClient() {
  const url = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get a Map of auth user IDs to their email addresses.
 * Uses the Supabase Auth Admin API to access auth.users table.
 * 
 * This is needed because cross-schema joins (public -> auth) 
 * don't work via the Supabase JS client.
 * 
 * @returns Map<string, string> - userId -> email
 */
export async function getAuthUserEmails(): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const emailMap = new Map<string, string>();
  
  // Paginate through all users
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error) {
      console.error("[getAuthUserEmails] Error listing users:", error);
      break;
    }
    
    if (!data?.users?.length) {
      break;
    }
    
    for (const user of data.users) {
      if (user.id && user.email) {
        emailMap.set(user.id, user.email);
      }
    }
    
    // Check if we've fetched all users
    if (data.users.length < perPage) {
      break;
    }
    
    page++;
  }
  
  return emailMap;
}
