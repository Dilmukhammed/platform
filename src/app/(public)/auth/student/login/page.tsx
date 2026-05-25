import Link from "next/link";
import { redirect } from "next/navigation";

import { apiPost } from "@/lib/api/server-fetch";
import { writeAuthSession } from "@/lib/auth/session";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type StudentLoginResponse = {
  principal: {
    id: string;
    displayName: string;
  };
  role: "student";
};

function isNextRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "NEXT_REDIRECT" || (error as Error & { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE === "NEXT_REDIRECT")
  );
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isRateLimitError(message: string | undefined): boolean {
  return message?.includes("Too many login attempts") ?? false;
}

function sanitizeReturnUrl(url: string | undefined): string {
  if (!url) return "/student";
  if (url.includes("..")) return "/student";
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.origin !== "http://localhost") return "/student";
    const path = parsed.pathname;
    if (!path.startsWith("/")) return "/student";
    const localUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (localUrl.includes("//")) return "/student";
    return localUrl;
  } catch {
    return "/student";
  }
}

export default async function StudentLoginPage({
  searchParams,
}: Readonly<{
  searchParams: SearchParams;
}>) {
  const params = await searchParams;
  const errorMessage = readSearchParam(params.error);
  const returnUrl = sanitizeReturnUrl(readSearchParam(params.returnUrl));
  const isRateLimited = isRateLimitError(errorMessage);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Card elevation="sm">
        <CardHeader>
          <p className="text-body-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.auth.shared.studentAccess}
          </p>
          <CardTitle className="text-h1">{t.auth.student.signInTitle}</CardTitle>
          <CardDescription>
            {t.auth.student.signInDescription}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMessage ? (
            <div className="mb-6 rounded-lg border border-error bg-error/5 px-4 py-3">
              <p className="text-body-sm text-error">{errorMessage}</p>
            </div>
          ) : null}

          <form action={async (formData) => {
            "use server";
            const studentLogin = formData.get("studentLogin") as string;
            const pin = formData.get("pin") as string;
            try {
              const response = await apiPost<StudentLoginResponse>("/api/v1/student/auth/login", {
                studentLogin,
                pin,
              });

              await writeAuthSession({
                userId: response.principal.id,
                role: response.role,
                displayName: response.principal.displayName,
                loginIdentifier: studentLogin,
              });

              redirect(returnUrl);
            } catch (error) {
              if (isNextRedirectError(error)) {
                throw error;
              }
              const message = error instanceof Error ? error.message : t.auth.shared.signInFailed;
              redirect(`/auth/student/login?error=${encodeURIComponent(message)}`);
            }
          }} className="space-y-4">
            <FormField
              label={t.auth.student.studentLogin}
              htmlFor="studentLogin"
              hint={t.auth.student.studentLoginHint}
            >
              <Input
                id="studentLogin"
                name="studentLogin"
                type="text"
                required
                autoComplete="username"
                className="uppercase"
              />
            </FormField>

            <FormField
              label={t.auth.student.pin}
              htmlFor="pin"
              hint={t.auth.student.pinHint}
            >
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                autoComplete="current-password"
              />
            </FormField>

            <Button type="submit" size="lg" className="w-full" disabled={isRateLimited}>
              {isRateLimited ? t.common.waitBeforeRetrying : t.auth.student.continueToWorkspace}
            </Button>
          </form>

          

          <div className="mt-6 space-y-3 text-center">
            <p className="text-body-sm text-foreground-secondary">
              {t.auth.shared.firstTimeHere}{" "}
                <Link
                  href={`/auth/student/create-profile${returnUrl !== "/student" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
                  className="text-primary hover:text-primary-hover hover:underline"
                >
                  {t.auth.student.createProfileLink}
                </Link>
            </p>
            <p className="text-body-sm text-foreground-secondary">
              {t.auth.shared.teacherOrAdmin}{" "}
              <Link
                href="/auth/teacher/sign-in"
                className="text-primary hover:text-primary-hover hover:underline"
              >
                {t.auth.shared.useStaffSignIn}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
