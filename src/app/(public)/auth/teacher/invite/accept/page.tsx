import Link from "next/link";
import { Mail, AlertCircle } from "lucide-react";

import { getAuthSession } from "@/lib/auth/session";
import { apiPost } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type InviteState = 
  | { status: "valid"; inviteToken: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

function readSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validateInvite(token: string | undefined): InviteState {
  if (!token) {
    return { status: "not_found" };
  }

  // Basic validation: token must be present
  // Full validation (expired, revoked, already used, wrong account) happens server-side
  // when the join-by-invite API is called
  return { status: "valid", inviteToken: token };
}

export default async function TeacherInviteAcceptPage({
  searchParams,
}: Readonly<{
  searchParams: SearchParams;
}>) {
  const params = await searchParams;
  const token = readSearchParam(params.token);
  const errorMessage = readSearchParam(params.error);
  
  // Get current session to check if user is authenticated
  const session = await getAuthSession();
  const userEmail = session?.loginIdentifier || null;

  // Basic validation: token presence only
  const inviteState = validateInvite(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{t.auth.teacher.invite.heading}</p>
          <h1 className="text-3xl font-bold">{t.auth.teacher.invite.title}</h1>
        </div>

        {/* Error from action */}
        {errorMessage && (
          <div className="rounded-lg border border-error bg-error-subtle px-4 py-3">
            <p className="text-sm text-error">{errorMessage}</p>
          </div>
        )}

        {/* State: Valid Invite */}
        {inviteState.status === "valid" && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle">
                <Mail className="h-6 w-6 text-success" />
              </div>
              <CardTitle>{t.auth.teacher.invite.invitedTitle}</CardTitle>
              <CardDescription>
                {t.auth.teacher.invite.invitedDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted text-center">
                    {t.auth.teacher.invite.signInOrCreateToAccept}
                  </p>
                  <div className="flex gap-3">
                    <Button asChild variant="secondary" className="flex-1">
                      <Link href={`/auth/teacher/sign-in?token=${encodeURIComponent(inviteState.inviteToken)}`}>
                        {t.common.signIn}
                      </Link>
                    </Button>
                    <Button asChild className="flex-1">
                      <Link href={`/auth/teacher/sign-up?token=${encodeURIComponent(inviteState.inviteToken)}`}>
                        {t.common.signUp}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <form action={async (formData: FormData) => {
                  "use server";
                  const token = formData.get("inviteToken") as string;
                  try {
                    await apiPost("/api/v1/teacher/organizations/join-by-invite", { inviteToken: token });
                  } catch (error) {
                    const message = error instanceof Error ? error.message : t.auth.teacher.invite.failedToAccept;
                    redirect(`/auth/teacher/invite/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`);
                  }
                }} className="space-y-4">
                  <input type="hidden" name="inviteToken" value={inviteState.inviteToken} />
                  <p className="text-sm text-muted text-center">
                    {t.auth.teacher.invite.signedInAs(userEmail || "")}
                  </p>
                  <Button type="submit" className="w-full">
                    {t.auth.teacher.invite.acceptInvitation}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* State: Not Found / Invalid */}
        {inviteState.status === "not_found" && (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={<AlertCircle className="h-6 w-6" />}
                title={t.auth.teacher.invite.invalidInvitationTitle}
                description={t.auth.teacher.invite.invalidInvitationDescription}
                action={
                  <Button asChild variant="secondary">
                    <Link href="/auth/teacher">{t.auth.teacher.invite.goToSignIn}</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}

        {/* State: Error */}
        {inviteState.status === "error" && (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={<AlertCircle className="h-6 w-6" />}
                title={t.auth.teacher.invite.somethingWentWrong}
                description={inviteState.message}
                action={
                  <Button asChild variant="secondary">
                    <Link href="/auth/teacher">{t.auth.teacher.invite.goToSignIn}</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-muted">
          {t.auth.shared.needHelp}{" "}
          <Link href="/help" className="text-primary hover:underline">
            {t.common.contactSupport}
          </Link>
        </p>
      </div>
    </main>
  );
}
