import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Users, GraduationCap, Calendar, CheckCircle, Clock, Mail } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminOrganizationDetail } from "@/modules/admins/server-data";

interface AdminOrganizationDetailPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function AdminOrganizationDetailPage({
  params,
}: AdminOrganizationDetailPageProps) {
  await requireAreaAccess("admin");

  const { organizationId } = await params;
  
  const organization = await getAdminOrganizationDetail(organizationId);
  
  if (!organization) {
    notFound();
  }

  // Calculate stats
  const teacherIds = new Set(organization.members.map((m) => m.teacherId));
  const totalStudents = organization.classes.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />} asChild>
          <Link href="/admin/organizations">
            {t.admin.organizationDetail.backToOrganizations}
          </Link>
        </Button>
      </div>

      {/* Organization Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle/30">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
                  {t.admin.organizationDetail.organizationDetail}
                </p>
                <CardTitle className="mt-1 text-h1">{organization.name}</CardTitle>
              </div>
            </div>
            {organization.status === "active" ? (
              <StatusChip status="success" size="md">
                {t.admin.organizationDetail.active}
              </StatusChip>
            ) : (
              <StatusChip status="warning" size="md">
                {t.admin.organizationDetail.pendingApproval}
              </StatusChip>
            )}
          </div>
          <CardDescription className="mt-4 max-w-3xl">
            {t.admin.organizationDetail.organizationSlug}: <code className="rounded bg-surface px-1.5 py-0.5 text-sm">{organization.slug}</code>
            <br />
            ID: <code className="rounded bg-surface px-1.5 py-0.5 text-sm">{organization.id}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="default" size="md">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              {t.admin.organizationDetail.members(organization.members.length)}
            </Badge>
            <Badge variant="info" size="md">
              <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
              {t.admin.organizationDetail.teachers(teacherIds.size)}
            </Badge>
            <Badge variant="primary" size="md">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              {t.admin.organizationDetail.classes(organization.classes.length)}
            </Badge>
            <Badge variant="success" size="md">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              {t.admin.organizationDetail.students(totalStudents)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Organization Timeline */}
      <Card elevation="sm">
        <CardHeader>
          <CardTitle>{t.admin.organizationDetail.timeline}</CardTitle>
          <CardDescription>{t.admin.organizationDetail.timelineDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg bg-surface p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle/30">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">{t.admin.organizationDetail.created}</p>
                <p className="font-medium text-foreground">
                  {new Date(organization.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-foreground-secondary">
                  {new Date(organization.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {organization.approvedAt ? (
              <div className="flex items-center gap-3 rounded-lg bg-success-subtle/20 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle/50">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-foreground-secondary">{t.admin.organizationDetail.approved}</p>
                  <p className="font-medium text-foreground">
                    {new Date(organization.approvedAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-foreground-secondary">
                    {new Date(organization.approvedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-warning-subtle/20 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-subtle/50">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-foreground-secondary">{t.admin.organizationDetail.status}</p>
                  <p className="font-medium text-foreground">{t.admin.organizationDetail.awaitingApproval}</p>
                  <p className="text-xs text-foreground-secondary">{t.admin.organizationDetail.notYetApproved}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-lg bg-info-subtle/20 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-subtle/50">
                <Users className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">{t.admin.organizationDetail.createdBy}</p>
                <p className="font-medium text-foreground">
                  {organization.createdByTeacherName}
                </p>
                <p className="text-xs text-foreground-secondary">{t.admin.organizationDetail.teacherId(organization.createdByTeacherId)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: Members and Classes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Members Section */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                  {t.admin.organizationDetail.organizationMembers}
                </p>
                <CardTitle className="mt-2">{t.admin.organizationDetail.teacherMemberships}</CardTitle>
              </div>
              <Badge variant="default" size="md">
                {t.admin.organizationDetail.members(organization.members.length)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {organization.members.length > 0 ? (
              <div className="space-y-3">
                {organization.members.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle/20">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{membership.teacherName}</p>
                        <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{membership.teacherEmail}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={membership.role === "owner" ? "primary" : "default"} size="sm">
                        {membership.role}
                      </Badge>
                      <StatusChip
                        status={membership.status === "active" ? "success" : "warning"}
                        size="sm"
                      >
                        {membership.status}
                      </StatusChip>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={t.admin.organizationDetail.noMembersYet}
                description={t.admin.organizationDetail.noTeacherMemberships}
              />
            )}
          </CardContent>
        </Card>

        {/* Classes Section */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                  {t.admin.organizationDetail.organizationClasses}
                </p>
                <CardTitle className="mt-2">{t.admin.organizationDetail.classesInOrganization}</CardTitle>
              </div>
              <Badge variant="default" size="md">
                {t.admin.organizationDetail.classes(organization.classes.length)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {organization.classes.length > 0 ? (
              <div className="space-y-3">
                {organization.classes.map((classItem) => (
                  <div
                    key={classItem.id}
                    className="rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{classItem.name}</p>
                        <p className="mt-1 text-sm text-foreground-secondary">
                          {`Oʻqituvchi: ${classItem.teacherName}`}
                        </p>
                      </div>
                      <Badge variant="info" size="sm">
                        {t.admin.organizationDetail.enrolled(classItem.enrollmentCount)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-foreground-secondary">
                      {classItem.description || t.admin.organizationDetail.noDescriptionProvided}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-foreground-secondary">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{t.admin.organizationDetail.updated(new Date(classItem.updatedAt).toLocaleDateString())}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<GraduationCap className="h-6 w-6" />}
                title={t.admin.organizationDetail.noClassesYet}
                description={t.admin.organizationDetail.noClassesCreated}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Classes Table (Full Width) */}
      {organization.classes.length > 0 && (
        <Card elevation="sm">
          <CardHeader>
            <CardTitle>{t.admin.organizationDetail.classesDirectory}</CardTitle>
            <CardDescription>{t.admin.organizationDetail.completeListOfClasses}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.organizationDetail.className}</TableHead>
                  <TableHead>{t.admin.organizationDetail.teacher}</TableHead>
                  <TableHead>{t.admin.organizationDetail.studentsLabel}</TableHead>
                  <TableHead>{t.admin.organizationDetail.status}</TableHead>
                  <TableHead>{t.admin.organizationDetail.lastUpdated}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organization.classes.map((classItem) => (
                  <TableRow key={classItem.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{classItem.name}</p>
                      <p className="text-sm text-foreground-secondary">{classItem.id}</p>
                    </TableCell>
                    <TableCell>{classItem.teacherName}</TableCell>
                    <TableCell>
                      <Badge variant="info" size="sm">
                        {t.admin.organizationDetail.enrolled(classItem.enrollmentCount)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={classItem.status === "active" ? "success" : "warning"} size="sm">
                        {classItem.status}
                      </StatusChip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground-secondary">
                        {new Date(classItem.updatedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
