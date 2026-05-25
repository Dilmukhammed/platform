import Link from "next/link";
import { notFound } from "next/navigation";
import { t } from "@/lib/translations";
import {
  Users,
  Search,
  GraduationCap,
  Upload,
  UserPlus,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
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
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { AddStudentModal } from "./add-student-modal";
import {
  getTeacherSelectedOrganization,
  listTeacherClasses,
  listTeacherStudents,
} from "@/modules/teachers/server-data";

interface StudentEnrollment {
  enrollmentId: string;
  studentProfileId: string;
  studentLogin: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  displayName: string;
  studentStatus: string;
  enrollmentStatus: string;
  classId: string;
  className: string;
  joinedAt: string;
  leftAt: string | null;
  source: string;
}

interface GroupedStudent {
  studentProfileId: string;
  studentLogin: string;
  firstName: string;
  lastName: string;
  displayName: string;
  classCount: number;
  classes: Array<{
    classId: string;
    className: string;
    joinedAt: string;
    source: string;
  }>;
  earliestJoinedAt: string;
}

interface SelectedOrganization {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}

interface TeacherClass {
  classId: string;
  title: string;
}


function getSourceBadgeVariant(
  source: string
): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (source) {
    case "self_join":
      return "success";
    case "bulk_import":
      return "primary";
    case "manual":
      return "info";
    case "seeded":
      return "default";
    default:
      return "default";
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "self_join":
      return t.teacher.students.sources.selfJoined;
    case "bulk_import":
      return t.teacher.students.sources.import;
    case "manual":
      return t.teacher.students.sources.manual;
    case "seeded":
      return t.teacher.students.sources.seeded;
    default:
      return source;
  }
}

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const currentPage = Number(typeof params.page === "string" ? params.page : "1") || 1;
  const pageSize = 20;
  
  // Fetch organization and students in parallel
  let enrollments: StudentEnrollment[] = [];
  let totalStudents = 0;
  let fetchError: string | null = null;
  let selectedOrganization: SelectedOrganization = { organizationId: "", organizationName: "", organizationSlug: "" };

  try {
    const [orgResult, studentsResult] = await Promise.all([
      getTeacherSelectedOrganization(session.userId),
      listTeacherStudents(session.userId, { page: currentPage, pageSize }),
    ]);
    selectedOrganization = orgResult as SelectedOrganization;
    enrollments = studentsResult.students;
    totalStudents = studentsResult.total;
  } catch (error) {
    console.error("[students] Failed to load students:", error);
    fetchError = error instanceof Error ? error.message : "Failed to load data";
  }

  // Parse filter and search from URL params
  const filter = typeof params.filter === "string" ? params.filter : "all";
  const searchQuery = typeof params.search === "string" ? params.search.toLowerCase() : "";

  // Parse success/error messages from URL params
  const createdMessage =
    typeof params.created === "string" && typeof params.student === "string" && typeof params.login === "string"
      ? `${params.student} was created with login ${params.login}${typeof params.className === "string" ? ` and enrolled in ${params.className}` : ""}.`
      : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const importedMessage = typeof params.imported === "string" ? "Students imported successfully." : null;

