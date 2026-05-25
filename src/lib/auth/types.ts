// Re-export auth types from modules to avoid direct module imports in lib
export type {
  StaffRole,
  AuthRole,
  ProtectedArea,
  StaffAuthRecord,
  StudentAuthRecord,
  AuthenticatedSession,
  AuthSuccess,
  AuthFailure,
  AuthResult,
  AccessDecision,
} from "@/modules/auth/types";
