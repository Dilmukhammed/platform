import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  GraduationCap,
  Clock,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import {
  getStudentClassDetail,
  listStudentAssignmentsForClass,
  listStudentClassMaterials,
  type StudentAssignmentSummary,
  type StudentClassDetail as ClassDetail,
} from "@/modules/students/server-data";
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
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { t } from "@/lib/translations";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: "not_started" | "in_progress" | "submitted" | "reviewed" | "released";
}

function mapAssignments(assignments: StudentAssignmentSummary[]): Assignment[] {
  return assignments.map((assignment) => ({
    id: assignment.assignmentResultId,
    title: assignment.assignmentTitle,
    description: assignment.assignmentDescription,
    deadline: assignment.deadline,
    status: assignment.status,
  }));
}


function formatOptionalDate(dateString: string | null): string {
  return dateString ? formatDate(dateString) : t.student.assignments.deadline.noDeadline;
}

function getStatusVariant(status: string): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "active":
    case "submitted":
    case "reviewed":
    case "released":
      return "success";
    case "in_progress":
      return "primary";
    case "suspended":
      return "warning";
    case "left":
    case "not_started":
      return "default";
    default:
      return "default";
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "self_join":
      return t.student.classes.source.joinedByCode;
    case "manual":
      return t.student.classes.source.addedByTeacher;
    case "bulk_import":
      return t.student.classes.source.imported;
    default:
      return t.student.classes.source.joined;
  }
}

interface PageProps {
  params: Promise<{ classId: string }>;
}

export default async function StudentClassDetailPage({ params }: PageProps) {
  const session = await requireAreaAccess("student");

  const { classId } = await params;

  const [classDetail, assignmentRows, materials] = await Promise.all([
    getStudentClassDetail(session.userId, classId),
    listStudentAssignmentsForClass(session.userId, classId),
    listStudentClassMaterials(session.userId, classId, { verifyEnrollment: false }),
  ]);

  if (!classDetail) {
    notFound();
  }

  const assignments = mapAssignments(assignmentRows);

  const primaryTeacher = classDetail.teachers.find((t) => t.isPrimary);
  const otherTeachers = classDetail.teachers.filter((t) => !t.isPrimary);

  return (
    <section className="space-y-6">
      {/* Back Navigation */}
      <div>
<Button variant="ghost" size="sm" asChild>
          <Link href="/student/classes" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t.student.classes.detail.back}
          </Link>
        </Button>
      </div>

      {/* Class Header */}
      <div className="rounded-card border border-border bg-surface-raised p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-h1 font-bold text-foreground">
                {classDetail.title}
              </h1>
              <Badge variant={getStatusVariant(classDetail.status)} size="md">
                {classDetail.status}
              </Badge>
            </div>
            {classDetail.description && (
              <p className="mt-2 max-w-2xl text-body text-foreground-secondary">
                {classDetail.description}
              </p>
            )}
          </div>
        </div>

{/* Class Meta Info */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-container-sm bg-surface p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t.student.classes.detail.teacher}</p>
              <p className="text-sm text-foreground-secondary">
                {primaryTeacher?.displayName ||
                  classDetail.teachers[0]?.displayName ||
                  t.student.classes.detail.notAssigned}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-container-sm bg-surface p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t.student.classes.detail.students}</p>
              <p className="text-sm text-foreground-secondary">— {t.student.classes.detail.enrolled}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-container-sm bg-surface p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t.student.classes.detail.joined}</p>
              <p className="text-sm text-foreground-secondary">
                {formatDate(classDetail.joinedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-container-sm bg-surface p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t.student.classes.detail.enrollment}</p>
              <p className="text-sm text-foreground-secondary">
                {getSourceLabel(classDetail.source)}
              </p>
            </div>
          </div>
        </div>
      </div>

{/* Additional Teachers */}
      {otherTeachers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-h3">{t.student.classes.detail.additionalTeachers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {otherTeachers.map((teacher) => (
                <Badge key={teacher.id} variant="default" size="md">
                  {teacher.displayName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

{/* Materials Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-foreground-secondary" />
              <CardTitle className="text-h3">{t.student.classes.detail.materials.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {materials.length}
            </Badge>
          </div>
          <CardDescription>
            {t.student.classes.detail.materials.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {materials.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t.student.classes.detail.materials.emptyTitle}
              description={t.student.classes.detail.materials.emptyDescription}
            />
          ) : (
            <div className="space-y-3">
              {materials.map((material) => (
                <div
                  key={material.materialId}
                  className="flex items-start justify-between gap-4 rounded-container-sm border border-border bg-surface p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">
                        {material.title}
                      </h3>
                      {!material.isAvailable && (
                        <span className="flex items-center gap-1 text-sm text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t.student.classes.detail.materials.noLongerAvailable}
                        </span>
                      )}
                    </div>
                    {material.description && (
                      <p className="mt-1 text-sm text-foreground-secondary line-clamp-2">
                        {material.description}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {material.isAvailable ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`/api/v1/student/materials/${material.materialId}/download`}
                          className="inline-flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          {t.student.classes.detail.materials.download}
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                      >
                        <Download className="h-4 w-4" />
                        {t.student.classes.detail.materials.download}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

{/* Assignments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-foreground-secondary" />
              <CardTitle className="text-h3">{t.student.classes.detail.assignments.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {assignments.length}
            </Badge>
          </div>
          <CardDescription>
            {t.student.classes.detail.assignments.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={t.student.classes.detail.assignments.emptyTitle}
              description={t.student.classes.detail.assignments.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.student.classes.detail.assignments.headers.title}</TableHead>
                  <TableHead>{t.student.classes.detail.assignments.headers.deadline}</TableHead>
                  <TableHead>{t.student.classes.detail.assignments.headers.status}</TableHead>
                  <TableHead className="w-[96px]">{t.student.classes.detail.assignments.headers.action}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id} interactive>
                    <TableCell>
                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {assignment.title}
                      </Link>
                    </TableCell>
                    <TableCell>{formatOptionalDate(assignment.deadline)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(assignment.status)} size="sm">
                        {assignment.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/student/assignments/${assignment.id}`}>
                          {t.student.classes.detail.assignments.view}
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
    </section>
  );
}
