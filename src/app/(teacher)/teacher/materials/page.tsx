import Link from "next/link";
import { ArrowLeft, BookOpen, Library, Plus, School } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusAlert } from "@/components/ui/status-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { submitMaterialToSchoolAction } from "@/modules/materials/actions";
import {
  getTeacherSelectedOrganization,
  listTeacherMaterials,
  type TeacherMaterialSummary,
  type TeacherSelectedOrganization,
} from "@/modules/teachers/server-data";
import { MaterialUploadForm } from "./MaterialUploadForm";
import { MaterialCard } from "./MaterialCard";
import { getStatusChipProps } from "./status-helpers";

const MATERIALS_PAGE_SIZE = 20;

export default async function TeacherMaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

  // Fetch directly on the server to avoid a full server-component -> API -> Supabase round-trip.
  const [selectedOrganization, materialsResult] = await Promise.all([
    getTeacherSelectedOrganization(session.userId),
    listTeacherMaterials(session.userId, { page }),
  ]);
  const materials = materialsResult.materials;
  const total = materialsResult.total;
  const totalPages = Math.ceil(total / MATERIALS_PAGE_SIZE);

  const message = typeof params.created === "string"
    ? t.teacher.materials.alerts.created
    : typeof params.submitted === "string"
      ? t.teacher.materials.alerts.submitted
      : typeof params.deleted === "string"
        ? t.teacher.materials.alerts.deleted
      : null;
  const error = typeof params.error === "string" ? params.error : null;

  // Calculate stats
  const draftCount = materials.filter(m => m.reviewState === "none" && m.status === "draft").length;
  const pendingCount = materials.filter(m => m.reviewState === "pending").length;
  const approvedCount = materials.filter(m => m.reviewState === "approved").length;
  const rejectedCount = materials.filter(m => m.reviewState === "rejected").length;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-secondary uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            {t.teacher.materials.title}
          </div>
          <CardTitle className="text-h1">{t.teacher.materials.libraryTitle}</CardTitle>
          <CardDescription>
            {t.teacher.materials.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">
              {selectedOrganization?.organizationName
                ? t.teacher.materials.activeOrganization(selectedOrganization.organizationName)
                : t.teacher.materials.notSelected}
            </Badge>
            <Button asChild variant="secondary" size="sm">
              <Link href="/teacher/library/school/materials">
                <School className="w-4 h-4 mr-1" />
                {t.teacher.materials.viewSchoolMaterials}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert Messages */}
      {message ? <StatusAlert tone="success" className="text-foreground">{message}</StatusAlert> : null}
      {error ? <StatusAlert tone="error">{error}</StatusAlert> : null}

      {/* Stats Overview */}
      {materials.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-primary-subtle/30">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">{draftCount}</div>
              <div className="text-sm text-foreground-secondary">{t.teacher.materials.stats.draft}</div>
            </CardContent>
          </Card>
          <Card className="bg-warning-subtle/30">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">{pendingCount}</div>
              <div className="text-sm text-foreground-secondary">{t.teacher.materials.stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="bg-success-subtle/30">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">{approvedCount}</div>
              <div className="text-sm text-foreground-secondary">{t.teacher.materials.stats.approved}</div>
            </CardContent>
          </Card>
          <Card className="bg-error-subtle/30">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-foreground">{rejectedCount}</div>
              <div className="text-sm text-foreground-secondary">{t.teacher.materials.stats.rejected}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Material Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t.teacher.materials.create.title}</CardTitle>
          <CardDescription>
            {t.teacher.materials.create.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MaterialUploadForm />
        </CardContent>
      </Card>

      {/* Materials List */}
      <div className="space-y-4">
        <h2 className="text-h3 font-semibold text-foreground">{t.teacher.materials.list.title}</h2>

        {materials.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Library className="w-6 h-6" />}
                title={t.teacher.materials.list.emptyTitle}
                description={t.teacher.materials.list.emptyDescription}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {materials.map((material) => (
               <MaterialCard 
                 key={material.materialId} 
                 material={material} 
                 selectedOrganizationId={selectedOrganization?.organizationId ?? null}
                 currentTeacherId={session.userId}
                 onSubmitToSchool={submitMaterialToSchoolAction}
               />
            ))}
          </div>
        )}
      </div>

      {/* Materials Table View (for detailed overview) */}
      {materials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.teacher.materials.overview.title}</CardTitle>
            <CardDescription>{t.teacher.materials.overview.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.materials.overview.headers.title}</TableHead>
                  <TableHead>{t.teacher.materials.overview.headers.status}</TableHead>
                  <TableHead>{t.teacher.materials.overview.headers.updated}</TableHead>
                  <TableHead>{t.teacher.materials.overview.headers.schoolVisible}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => {
                   const statusProps = getStatusChipProps(material);
                   return (
                    <TableRow key={material.materialId}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/teacher/materials/${material.materialId}`}
                            className="transition-colors hover:text-primary"
                          >
                            {material.title}
                          </Link>
                        </TableCell>
                       <TableCell>
                         <StatusChip status={statusProps.status} label={statusProps.label} size="sm" />
                       </TableCell>
                       <TableCell className="text-foreground-secondary">
                         {new Date(material.updatedAt).toLocaleDateString()}
                       </TableCell>
<TableCell>
                          {material.schoolVisible ? (
                             <Badge variant="success" size="sm">{t.teacher.materials.overview.yes}</Badge>
                           ) : (
                             <Badge variant="default" size="sm">{t.teacher.materials.overview.no}</Badge>
                           )}
                         </TableCell>
                     </TableRow>
                   );
                 })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground-secondary">
            {t.teacher.materials.overview.showing(materials.length, total)}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/teacher/materials?page=${page - 1}`}
                className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {t.teacher.materials.overview.previous}
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                {t.teacher.materials.overview.previous}
              </span>
            )}
            <span className="text-sm text-foreground-secondary px-2">
              {t.teacher.materials.overview.pageOf(page, totalPages)}
            </span>
            {page < totalPages ? (
              <Link
                href={`/teacher/materials?page=${page + 1}`}
                className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {t.teacher.materials.overview.next}
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                {t.teacher.materials.overview.next}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
