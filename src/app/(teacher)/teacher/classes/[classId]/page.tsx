import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { t } from "@/lib/translations";
import {
  Users,
  ArrowLeft,
  BookOpen,
  FileText,
  Key,
  AlertCircle,
  ChevronRight,
  Calendar,
  Building2,
  Trash2,
  User,
  School,
  ClipboardList,
  GraduationCap,
} from "lucide-react";

import { EditClassModal } from "./edit-class-modal";
import { AddMaterialModal } from "./AddMaterialModal";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiGet, apiDelete } from "@/lib/api/server-fetch";
import type { PaginationMeta } from "@/lib/api/envelope";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface ClassDetail {
  classId: string;
  title: string;
  description: string | null;
  status: string;
  organization: {
    organizationId: string;
    name: string;
    slug: string;
  } | null;
  teacherRole: string;
  isPrimary: boolean;
  studentCount: number;
  joinCode: {
    joinCodeId: string;
    code: string;
    status: string;
    validFrom: string | null;
    validUntil: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ClassMaterial {
  classMaterialId: string;
  materialId: string;
  title: string;
  description: string | null;
  status: string;
  scopeType: string;
  ownerName: string | null;
  addedAt: string;
  isAvailable: boolean;
}

interface SearchParams {
  rotated?: string;
  error?: string;
  materialRemoved?: string;
}

interface PublicationClassTarget {
  publicationClassId: string;
  classId: string;
  deadlineOverride: string | null;
  effectiveDeadline: string | null;
  status: string;
}

interface AssignmentPublication {
  publicationId: string;
  templateId: string;
  templateTitle: string;
  hasPractice: boolean;
  hasTest: boolean;
  publishedByTeacherId: string;
  defaultDeadline: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  classCount: number;
  classTargets: PublicationClassTarget[];
}

interface AssignmentPublicationsApiResponse {
  data: AssignmentPublication[];
  meta: {
    pagination: PaginationMeta;
  };
}

async function getClassAssignments(classId: string): Promise<
  Array<{
    id: string;
    title: string;
    type: "test" | "practical";
    status: "draft" | "active" | "closed";
    dueDate: string | null;
    templateId: string;
  }>
> {
  try {
    const firstPage = await apiGet<AssignmentPublication[]>(
      "/api/v1/teacher/assignment-publications",
      { paginated: true, params: { classId } },
    ) as unknown as AssignmentPublicationsApiResponse;

    const totalPages = firstPage.meta.pagination.totalPages;

    const remainingPages = totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            apiGet<AssignmentPublication[]>(
              "/api/v1/teacher/assignment-publications",
              {
                paginated: true,
                params: { classId, page: String(index + 2) },
              },
            ) as unknown as Promise<AssignmentPublicationsApiResponse>
          ),
        )
      : [];

    const allPublications = [firstPage, ...remainingPages].flatMap(
      (response) => response.data,
    );

    return allPublications.map((pub) => {
      // Find the class target for this specific class
      const classTarget = pub.classTargets.find(
        (ct) => ct.classId === classId,
      );

      // Derive type from template flags
      const type: "test" | "practical" = pub.hasTest ? "test" : "practical";

      // Map publication status to UI status
      let status: "draft" | "active" | "closed";
      switch (pub.status) {
        case "published":
          status = "active";
          break;
        case "archived":
          status = "closed";
          break;
        default:
          status = "draft";
      }

      // Use the class-specific effective deadline if available
      const dueDate = classTarget?.effectiveDeadline ?? pub.defaultDeadline ?? null;

      return {
        id: pub.publicationId,
        title: pub.templateTitle,
        type,
        status,
        dueDate,
        templateId: pub.templateId,
      };
    });
  } catch (error) {
    console.error("[class-detail] Failed to fetch assignments:", error);
    return [];
  }
}

