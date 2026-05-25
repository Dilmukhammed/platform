import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { FileText, ClipboardList, Archive } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPatch } from "@/lib/api/server-fetch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusAlert } from "@/components/ui/status-alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTeacherAssignmentTemplateDetail,
  listTeacherAssignmentPublications,
  type TeacherAssignmentTemplateDetail,
} from "@/modules/teachers/server-data";
import { t } from "@/lib/translations";

// Types
interface Publication {
  id: string;
  title: string;
  templateId: string;
  classCount: number;
  defaultDeadline: string | null;
  createdAt: string;
}
type AssignmentTemplate = TeacherAssignmentTemplateDetail;

// Server action to archive a template
async function archiveTemplateAction(formData: FormData) {
  "use server";
  const templateId = formData.get("templateId") as string;
  try {
    await apiPatch(`/api/v1/teacher/assignment-templates/${templateId}`, { status: "archived" });
    revalidatePath("/teacher/assignments");
    redirect("/teacher/assignments?archived=true");
  } catch {
    redirect(`/teacher/assignments/${templateId}?error=${encodeURIComponent(t.teacher.tests.detail.errors.archiveFailed)}`);
  }
}

// Linked content card component
function LinkedContentCard({
  materials,
  linkedTest,
}: {
  materials: Array<{ materialId: string; title: string }>;
  linkedTest: { testId: string; title: string } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.teacher.tests.detail.linkedContent.title}</CardTitle>
        <CardDescription>{t.teacher.tests.detail.linkedContent.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Materials Section */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">{t.teacher.tests.detail.linkedContent.materials}</h3>
          {materials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground-secondary">
              {t.teacher.tests.detail.linkedContent.noMaterials}
            </div>
          ) : (
            <div className="space-y-2">
              {materials.map((material) => (
                <div key={material.materialId} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
                  <FileText className="h-4 w-4 text-foreground-secondary" />
                  <Link href={`/teacher/materials/${material.materialId}`} className="text-primary hover:underline text-sm font-medium">
                    {material.title}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tests Section */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">{t.teacher.tests.detail.linkedContent.tests}</h3>
          {!linkedTest ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground-secondary">
              {t.teacher.tests.detail.linkedContent.noTests}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
              <ClipboardList className="h-4 w-4 text-foreground-secondary" />
              <Link href={`/teacher/tests/${linkedTest.testId}/edit`} className="text-primary hover:underline text-sm font-medium">
                {linkedTest.title}
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Publications card component
function PublicationsCard({ publications }: { publications: Publication[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.teacher.tests.detail.publications.title}</CardTitle>
            <CardDescription>{t.teacher.tests.detail.publications.description}</CardDescription>
          </div>
          <Badge variant="primary" size="sm">{t.teacher.tests.detail.publications.count(publications.length)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {publications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={t.teacher.tests.detail.publications.notPublished}
              description={t.teacher.tests.detail.publications.notPublishedDescription}
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow noHover>
                <TableHead>{t.teacher.tests.detail.publications.headers.publication}</TableHead>
                <TableHead>{t.teacher.tests.detail.publications.headers.classes}</TableHead>
                <TableHead>{t.teacher.tests.detail.publications.headers.deadline}</TableHead>
                <TableHead>{t.teacher.tests.detail.publications.headers.published}</TableHead>
                <TableHead>{t.teacher.tests.detail.publications.headers.action}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {publications.map((publication) => (
                <TableRow key={publication.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {publication.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" size="sm">{t.teacher.tests.detail.publications.classCount(publication.classCount)}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground-secondary">
                      {publication.defaultDeadline
                        ? new Date(publication.defaultDeadline).toLocaleDateString()
                        : t.teacher.tests.detail.publications.noDeadline}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground-secondary">
                      {new Date(publication.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/teacher/publications/${publication.id}/gradebook`}>
                        {t.teacher.tests.detail.publications.gradebook}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Stats card component
function StatsCard({ 
  materialCount, 
  testCount, 
  publicationCount 
}: { 
  materialCount: number; 
  testCount: number; 
  publicationCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.teacher.tests.detail.stats.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{materialCount}</p>
            <p className="text-sm text-foreground-secondary">{t.teacher.tests.detail.stats.materials(materialCount)}</p>
          </div>
          <div className="rounded-xl bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{testCount}</p>
            <p className="text-sm text-foreground-secondary">{t.teacher.tests.detail.stats.tests(testCount)}</p>
          </div>
          <div className="rounded-xl bg-surface p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{publicationCount}</p>
            <p className="text-sm text-foreground-secondary">{t.teacher.tests.detail.stats.publications(publicationCount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Page component
export default async function TeacherAssignmentDetailPage({
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
  let publications: Publication[] = [];

  try {
    const [templateDetail, assignmentPublications] = await Promise.all([
      getTeacherAssignmentTemplateDetail(session.userId, templateId),
      listTeacherAssignmentPublications(session.userId, { templateId, pageSize: 100 }),
    ]);
    template = templateDetail;
    publications = assignmentPublications.map((publication) => ({
      id: publication.publicationId,
      title: publication.templateTitle ?? t.teacher.tests.detail.errors.untitledPublication,
      templateId: publication.templateId,
      classCount: publication.classCount,
      defaultDeadline: publication.defaultDeadline,
      createdAt: publication.createdAt,
    }));
  } catch {
    notFound();
  }

  if (!template) {
    notFound();
  }

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
          <Link href="/teacher/assignments">{t.teacher.tests.detail.back}</Link>
        </Button>
      </div>

      {/* Error Alert */}
      {error ? (
        <StatusAlert tone="error" className="rounded-xl">{error}</StatusAlert>
      ) : null}

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CardTitle className="text-h1">{template.title}</CardTitle>
                <StatusChip
                  status={template.status === "active" ? "success" : template.status === "archived" ? "info" : "warning"}
                  size="sm"
                >
                  {template.status === "active" ? t.teacher.tests.detail.status.active : template.status === "archived" ? t.teacher.tests.detail.status.archived : t.teacher.tests.detail.status.draft}
                </StatusChip>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/teacher/assignments/${templateId}/publish`}>
                  {t.teacher.tests.detail.actions.publishToClasses}
                </Link>
              </Button>
              {template.status !== "archived" && (
                <form action={archiveTemplateAction}>
                  <input type="hidden" name="templateId" value={templateId} />
                  <Button type="submit" variant="ghost" size="sm" leftIcon={<Archive className="h-4 w-4" />}>
                    {t.teacher.tests.detail.actions.archive}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          {template.description && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">{t.teacher.tests.detail.descriptionLabel}</h3>
              <p className="text-body text-foreground-secondary">{template.description}</p>
            </div>
          )}

          {/* Practice/Test flags */}
          <div className="flex flex-wrap gap-2">
            {template.hasPractice && (
              <Badge variant="info" size="sm">{t.teacher.tests.detail.practice}</Badge>
            )}
            {template.hasTest && (
              <Badge variant="primary" size="sm">{t.teacher.tests.detail.test}</Badge>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-foreground-secondary">
            <div className="flex items-center gap-1">
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
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span>{t.teacher.tests.detail.created(new Date(template.createdAt).toLocaleDateString())}</span>
            </div>
            <div className="flex items-center gap-1">
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
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{t.teacher.tests.detail.updated(new Date(template.updatedAt).toLocaleDateString())}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <StatsCard 
        materialCount={template.materialIds.length} 
        testCount={template.linkedTestId ? 1 : 0}
        publicationCount={publications.length}
      />

      {/* Linked Content */}
      <LinkedContentCard 
        materials={template.materials}
        linkedTest={template.linkedTest}
      />

      {/* Publications */}
      <PublicationsCard publications={publications} />
    </section>
  );
}
