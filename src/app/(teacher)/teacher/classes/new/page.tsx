import Link from "next/link";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertCircle, Building2 } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";
import { createServerClient } from "@/lib/supabase/server-client";
import { t } from "@/lib/translations";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { getTeacherSelectedOrganization } from "@/modules/teachers/server-data";

// Server action to create class
async function createClassAction(formData: FormData) {
  "use server";
  
  const session = await requireAreaAccess("teacher");
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  
  try {
    const selectedOrg = await getTeacherSelectedOrganization(session.userId);
    
    if (!selectedOrg?.organizationId) {
      redirect("/teacher/classes/new?error=" + encodeURIComponent(t.teacher.classes.new.errors.selectOrganizationFirst));
    }

    // Check for duplicate class name in the same organization
    const supabase = createServerClient();
    const { data: allClasses } = await supabase
      .from("classes")
      .select("id, title")
      .eq("organization_id", selectedOrg.organizationId)
      .is("deleted_at", null);

    const existingClass = (allClasses ?? []).find((c: Record<string, unknown>) => (c.title as string) === title);

    if (existingClass) {
      redirect(`/teacher/classes/new?error=${encodeURIComponent(t.teacher.classes.new.errors.duplicateClass)}`);
    }
    
    await apiPost("/api/v1/teacher/classes", { organizationId: selectedOrg.organizationId, title, description });

    revalidatePath("/teacher/classes");
    redirect("/teacher/classes?created=true");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[classes/new] Failed to create class:", error);
    const errorMessage = error instanceof Error ? error.message : t.teacher.classes.new.errors.failed;
    redirect(`/teacher/classes/new?error=${encodeURIComponent(errorMessage)}`);
  }
}

export default async function NewClassPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const error = typeof params.error === "string" ? params.error : null;
  
  let selectedOrganization = null;
  try {
    selectedOrganization = await getTeacherSelectedOrganization(session.userId);
  } catch (error) {
    console.error("[classes/new] Failed to fetch selected organization:", error);
    selectedOrganization = null;
  }

  // If no organization is selected, show empty state
  if (!selectedOrganization?.organizationId) {
    return (
      <section className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/teacher/classes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.teacher.classes.new.back}
        </Link>
      </Button>

      <Card elevation="sm">
        <CardContent className="py-8">
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title={t.teacher.classes.messages.noOrganizationSelected}
            description={t.teacher.classes.messages.noOrganizationDescription}
            action={
              <Button asChild>
                <Link href="/teacher/organizations">{t.teacher.classes.messages.goToOrganizations}</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/teacher/classes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.teacher.classes.new.back}
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">{t.teacher.classes.new.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">
          {t.teacher.classes.new.description}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Organization Info */}
      <Card elevation="sm" className="bg-primary-subtle/30">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-foreground-secondary">{t.teacher.classes.new.creatingIn}</p>
            <p className="font-medium text-foreground">{selectedOrganization.organizationName}</p>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card elevation="sm">
        <form action={createClassAction}>
          <CardHeader>
            <CardTitle>{t.teacher.classes.new.details}</CardTitle>
            <CardDescription>
              {t.teacher.classes.new.detailsDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label={t.teacher.classes.new.classTitle}
              htmlFor="title"
              required
              hint={t.teacher.classes.new.classTitleHint}
            >
              <Input
                id="title"
                name="title"
                type="text"
                placeholder={t.teacher.classes.new.classTitlePlaceholder}
                required
                minLength={3}
                autoComplete="off"
              />
            </FormField>

            <FormField
              label={t.teacher.classes.new.descriptionLabel}
              htmlFor="description"
              hint={t.teacher.classes.new.descriptionHint}
            >
              <Textarea
                id="description"
                name="description"
                placeholder={t.teacher.classes.new.descriptionPlaceholder}
                rows={4}
              />
            </FormField>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Button variant="ghost" asChild>
              <Link href="/teacher/classes">{t.teacher.classes.new.cancel}</Link>
            </Button>
            <Button type="submit">{t.teacher.classes.new.submit}</Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
