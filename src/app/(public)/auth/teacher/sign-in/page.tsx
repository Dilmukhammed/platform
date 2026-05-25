import Link from "next/link";
import { redirect } from "next/navigation";

import { apiPost } from "@/lib/api/server-fetch";
import { writeAuthSession } from "@/lib/auth/session";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TeacherSignInResponse = {
  principal: {
    id: string;
    displayName: string;
  };
  role: "teacher" | "super_admin";
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

export default async function TeacherSignInPage({
  searchParams,
}: Readonly<{
  searchParams: SearchParams;
}>) {
  const params = await searchParams;
  const errorMessage = readSearchParam(params.error);
  const isRateLimited = isRateLimitError(errorMessage);
  const isJustRegistered = readSearchParam(params.registered) === "true";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{t.auth.shared.staffAccess}</p>
          <h1 className="text-3xl font-bold">{t.auth.teacher.teacherSignInTitle}</h1>
          <p className="text-sm text-muted">
            {t.auth.teacher.teacherSignInDescription}
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-lg border border-error bg-error-subtle px-4 py-3">
            <p className="text-sm text-error">{errorMessage}</p>
          </div>
        )}

        {/* Registration Success Message */}
        {isJustRegistered && (
          <div className="rounded-lg border border-success bg-success-subtle px-4 py-3">
            <p className="text-sm text-success">{t.auth.shared.accountCreatedSuccess}</p>
          </div>
        )}

        {/* Sign In Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t.auth.teacher.signInCardTitle}</CardTitle>
            <CardDescription>
              {t.auth.teacher.signInCardDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={async (formData) => {
              "use server";
              const email = formData.get("email") as string;
              const password = formData.get("password") as string;
              try {
                const response = await apiPost<TeacherSignInResponse>("/api/v1/session", {
                  email,
                  password,
                });

                await writeAuthSession({
                  userId: response.principal.id,
                  role: response.role,
                  displayName: response.principal.displayName,
                  loginIdentifier: email,
                });

                const homePath = response.role === "super_admin" ? "/admin" : "/teacher";
                redirect(homePath);
              } catch (error) {
                if (isNextRedirectError(error)) {
                  throw error;
                }
                const message = error instanceof Error ? error.message : t.auth.shared.signInFailed;
                const params = new URLSearchParams();
                params.set("error", message);
                // Preserve email for better UX
                params.set("email", email);
                redirect(`/auth/teacher/sign-in?${params.toString()}`);
              }
            }} className="space-y-4">
              <FormField label={t.common.email} htmlFor="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t.auth.teacher.emailPlaceholder}
                  required
                  autoComplete="email"
                  defaultValue={readSearchParam(params.email)}
                />
              </FormField>

              <FormField label={t.common.password} htmlFor="password" required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t.auth.teacher.passwordPlaceholder}
                  required
                  autoComplete="current-password"
                />
              </FormField>

              <div className="flex items-center justify-between">
                <Link
                  href="/auth/teacher/reset-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t.common.forgotPassword}
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={isRateLimited}>
                {isRateLimited ? t.common.waitBeforeRetrying : t.auth.teacher.signInButton}
              </Button>
            </form>
          </CardContent>
        </Card>

        

        {/* Footer Links */}
        <div className="space-y-2 text-center text-sm text-muted">
          <p>
            {t.auth.shared.dontHaveAccount}{" "}
            <Link href="/auth/teacher/sign-up" className="text-primary hover:underline">
              {t.common.signUp}
            </Link>
          </p>
          <p>
            {t.auth.shared.studentAltLogin}{" "}
            <Link href="/auth/student/login" className="text-primary hover:underline">
              {t.auth.shared.useLoginPinInstead}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
