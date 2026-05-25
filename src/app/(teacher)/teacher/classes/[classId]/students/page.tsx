import Link from "next/link";
import { notFound } from "next/navigation";

import { t } from "@/lib/translations";
import {
  Users,
  ArrowLeft,
  GraduationCap,
  UserPlus,
  Calendar,
  Hash,
  Mail,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  getTeacherClassDetail,
  listTeacherClassStudents,
  type TeacherClassDetail,
  type TeacherClassRosterStudentSummary,
} from "@/modules/teachers/server-data";

type ClassRosterStudent = TeacherClassRosterStudentSummary;
type ClassDetail = TeacherClassDetail;

import { AddStudentForm, ImportCSVForm } from "./AddStudentForms";

function getStudentDisplayName(student: ClassRosterStudent): string {
  return student.displayName || [student.firstName, student.lastName].filter(Boolean).join(" ");
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
      return t.teacher.classes.roster.sources.selfJoined;
    case "bulk_import":
      return t.teacher.classes.roster.sources.bulkImport;
    case "manual":
      return t.teacher.classes.roster.sources.manual;
    case "seeded":
      return t.teacher.classes.roster.sources.seeded;
    default:
      return source;
  }
}

export default async function ClassRosterPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const session = await requireAreaAccess("teacher");
  const { classId } = await params;

  let classDetail: ClassDetail | null = null;
  let roster: ClassRosterStudent[] = [];

  try {
    const [detail, students] = await Promise.all([
      getTeacherClassDetail(session.userId, classId),
      listTeacherClassStudents(session.userId, classId, { pageSize: 100, status: "active" }),
    ]);
    classDetail = detail;
    roster = students;
  } catch {
    notFound();
  }

  if (!classDetail) {
    notFound();
  }

  const displayedStudents = roster.length;
  const totalStudents = classDetail.studentCount;
  const activeJoinCode = classDetail.joinCode?.code ?? null;

  return (
    <section className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/teacher/classes/${classId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
Back to class
        </Link>
      </Button>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
              <h1 className="text-h1 font-bold text-foreground">{t.teacher.classes.roster.title}</h1>
              <p className="mt-1 text-body text-foreground-secondary">
                {classDetail.title} — {t.teacher.classes.roster.studentCount(totalStudents)}
              </p>
            </div>
            <Badge variant={classDetail.status === "active" ? "success" : "warning"} size="md">
              {classDetail.status}
            </Badge>
          </div>
        </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <AddStudentForm classId={classId} />
        <ImportCSVForm classId={classId} />
      </div>

      {/* Roster Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-foreground-secondary" />
            <CardTitle>{t.teacher.classes.roster.enrolledStudents}</CardTitle>
          </div>
          <CardDescription>
            {displayedStudents < totalStudents
              ? t.teacher.classes.roster.showingActive(displayedStudents, totalStudents)
              : t.teacher.classes.roster.allEnrolled}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-6 w-6" />}
              title={t.teacher.classes.roster.emptyTitle}
              description={t.teacher.classes.roster.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      {t.teacher.classes.roster.headers.student}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t.teacher.classes.roster.headers.login}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {t.teacher.classes.roster.headers.joined}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      {t.teacher.classes.roster.headers.source}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {roster.map((student) => (
                  <TableRow key={student.enrollmentId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-subtle">
                          <span className="text-sm font-medium text-primary">
                            {getStudentDisplayName(student).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{getStudentDisplayName(student)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {student.studentLogin}
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {formatDate(student.joinedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getSourceBadgeVariant(student.source)}
                        size="sm"
                      >
                        {getSourceLabel(student.source)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Join Code Reminder */}
      <Card elevation="sm" className="bg-primary-subtle/30">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-foreground-secondary">{t.teacher.classes.roster.joinCodeReminder.current}</p>
            {activeJoinCode ? (
              <code className="text-lg font-mono font-bold text-foreground">
                {activeJoinCode}
              </code>
            ) : (
              <p className="text-sm text-foreground-secondary">{t.teacher.classes.roster.joinCodeReminder.noActive}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/teacher/classes/${classId}/join-code`}>
              {t.teacher.classes.roster.joinCodeReminder.manage}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
