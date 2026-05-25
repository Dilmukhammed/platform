export type StaffRole = "teacher" | "super_admin";

export type AuthRole = StaffRole | "student";

export type ProtectedArea = "public" | "teacher" | "student" | "admin";

export type StaffAuthRecord = {
  id: string;
  role: StaffRole;
  email: string;
  /** bcrypt hash — never store plaintext passwords in source code */
  passwordHash: string;
  displayName: string;
  status: "active" | "suspended" | "archived";
};

export type StudentAuthRecord = {
  id: string;
  studentLogin: string;
  displayName: string;
  pinHash: string;
  status: "active" | "blocked" | "archived";
};

export type AuthenticatedSession = {
  userId: string;
  role: AuthRole;
  displayName: string;
  loginIdentifier: string;
};

export type AuthSuccess = {
  ok: true;
  session: AuthenticatedSession;
};

export type AuthFailure = {
  ok: false;
  error: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type AccessDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      redirectTo: string;
      reason: "unauthenticated" | "role_mismatch";
    };
