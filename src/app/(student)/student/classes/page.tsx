import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import { t } from "@/lib/translations";
import {
  listStudentClasses,
  type StudentClassSummary as StudentClass,
} from "@/modules/students/server-data";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";


function getStatusVariant(status: string): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "inactive":
      return "warning";
    case "left":
      return "default";
    case "archived":
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

export default async function StudentClassesPage() {
  const session = await requireAreaAccess("student");

  let classes: StudentClass[] = [];
let error: string | null = null;

  try {
    const response = await listStudentClasses(session.userId);
    classes = response.data;
  } catch (err) {
    error = err instanceof Error ? err.message : t.student.classes.emptyDescription;
  }

  const activeClasses = classes.filter((c) => c.status === "active");

  return (
    <section className="space-y-6">
{/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">{t.student.classes.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">
          {t.student.classes.description}
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          {error}
        </div>
      )}

{/* Empty State */}
      {!error && activeClasses.length === 0 && (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title={t.student.classes.emptyTitle}
          description={t.student.classes.emptyDescription}
          action={
            <Button asChild>
              <Link href="/join">{t.student.classes.enterClassCode}</Link>
            </Button>
          }
        />
      )}

      {/* Classes Grid */}
      {!error && activeClasses.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeClasses.map((cls) => (
              <Link
                key={cls.classId}
                href={`/student/classes/${cls.classId}`}
                className="block"
              >
                <Card
                  interactive
                  elevation="sm"
                  className="h-full transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-1">{cls.title}</CardTitle>
                      <Badge variant={getStatusVariant(cls.status)} size="sm">
                        {cls.status}
                      </Badge>
                    </div>
                    {cls.description && (
                      <CardDescription className="line-clamp-2">
                        {cls.description}
                      </CardDescription>
                    )}
                  </CardHeader>

<CardContent>
                    <p className="text-sm text-foreground-secondary">
                      {t.student.classes.enrollment(getSourceLabel(cls.source))}
                    </p>
                  </CardContent>

<CardFooter className="justify-between border-t border-border pt-4">
                    <span className="text-sm text-foreground-secondary">
                      {t.student.classes.joined(formatDate(cls.joinedAt))}
                    </span>
                    <ArrowRight className="h-4 w-4 text-foreground-secondary" />
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>

{/* Join Class CTA */}
          <div className="flex justify-center pt-4">
            <Button variant="secondary" asChild>
              <Link href="/join">{t.student.classes.joinAnother}</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
