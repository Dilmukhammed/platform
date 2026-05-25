import { cache } from "react";
import { redirect } from "next/navigation";

import { getAuthSession } from "./session";
import { resolveAreaAccess } from "@/modules/auth";
import type { AuthenticatedSession, ProtectedArea } from "./types";

const getProtectedAreaSession = cache(
  async (area: Exclude<ProtectedArea, "public">): Promise<AuthenticatedSession> => {
    const session = await getAuthSession();
    const decision = resolveAreaAccess({ area, session });

    if (!decision.allowed) {
      redirect(decision.redirectTo);
    }

    return session as AuthenticatedSession;
  },
);

export async function requireAreaAccess(area: Exclude<ProtectedArea, "public">): Promise<AuthenticatedSession> {
  return getProtectedAreaSession(area);
}

const getPublicAreaSession = cache(async () => {
  const session = await getAuthSession();
  const decision = resolveAreaAccess({ area: "public", session });

  if (!decision.allowed) {
    redirect(decision.redirectTo);
  }

  return session;
});

export async function redirectAuthenticatedUserFromPublicArea() {
  return getPublicAreaSession();
}