// Server action to remove material from class
async function removeMaterialAction(formData: FormData) {
  "use server";
  
  const classId = formData.get("classId") as string;
  const materialId = formData.get("materialId") as string;
  
  try {
    await apiDelete(`/api/v1/teacher/classes/${classId}/materials/${materialId}`);
    revalidatePath(`/teacher/classes/${classId}`);
    redirect(`/teacher/classes/${classId}?materialRemoved=true`);
  } catch (error) {
    console.error("[class-materials] Remove error:", error);
    const errorMsg = error instanceof Error ? error.message : "Failed to remove material";
    redirect(`/teacher/classes/${classId}?error=${encodeURIComponent(errorMsg)}`);
  }
}

export default async function TeacherClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireAreaAccess("teacher");
  const { classId } = await params;
  const query = (await searchParams) ?? {};

  const message = typeof query.rotated === "string" ? "Join code rotated. Older code remains in history." : null;
  const error = typeof query.error === "string" ? query.error : null;
  const materialRemoved = typeof query.materialRemoved === "string" ? "Material removed from class." : null;

  // Parallel fetch all data - all 3 use classId directly, no inter-dependencies
  const [classDetailResult, materialsResult, assignmentsResult] = await Promise.allSettled([
    apiGet<ClassDetail>(`/api/v1/teacher/classes/${classId}`),
    apiGet<{ data: ClassMaterial[] }>(`/api/v1/teacher/classes/${classId}/materials`),
    getClassAssignments(classId),
  ]);

  // Handle classDetail result (required - page cannot render without it)
  if (classDetailResult.status === "rejected") {
    notFound();
  }
  const classDetail = classDetailResult.value;

  // Handle materials result (optional - default to empty on failure)
  const materials = materialsResult.status === "fulfilled" ? materialsResult.value.data : [];

  // Handle assignments result (optional - default to empty on failure)
  const assignments = assignmentsResult.status === "fulfilled" ? assignmentsResult.value : [];

  return (
    <section className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/teacher/classes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to classes
        </Link>
      </Button>

      {/* Alert Messages */}
      {message && (
        <div className="rounded-card border border-success bg-success-subtle p-4 text-success">
          <div className="flex items-center gap-2">
            <span className="font-medium">{message}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {materialRemoved && (
        <div className="rounded-card border border-success bg-success-subtle p-4 text-success">
          <div className="flex items-center gap-2">
            <span className="font-medium">{materialRemoved}</span>
          </div>
        </div>
      )}

      {/* Class Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold text-foreground">{classDetail.title}</h1>
            <p className="mt-1 text-body text-foreground-secondary">
              {classDetail.description ?? t.teacher.classes.detail.noDescription}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="success" size="md">
              {classDetail.status}
            </Badge>
            {(classDetail.isPrimary || classDetail.teacherRole === "owner") && (
              <EditClassModal
                classId={classDetail.classId}
                initialTitle={classDetail.title}
                initialDescription={classDetail.description}
                initialStatus={classDetail.status}
              />
            )}
          </div>
        </div>
      </div>

      {/* Meta Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.classes.detail.stats.organization}</p>
              <p className="font-medium text-foreground">{classDetail.organization?.name ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.classes.detail.stats.students}</p>
              <p className="font-medium text-foreground">{classDetail.studentCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.classes.detail.stats.created}</p>
              <p className="font-medium text-foreground">
                {new Date(classDetail.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.classes.detail.stats.joinCode}</p>
              <code className="font-mono font-medium text-foreground">{classDetail.joinCode?.code ?? "—"}</code>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href={`/teacher/classes/${classId}/students`}>
            <Users className="mr-2 h-4 w-4" />
            {t.teacher.classes.detail.actions.viewRoster}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/teacher/classes/${classId}/join-code`}>
            <Key className="mr-2 h-4 w-4" />
            {t.teacher.classes.detail.actions.manageJoinCode}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/teacher/gradebook?classId=${classId}`}>
            <GraduationCap className="mr-2 h-4 w-4" />
            {t.teacher.classes.detail.actions.gradebook}
          </Link>
        </Button>
      </div>

      {/* Assignments Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.classes.detail.assignments.title}</CardTitle>
            </div>
            <Button size="sm" asChild>
              <Link href={`/teacher/assignments/new?classId=${classId}`}>
                {t.teacher.classes.detail.assignments.createAssignment}
              </Link>
            </Button>
          </div>
          <CardDescription>{t.teacher.classes.detail.assignments.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={t.teacher.classes.detail.assignments.emptyTitle}
              description={t.teacher.classes.detail.assignments.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.classes.detail.assignments.headers.title}</TableHead>
                  <TableHead>{t.teacher.classes.detail.assignments.headers.type}</TableHead>
                  <TableHead>{t.teacher.classes.detail.assignments.headers.status}</TableHead>
                  <TableHead>{t.teacher.classes.detail.assignments.headers.dueDate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Link href={`/teacher/assignments/${assignment.templateId}`} className="text-primary hover:underline">
                          {assignment.title}
                        </Link>
                        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                          <Link href={`/teacher/publications/${assignment.id}/gradebook`}>
                            <ClipboardList className="h-3.5 w-3.5" />
                            <span className="sr-only">{t.teacher.classes.detail.assignments.gradebookSrOnly}</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.type === "test" ? "info" : "primary"} size="sm">
                        {assignment.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          assignment.status === "active"
                            ? "success"
                            : assignment.status === "draft"
                              ? "warning"
                              : "default"
                        }
                        size="sm"
                      >
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {assignment.dueDate
                        ? new Date(assignment.dueDate).toLocaleDateString("en-US")
                        : t.teacher.classes.detail.assignments.noDueDate}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Materials Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.classes.detail.materials.title}</CardTitle>
            </div>
            <AddMaterialModal classId={classId} />
          </div>
          <CardDescription>{t.teacher.classes.detail.materials.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t.teacher.classes.detail.materials.emptyTitle}
              description={t.teacher.classes.detail.materials.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.classes.detail.materials.headers.title}</TableHead>
                  <TableHead>{t.teacher.classes.detail.materials.headers.owner}</TableHead>
                  <TableHead>{t.teacher.classes.detail.materials.headers.scope}</TableHead>
                  <TableHead>{t.teacher.classes.detail.materials.headers.added}</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => (
                  <TableRow key={material.classMaterialId}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link href={`/teacher/materials/${material.materialId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                          {material.title}
                        </Link>
                        {!material.isAvailable && (
                          <span className="ml-2 text-error text-sm">{t.teacher.classes.detail.materials.deleted}</span>
                        )}
                        {material.description && (
                          <span className="text-sm text-foreground-secondary line-clamp-1">
                            {material.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-foreground-secondary">
                        {material.scopeType === "personal" ? (
                          <User className="h-3.5 w-3.5" />
                        ) : (
                          <School className="h-3.5 w-3.5" />
                        )}
                        <span>{material.ownerName ?? t.teacher.classes.detail.materials.unknownOwner}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={material.scopeType === "organization" ? "primary" : "default"} 
                        size="sm"
                      >
                        {material.scopeType === "organization" ? t.teacher.classes.detail.materials.schoolLibrary : t.teacher.classes.detail.materials.personal}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {new Date(material.addedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <form action={removeMaterialAction} className="inline">
                        <input type="hidden" name="classId" value={classId} />
                        <input type="hidden" name="materialId" value={material.materialId} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-foreground-secondary hover:text-error hover:bg-error-subtle"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Join Code Preview Card */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-foreground-secondary" />
            <CardTitle>{t.teacher.classes.detail.joinCodeCard.title}</CardTitle>
          </div>
          <CardDescription>{t.teacher.classes.detail.joinCodeCard.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <code className="rounded-lg bg-surface-muted px-4 py-3 text-2xl font-mono font-bold tracking-wider text-foreground">
              {classDetail.joinCode?.code ?? "—"}
            </code>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/teacher/classes/${classId}/join-code`}>
                  {t.teacher.classes.detail.joinCodeCard.manage}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