// If no organization selected, show empty state
  if (!selectedOrganization.organizationId) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-h1 font-bold text-foreground">{t.teacher.students.title}</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            {t.teacher.students.description}
          </p>
        </div>

        <Card elevation="sm">
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title={t.teacher.students.noOrganization.title}
            description={t.teacher.students.noOrganization.description}
            action={
              <Button asChild>
                <Link href="/teacher/organizations">{t.teacher.students.noOrganization.action}</Link>
              </Button>
            }
          />
        </Card>
      </section>
    );
  }

  // Fetch classes for the add student modal (depends on orgId)
  let classes: TeacherClass[] = [];
  try {
    classes = (await listTeacherClasses(session.userId, {
      organizationId: selectedOrganization.organizationId,
    })).map((c) => ({ classId: c.classId, title: c.title }));
  } catch {
    classes = [];
  }

  // Group enrollments by student to build student-centric view
  const studentMap = new Map<string, StudentEnrollment[]>();
  for (const e of enrollments) {
    const existing = studentMap.get(e.studentProfileId) ?? [];
    existing.push(e);
    studentMap.set(e.studentProfileId, existing);
  }

  const students: GroupedStudent[] = Array.from(studentMap.entries()).map(
    ([profileId, enrList]) => {
      const first = enrList[0];
      return {
        studentProfileId: profileId,
        studentLogin: first.studentLogin,
        firstName: first.firstName,
        lastName: first.lastName,
        displayName: first.displayName,
        classCount: enrList.length,
        classes: enrList.map((e) => ({
          classId: e.classId,
          className: e.className,
          joinedAt: e.joinedAt,
          source: e.source,
        })),
        earliestJoinedAt: enrList.reduce(
          (min, e) => (e.joinedAt < min ? e.joinedAt : min),
          enrList[0].joinedAt
        ),
      };
    }
  );

  // Apply filters
  let filteredStudents = students;
  
  if (filter === "with-classes") {
    filteredStudents = students.filter((s) => s.classCount > 0);
  } else if (filter === "without-classes") {
    filteredStudents = students.filter((s) => s.classCount === 0);
  }
  
  // Apply search
  if (searchQuery) {
    filteredStudents = filteredStudents.filter(
      (s) =>
        s.displayName.toLowerCase().includes(searchQuery) ||
        s.studentLogin.toLowerCase().includes(searchQuery) ||
        s.firstName.toLowerCase().includes(searchQuery) ||
        s.lastName.toLowerCase().includes(searchQuery)
    );
  }

  return (
    <section className="space-y-6">
{/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-foreground">{t.teacher.students.title}</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            {t.teacher.students.headerCount(selectedOrganization.organizationName, students.length)}
          </p>
        </div>
        <Badge variant="primary" size="md">
          {selectedOrganization.organizationSlug}
        </Badge>
      </div>

{/* Alerts */}
      {createdMessage && (
        <StatusAlert
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          className="rounded-card bg-success-subtle/30"
        >
          <p className="font-medium">{t.teacher.students.alerts.studentCreated}</p>
          <p className="text-sm opacity-90">{createdMessage}</p>
        </StatusAlert>
      )}

      {importedMessage && (
        <StatusAlert
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          className="rounded-card bg-success-subtle/30"
        >
          <p className="font-medium">{t.teacher.students.alerts.importComplete}</p>
          <p className="text-sm opacity-90">{importedMessage}</p>
        </StatusAlert>
      )}
      
      {errorMessage && (
        <StatusAlert
          tone="error"
          icon={<XCircle className="h-5 w-5" />}
          className="rounded-card bg-error-subtle/30"
        >
          <p className="font-medium">{t.teacher.students.alerts.error}</p>
          <p className="text-sm opacity-90">{errorMessage}</p>
        </StatusAlert>
      )}
      
      {/* Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <form className="relative w-full sm:w-80" action="/teacher/students" method="GET">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-secondary" />
<Input
            name="search"
            placeholder={t.teacher.students.searchPlaceholder}
            defaultValue={searchQuery}
            className="pl-10"
          />
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        </form>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
<Button asChild variant="secondary">
            <Link href="/teacher/students/import">
              <Upload className="mr-2 h-4 w-4" />
              {t.teacher.students.actions.importCsv}
            </Link>
          </Button>
          <AddStudentModal classes={classes} organizationSlug={selectedOrganization.organizationSlug ?? ""} />
        </div>
      </div>

{/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {[
          { key: "all", label: t.teacher.students.filters.all, count: students.length },
          { key: "with-classes", label: t.teacher.students.filters.withClasses, count: students.filter((s) => s.classCount > 0).length },
          { key: "without-classes", label: t.teacher.students.filters.withoutClasses, count: students.filter((s) => s.classCount === 0).length },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={`/teacher/students?filter=${tab.key}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              filter === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-foreground-secondary hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs">
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

{/* Error State */}
      {fetchError && (
        <Card elevation="sm" className="border-error-subtle">
          <EmptyState
            icon={<AlertCircle className="h-6 w-6 text-error" />}
            title={t.teacher.students.loadError.title}
            description={fetchError}
          />
        </Card>
      )}

      {/* Students Table */}
      {!fetchError && (
        <Card elevation="sm">
<CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.students.profiles.title}</CardTitle>
            </div>
            <CardDescription>
              {totalStudents > pageSize
                ? t.teacher.students.profiles.showingPage(currentPage, Math.ceil(totalStudents / pageSize), totalStudents)
                : t.teacher.students.profiles.allInOrganization(totalStudents)}
            </CardDescription>
          </CardHeader>
          <CardContent>
{filteredStudents.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="h-6 w-6" />}
                title={totalStudents === 0 ? t.teacher.students.profiles.emptyTitle : t.teacher.students.profiles.noMatchTitle}
                description={
                  totalStudents === 0
                    ? t.teacher.students.profiles.emptyDescription
                    : t.teacher.students.profiles.noMatchDescription
                }
                action={
                  totalStudents === 0 ? (
                    <div className="flex gap-3">
                      <Button asChild variant="secondary">
                        <Link href="/teacher/students/import">
                          <Upload className="mr-2 h-4 w-4" />
                          {t.teacher.students.actions.importCsv}
                        </Link>
                      </Button>
                    </div>
                  ) : null
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        {t.teacher.students.profiles.headers.student}
                      </div>
                    </TableHead>
                    <TableHead>{t.teacher.students.profiles.headers.login}</TableHead>
                    <TableHead>{t.teacher.students.profiles.headers.classes}</TableHead>
                    <TableHead>{t.teacher.students.profiles.headers.created}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.studentProfileId} interactive>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-subtle">
                            <span className="text-sm font-medium text-primary">
                              {student.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{student.displayName}</p>
                            <p className="text-xs text-foreground-secondary">
                              {student.firstName} {student.lastName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground-secondary">
                        {student.studentLogin}
                      </TableCell>
                      <TableCell>
                        {student.classCount === 0 ? (
                          <span className="text-sm text-foreground-secondary">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {student.classes.slice(0, 3).map((cls) => (
                              <Badge
                                key={cls.classId}
                                variant={getSourceBadgeVariant(cls.source)}
                                size="sm"
                              >
                                {cls.className}
                              </Badge>
                            ))}
                            {student.classes.length > 3 && (
                              <Badge variant="default" size="sm">
                                +{student.classes.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {formatDate(student.earliestJoinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Pagination */}
          {totalStudents > pageSize && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <p className="text-sm text-foreground-secondary">
                {t.teacher.students.profiles.pageOf(currentPage, Math.ceil(totalStudents / pageSize))}
              </p>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/teacher/students?page=${currentPage - 1}${filter !== "all" ? `&filter=${filter}` : ""}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`}>
                      {t.teacher.students.profiles.previous}
                    </Link>
                  </Button>
                )}
                {currentPage * pageSize < totalStudents && (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/teacher/students?page=${currentPage + 1}${filter !== "all" ? `&filter=${filter}` : ""}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`}>
                      {t.teacher.students.profiles.next}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Import Help Card */}
      <Card elevation="sm" className="bg-primary-subtle/30 border-primary-subtle">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Upload className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t.teacher.students.bulkImport.title}</p>
              <p className="text-sm text-foreground-secondary">
                {t.teacher.students.bulkImport.description}
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-2 -ml-2">
                <Link href="/teacher/students/import">
                  {t.teacher.students.bulkImport.goToImport}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
