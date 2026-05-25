import Link from "next/link";
import { redirect } from "next/navigation";

import { apiPost } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeacherResetPasswordPage({
  searchParams,
}: Readonly<{
  searchParams: SearchParams;
}>) {
  const params = await searchParams;
  
  // Read status and error messages
  const status = readSearchParam(params.status);
  const errorMessage = readSearchParam(params.error);
  const successMessage = readSearchParam(params.success);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{t.auth.shared.staffAccess}</p>
          <h1 className="text-3xl font-bold">{t.auth.teacher.resetPasswordTitle}</h1>
          <p className="text-sm text-muted">
            {t.auth.teacher.resetPasswordDescription}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="rounded-lg border border-success bg-success-subtle px-4 py-3">
            <p className="text-sm text-success">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-lg border border-error bg-error-subtle px-4 py-3">
            <p className="text-sm text-error">{errorMessage}</p>
          </div>
        )}

        {/* Reset Password Form */}
        {!successMessage && (
          <Card>
            <CardHeader>
              <CardTitle>{t.auth.teacher.resetPasswordCardTitle}</CardTitle>
              <CardDescription>
                {t.auth.teacher.resetPasswordCardDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={async (formData) => {
                  "use server";
                  const email = formData.get("email") as string;
                  
                  try {
                    await apiPost("/api/v1/auth/reset-password", {
                      email,
                    });

                    // Always show success message (don't reveal if email exists)
                    const params = new URLSearchParams();
                    params.set(
                      "success",
                      t.auth.teacher.resetInstructionsSentFallback
                    );
                    redirect(`/auth/teacher/reset-password?${params.toString()}`);
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : t.auth.teacher.resetInstructionsFailed;
                    const params = new URLSearchParams();
                    params.set("error", message);
                    // Preserve email for better UX
                    params.set("email", email);
                    redirect(`/auth/teacher/reset-password?${params.toString()}`);
                  }
                }}
                className="space-y-4"
              >
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

                <Button type="submit" className="w-full">
                  {t.auth.teacher.sendResetInstructions}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer Links */}
        <div className="space-y-2 text-center text-sm text-muted">
          <p>
            {t.auth.teacher.rememberPassword}{" "}
            <Link href="/auth/teacher/sign-in" className="text-primary hover:underline">
              {t.common.signIn}
            </Link>
          </p>
          <p>
            {t.auth.shared.dontHaveAccount}{" "}
            <Link href="/auth/teacher/sign-up" className="text-primary hover:underline">
              {t.common.signUp}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
