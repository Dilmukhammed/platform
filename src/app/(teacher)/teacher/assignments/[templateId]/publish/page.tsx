import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import {
  getTeacherAssignmentTemplateDetail,
  listTeacherClasses,
  type TeacherAssignmentTemplateDetail,
  type TeacherClassSummary,
} from "@/modules/teachers/server-data";
import { t } from "@/lib/translations";

// Types
type Class = TeacherClassSummary;
type AssignmentTemplate = TeacherAssignmentTemplateDetail;

// Template preview card
function TemplatePreviewCard({ 
  title, 
  description, 
  materialCount,
  hasLinkedTest
}: { 
  title: string; 
  description: string | null;
  materialCount: number;
  hasLinkedTest: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-h3">{title}</CardTitle>
          <StatusChip status="info" size="sm">{t.teacher.tests.detail.status.draft}</StatusChip>
        </div>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {materialCount > 0 && (
            <Badge variant="info" size="sm">
              {t.teacher.tests.detail.stats.materials(materialCount)}
            </Badge>
          )}
          {hasLinkedTest && (
            <Badge variant="primary" size="sm">
              {t.teacher.tests.detail.stats.tests(1)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Linked content summary
function LinkedContentSummary({ 
  materialCount, 
  hasLinkedTest 
}: { 
  materialCount: number; 
  hasLinkedTest: boolean; 
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.teacher.tests.publish.linkedContent.title}</CardTitle>
        <CardDescription>{t.teacher.tests.publish.linkedContent.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Materials */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">{t.teacher.tests.publish.linkedContent.materials}</h4>
          {materialCount === 0 ? (
            <p className="text-sm text-foreground-secondary">{t.teacher.tests.publish.linkedContent.noMaterials}</p>
          ) : (
            <p className="text-sm text-foreground">{t.teacher.tests.publish.linkedContent.materialsLinked(materialCount)}</p>
          )}
        </div>

        {/* Tests */}
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">{t.teacher.tests.publish.linkedContent.tests}</h4>
          {!hasLinkedTest ? (
            <p className="text-sm text-foreground-secondary">{t.teacher.tests.publish.linkedContent.noTests}</p>
          ) : (
            <p className="text-sm text-foreground">{t.teacher.tests.publish.linkedContent.oneTestLinked}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Class selection component
function ClassSelection({ classes }: { classes: Class[] }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{t.teacher.tests.publish.targetClasses.title}</h3>
        <p className="text-sm text-foreground-secondary">
          {t.teacher.tests.publish.targetClasses.description}
        </p>
      </div>
      
      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground-secondary">
          {t.teacher.tests.publish.targetClasses.noActiveClasses}
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((classItem, index) => (
            <div 
              key={classItem.classId}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input 
                  type="checkbox" 
                  name="classId" 
                  value={classItem.classId}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{classItem.title}</span>
                  </div>
                  
                  {/* Deadline override for this class */}
                  <div className="mt-3">
                    <label className="block text-sm text-foreground-secondary mb-1">
                      {t.teacher.tests.publish.targetClasses.optionalDeadlineOverride}
                    </label>
                    <Input
                      type="datetime-local"
                      name={`deadlineOverride_${classItem.classId}`}
                      size="sm"
                      className="w-full sm:w-auto"
                    />
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to detect Next.js redirect errors
function isNextRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "NEXT_REDIRECT" ||
     (error as Error & { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE === "NEXT_REDIRECT")
  );
}

// Server action to publish assignment
async function publishAssignmentAction(formData: FormData) {
  "use server";
  
  const templateId = formData.get("templateId") as string;
  const defaultDeadline = formData.get("defaultDeadline") as string;
  const isoDeadline = defaultDeadline ? new Date(defaultDeadline).toISOString() : undefined;
  const classIds = formData.getAll("classId") as string[];
  
  // Collect per-class deadline overrides
  const deadlineOverrides: Record<string, string> = {};
  for (const classId of classIds) {
    const overrideValue = formData.get(`deadlineOverride_${classId}`) as string;
    if (overrideValue) {
      deadlineOverrides[classId] = new Date(overrideValue).toISOString();
    }
  }
  
  if (classIds.length === 0) {
    redirect(`/teacher/assignments/${templateId}/publish?error=${encodeURIComponent(t.teacher.tests.publish.errors.selectAtLeastOne)}`);
  }
  
  try {
    await apiPost(`/api/v1/teacher/assignment-templates/${templateId}/publications`, {
      defaultDeadline: isoDeadline,
      classIds,
      deadlineOverrides,
    });

    revalidatePath("/teacher/publications");
    redirect("/teacher/publications?published=true");
  } catch (error) {
    // Re-throw redirect errors so Next.js can handle them properly
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[assignments/publish] Failed to publish assignment:", error);
    const errorMessage = error instanceof Error ? error.message : t.teacher.tests.publish.errors.failed;
    redirect(`/teacher/assignments/${templateId}/publish?error=${encodeURIComponent(errorMessage)}`);
  }
}

// Page component
export default async function TeacherPublishAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  const { templateId } = await params;
  const query = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const error = typeof query.error === "string" ? query.error : null;

  let template: AssignmentTemplate | null = null;
  let classes: Class[] = [];

  try {
    const [templateDetail, teacherClasses] = await Promise.all([
      getTeacherAssignmentTemplateDetail(session.userId, templateId),
      listTeacherClasses(session.userId, { pageSize: 100 }),
    ]);
    template = templateDetail;
    classes = teacherClasses;
  } catch {
    notFound();
  }

  if (!template) {
    notFound();
  }

  // Filter active classes only
  const activeClasses = classes.filter(c => c.status === "active");

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" leftIcon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        }>
          <Link href={`/teacher/assignments/${templateId}`}>{t.teacher.tests.publish.back}</Link>
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CardTitle className="text-h1">{t.teacher.tests.publish.title}</CardTitle>
                <StatusChip
                  status={template.status === "active" ? "success" : template.status === "archived" ? "info" : "warning"}
                  size="sm"
                >
                  {template.status === "active" ? t.teacher.tests.detail.status.active : template.status === "archived" ? t.teacher.tests.detail.status.archived : t.teacher.tests.detail.status.draft}
                </StatusChip>
              </div>
              <CardDescription>
                {t.teacher.tests.publish.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error ? <StatusAlert tone="error" className="rounded-xl">{error}</StatusAlert> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Template Preview */}
          <TemplatePreviewCard 
            title={template.title}
            description={template.description}
            materialCount={template.materialIds.length}
            hasLinkedTest={!!template.linkedTestId}
          />

          {/* Publish Form */}
          <form action={publishAssignmentAction} className="space-y-6">
            <input type="hidden" name="templateId" value={templateId} />
            
            <Card>
              <CardHeader>
                <CardTitle>{t.teacher.tests.publish.settings.title}</CardTitle>
                <CardDescription>
                  {t.teacher.tests.publish.settings.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default Deadline */}
                <FormField
                  label={t.teacher.tests.publish.settings.defaultDeadline}
                  htmlFor="defaultDeadline"
                  hint={t.teacher.tests.publish.settings.defaultDeadlineHint}
                  required
                >
                  <Input
                    id="defaultDeadline"
                    name="defaultDeadline"
                    type="datetime-local"
                    required
                  />
                </FormField>

                {/* Class Selection */}
                <ClassSelection classes={activeClasses} />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button asChild variant="secondary">
                <Link href={`/teacher/assignments/${templateId}`}>{t.teacher.tests.publish.actions.cancel}</Link>
              </Button>
              <Button 
                type="submit"
                disabled={activeClasses.length === 0}
              >
                {t.teacher.tests.publish.actions.publish}
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <LinkedContentSummary 
            materialCount={template.materialIds.length}
            hasLinkedTest={!!template.linkedTestId}
          />

          {/* Info Card */}
          <Card className="bg-primary-subtle/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 text-primary"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <p className="font-medium text-foreground">{t.teacher.tests.publish.tips.title}</p>
                  <ul className="mt-2 space-y-1 text-sm text-foreground-secondary">
                    <li>• {t.teacher.tests.publish.tips.selectClass}</li>
                    <li>• {t.teacher.tests.publish.tips.setDeadline}</li>
                    <li>• {t.teacher.tests.publish.tips.useOverrides}</li>
                    <li>• {t.teacher.tests.publish.tips.studentsNotified}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
