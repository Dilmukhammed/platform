import Link from "next/link";
import { redirect } from "next/navigation";

import { apiPost } from "@/lib/api/server-fetch";
import { writeAuthSession } from "@/lib/auth/session";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type StudentCreateProfileResponse = {
  principal: {
    id: string;
    displayName: string;
  };
  role: "student";
  studentLogin: string;
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

export default async function StudentCreateProfilePage({
  searchParams,
}: Readonly<{
  searchParams: SearchParams;
}>) {
  const params = await searchParams;
  const generalError = readSearchParam(params.error);
  const firstNameError = readSearchParam(params.error_firstName);
  const lastNameError = readSearchParam(params.error_lastName);
  const pinError = readSearchParam(params.error_pin);
  const returnUrl = sanitizeReturnUrl(readSearchParam(params.returnUrl));

  // Check if there are any field-specific errors
  const hasFieldErrors = firstNameError || lastNameError || pinError;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Card elevation="sm">
        <CardHeader>
          <p className="text-body-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.auth.shared.newStudent}
          </p>
          <CardTitle className="text-h1">{t.auth.student.createProfileTitle}</CardTitle>
          <CardDescription>
            {t.auth.student.createProfileDescription}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {generalError ? (
            <div className="mb-6 rounded-lg border border-error bg-error/5 px-4 py-3">
              <p className="text-body-sm text-error">{generalError}</p>
            </div>
          ) : null}

          <form action={async (formData) => {
            "use server";
            const firstName = formData.get("firstName") as string;
            const lastName = formData.get("lastName") as string;
            const middleName = formData.get("middleName") as string;
            const pin = formData.get("pin") as string;
            try {
              const response = await apiPost<StudentCreateProfileResponse>("/api/v1/student/auth/create-profile", {
                firstName,
                lastName,
                middleName,
                pin,
              });

              await writeAuthSession({
                userId: response.principal.id,
                role: response.role,
                displayName: response.principal.displayName,
                loginIdentifier: response.studentLogin,
              });

              redirect(returnUrl);
            } catch (error) {
              if (isNextRedirectError(error)) {
                throw error;
              }
              const message = error instanceof Error ? error.message : t.auth.student.createProfileFailed;
              const params = new URLSearchParams();
              params.set("error", message);
              // Preserve form values for better UX
              params.set("firstName", firstName);
              params.set("lastName", lastName);
              if (middleName) params.set("middleName", middleName);
              if (returnUrl !== "/student") params.set("returnUrl", returnUrl);
              redirect(`/auth/student/create-profile?${params.toString()}`);
            }
          }} className="space-y-4">
            <FormField
              label={t.auth.student.firstName}
              htmlFor="firstName"
              error={firstNameError}
              required
            >
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required
                minLength={2}
                autoComplete="given-name"
                placeholder={t.auth.student.firstNamePlaceholder}
                defaultValue={readSearchParam(params.firstName)}
              />
            </FormField>

            <FormField
              label={t.auth.student.lastName}
              htmlFor="lastName"
              error={lastNameError}
              required
            >
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                minLength={2}
                autoComplete="family-name"
                placeholder={t.auth.student.lastNamePlaceholder}
                defaultValue={readSearchParam(params.lastName)}
              />
            </FormField>

            <FormField
              label={t.auth.student.middleName}
              htmlFor="middleName"
              hint={t.common.optional}
            >
              <Input
                id="middleName"
                name="middleName"
                type="text"
                autoComplete="additional-name"
                placeholder={t.auth.student.middleNamePlaceholder}
                defaultValue={readSearchParam(params.middleName)}
              />
            </FormField>

            <FormField
              label={t.auth.student.createPin}
              htmlFor="pin"
              error={pinError}
              hint={t.auth.student.createPinHint}
              required
            >
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                autoComplete="new-password"
                placeholder={t.auth.student.createPinPlaceholder}
              />
            </FormField>

            <Button type="submit" size="lg" className="w-full">
              {t.auth.student.createProfileAndSignIn}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-body-sm text-foreground-secondary">
              {t.auth.shared.alreadyHaveAccount}{" "}
              <Link
                href={`/auth/student/login${returnUrl !== "/student" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
                className="text-primary hover:text-primary-hover hover:underline"
              >
                {t.auth.student.signInHere}
              </Link>
            </p>
          </div>

          <div className="mt-6 rounded-lg bg-surface p-4">
            <p className="text-body-sm text-foreground-secondary">
              {t.auth.student.helpBox}
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
