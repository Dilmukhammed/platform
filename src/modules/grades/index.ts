export const gradesModule = {
  scope: "grades",
  status: "production-ready",
} as const;

export * from "./types";
// store.ts, service.ts, access.ts, bootstrap-data.ts — legacy in-memory modules.
// Replaced by actions.ts (direct Supabase). Do NOT import them in production code.
