import Link from "next/link";
import { redirect } from "next/navigation";

import { apiPost } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

function isNextRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "NEXT_REDIRECT" || 
     (error as Error & { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE === "NEXT_REDIRECT")
  );
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeacherSignUpPage({
  searchParams,
}: Readonly<{
  searchParams: SearchParams;
}>) {
  const params = await searchParams;
  
  // Read general error and field-specific errors
  const generalError = readSearchParam(params.error);
  const fieldErrors = {
    name: readSearchParam(params.error_name),
    email: readSearchParam(params.error_email),
    password: readSearchParam(params.error_password),
    confirmPassword: readSearchParam(params.error_confirmPassword),
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{t.auth.shared.staffAccess}</p>
          <h1 className="text-3xl font-bold">{t.auth.teacher.createTeacherAccountTitle}</h1>
          <p className="text-sm text-muted">
            {t.auth.teacher.createTeacherAccountDescription}
          </p>
        </div>

        {/* Sign Up Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t.auth.teacher.signUpCardTitle}</CardTitle>
            <CardDescription>
              {t.auth.teacher.signUpCardDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* General Error Message */}
            {generalError && (
              <div className="mb-4 rounded-lg border border-error bg-error-subtle px-4 py-3">
                <p className="text-sm text-error">{generalError}</p>
              </div>
            )}

            <form action={async (formData) => {
              "use server";
              const name = formData.get("name") as string;
              const email = formData.get("email") as string;
              const password = formData.get("password") as string;
              const confirmPassword = formData.get("confirmPassword") as string;
              try {
                await apiPost("/api/v1/auth/signup", {
                  name,
                  email,
                  password,
                  confirmPassword,
                });
                redirect("/auth/teacher/sign-in?registered=true");
              } catch (error) {
                if (isNextRedirectError(error)) {
                  throw error;
                }
                const message = error instanceof Error ? error.message : t.auth.shared.createAccountFailed;
                const params = new URLSearchParams();
                params.set("error", message);
                // Preserve form values for better UX
                params.set("name", name);
                params.set("email", email);
                redirect(`/auth/teacher/sign-up?${params.toString()}`);
              }
            }} className="space-y-4">
              <FormField 
                label={t.auth.teacher.fullName} 
                htmlFor="name" 
                required
                error={fieldErrors.name}
              >
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder={t.auth.teacher.fullNamePlaceholder}
                  required
                  autoComplete="name"
                  state={fieldErrors.name ? "error" : "default"}
                  defaultValue={readSearchParam(params.name)}
                />
              </FormField>

              <FormField 
                label={t.common.email} 
                htmlFor="email" 
                required
                error={fieldErrors.email}
              >
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@school.edu"
                  required
                  autoComplete="email"
                  state={fieldErrors.email ? "error" : "default"}
                  defaultValue={readSearchParam(params.email)}
                />
              </FormField>

              <FormField 
                label={t.common.password} 
                htmlFor="password" 
                required
                hint={t.auth.teacher.passwordHintMin}
                error={fieldErrors.password}
              >
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t.auth.teacher.passwordPlaceholder}
                  required
                  autoComplete="new-password"
                  state={fieldErrors.password ? "error" : "default"}
                />
              </FormField>

              <FormField 
                label={t.auth.teacher.confirmPassword} 
                htmlFor="confirmPassword" 
                required
                error={fieldErrors.confirmPassword}
              >
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder={t.auth.teacher.passwordPlaceholder}
                  required
                  autoComplete="new-password"
                  state={fieldErrors.confirmPassword ? "error" : "default"}
                />
              </FormField>

              <Button type="submit" className="w-full">
                {t.auth.teacher.createAccountButton}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="space-y-2 text-center text-sm text-muted">
          <p>
            {t.auth.shared.alreadyHaveAccount}{" "}
            <Link href="/auth/teacher/sign-in" className="text-primary hover:underline">
              {t.common.signIn}
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
