import { describe, expect, test } from "bun:test";

import { authenticateStudent, resolveAreaAccess } from "@/modules/auth";
import { t } from "@/lib/translations";

describe("auth foundation", () => {
  test("accepts valid seeded student login + PIN", async () => {
    const result = await authenticateStudent({
      studentLogin: "ST-100001",
      pin: "1111",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.session.role).toBe("student");
      expect(result.session.displayName).toBe("Alex Morozov");
    }
  });

  test("rejects invalid student PIN with explicit auth error", async () => {
    const result = await authenticateStudent({
      studentLogin: "ST-100001",
      pin: "0000",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toBe(t.api.authService.studentLoginOrPinIncorrect);
    }
  });

  test("denies admin area access for non-admin sessions", () => {
    const decision = resolveAreaAccess({
      area: "admin",
      session: {
        userId: "20000000-0000-4000-8000-000000000002",
        role: "teacher",
        displayName: "Demo Teacher",
        loginIdentifier: "teacher@platform.local",
      },
    });

    expect(decision.allowed).toBe(false);

    if (!decision.allowed) {
      expect(decision.reason).toBe("role_mismatch");
      expect(decision.redirectTo).toBe("/teacher");
    }
  });
});
