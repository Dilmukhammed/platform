export const joinCodesModule = {
  scope: "join-codes",
  status: "production-ready",
} as const;

export * from "./types";
// store.ts, service.ts, bootstrap-data.ts — legacy in-memory modules.
// Join codes are now managed via Supabase class_join_codes table directly.
