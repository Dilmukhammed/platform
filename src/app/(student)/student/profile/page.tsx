import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import {
  getStudentProfile,
  listStudentClasses,
  type StudentClassSummary as ClassMembership,
  type StudentProfileSummary as StudentProfile,
} from "@/modules/students/server-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User, School, Calendar, BookOpen, GraduationCap } from "lucide-react";

const statusVariants: Record<string, "default" | "primary" | "success" | "warning" | "error" | "info"> = {
  active: "success",
  left: "default",
  suspended: "warning",
};

const sourceLabels: Record<string, string> = {
  self_join: t.student.profile.classMemberships.source.selfJoin,
  manual: t.student.profile.classMemberships.source.manualCreate,
  bulk_import: t.student.profile.classMemberships.source.bulkImport,
};

export default async function StudentProfilePage() {
  const session = await requireAreaAccess("student");
  const [profileResult, classesResult] = await Promise.allSettled([
    getStudentProfile(session.userId),
    listStudentClasses(session.userId),
  ]);

  const profile: StudentProfile | null =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  const classes: ClassMembership[] =
    classesResult.status === "fulfilled" ? classesResult.value.data : [];

  if (!profile) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t.student.profile.title}</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {t.student.profile.description}
          </p>
        </div>
        <Card>
          <CardContent>
            <EmptyState
              icon={<User className="h-6 w-6" />}
              title={t.student.profile.notFound.title}
              description={t.student.profile.notFound.description}
            />
          </CardContent>
        </Card>
      </section>
    );
  }

  const activeClasses = classes.filter((c) => c.status === "active");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.student.profile.title}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {t.student.profile.description}
        </p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t.student.profile.personalInformation.title}
          </CardTitle>
          <CardDescription>{t.student.profile.personalInformation.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-secondary">{t.student.profile.personalInformation.displayName}</p>
              <p className="text-base font-semibold text-foreground">{profile.displayName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-secondary">{t.student.profile.personalInformation.studentLogin}</p>
              <p className="text-base font-semibold text-foreground">{profile.studentLogin}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-secondary">{t.student.profile.personalInformation.fullName}</p>
              <p className="text-base text-foreground">
                {profile.lastName} {profile.firstName}
                {profile.middleName && ` ${profile.middleName}`}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-secondary">{t.student.profile.personalInformation.status}</p>
              <Badge variant={profile.status === "active" ? "success" : "default"} size="sm">
                {profile.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground-secondary">{t.student.profile.personalInformation.memberSince}</p>
              <p className="text-sm text-foreground">
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Memberships Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            {t.student.profile.classMemberships.title}
          </CardTitle>
          <CardDescription>
            {t.student.profile.classMemberships.description(activeClasses.length)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={t.student.profile.classMemberships.emptyTitle}
              description={t.student.profile.classMemberships.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.student.profile.classMemberships.headers.class}</TableHead>
                  <TableHead>{t.student.profile.classMemberships.headers.status}</TableHead>
                  <TableHead>{t.student.profile.classMemberships.headers.joined}</TableHead>
                  <TableHead>{t.student.profile.classMemberships.headers.source}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((classMembership) => (
                  <TableRow key={classMembership.enrollmentId}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{classMembership.title}</p>
                        {classMembership.description && (
                          <p className="text-xs text-foreground-secondary line-clamp-1">
                            {classMembership.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariants[classMembership.status] ?? "default"}
                        size="sm"
                      >
                        {classMembership.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground-secondary">
                        {new Date(classMembership.joinedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground-secondary">
                        {sourceLabels[classMembership.source] ?? classMembership.source}
                      </span>
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
