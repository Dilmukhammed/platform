import Link from "next/link";
import { Users, BookOpen, ArrowRight, GraduationCap, Plus, AlertCircle } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import { createServerClient } from "@/lib/supabase/server-client";
import { t } from "@/lib/translations";
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
import { getTeacherSelectedOrganization, listTeacherClasses } from "@/modules/teachers/server-data";

interface TeacherClass {
  classTeacherId: string;
  classId: string;
  title: string;
  description: string | null;
  status: string;
  organizationId: string;
  role: string;
  isPrimary: boolean;
  createdAt: string;
}

interface ClassWithDetails extends TeacherClass {
  activeAssignmentsCount: number;
}


interface SearchParams {
  created?: string;
  error?: string;
}

export default async function TeacherClassesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireAreaAccess("teacher");
  const params = (await searchParams) ?? {};
  const selectedOrganization = await getTeacherSelectedOrganization(session.userId);

  const message = typeof params.created === "string" ? t.teacher.classes.messages.created : null;
  const error = typeof params.error === "string" ? params.error : null;

  let classes: ClassWithDetails[] = [];
  let fetchError: string | null = null;

  if (selectedOrganization.organizationId) {
    try {
      const rawClasses = await listTeacherClasses(session.userId, {
        organizationId: selectedOrganization.organizationId,
      });

      // Fetch active assignment counts for all classes in one query
      const classIds = rawClasses.map((cls) => cls.classId);
      let assignmentCounts: Map<string, number> = new Map();

      if (classIds.length > 0) {
        const supabase = createServerClient();
        const { data: counts, error: countError } = await supabase
          .from("assignment_publications")
          .select("class_id")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null);

        if (!countError && counts) {
          for (const row of counts) {
            const cid = row.class_id as string;
            assignmentCounts.set(cid, (assignmentCounts.get(cid) ?? 0) + 1);
          }
        }
      }

      classes = rawClasses.map((cls) => ({
        ...cls,
        activeAssignmentsCount: assignmentCounts.get(cls.classId) ?? 0,
      }));
    } catch (err) {
      console.error("[classes] Failed to load classes:", err);
      fetchError = err instanceof Error ? err.message : "Failed to load classes";
    }
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">{t.teacher.classes.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">
          {t.teacher.classes.description}
        </p>
      </div>

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

      {/* No Organization Selected */}
      {!selectedOrganization.organizationId && (
        <Card elevation="sm">
          <CardContent className="py-8">
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title={t.teacher.classes.messages.noOrganizationSelected}
              description={t.teacher.classes.messages.noOrganizationDescription}
              action={
                <Button asChild>
                  <Link href="/teacher/organizations">{t.teacher.classes.messages.goToOrganizations}</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Fetch Error */}
      {selectedOrganization.organizationId && fetchError && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{fetchError}</span>
          </div>
        </div>
      )}

      {/* Empty State - No Classes */}
      {selectedOrganization.organizationId && !fetchError && classes.length === 0 && (
        <Card elevation="sm">
          <CardContent className="py-8">
            <EmptyState
              icon={<GraduationCap className="h-6 w-6" />}
              title={t.teacher.classes.messages.emptyTitle}
              description={t.teacher.classes.messages.emptyDescription}
              action={
                <Button asChild>
                  <Link href="/teacher/classes/new">{t.teacher.classes.actions.createClass}</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Classes Grid */}
      {selectedOrganization.organizationId && !fetchError && classes.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-secondary">
                {t.teacher.classes.counts.classes(classes.length)}
              </span>
              <Badge variant="success" size="sm">
                {selectedOrganization.organizationName}
              </Badge>
            </div>
            <Button asChild>
              <Link href="/teacher/classes/new">
                <Plus className="mr-2 h-4 w-4" />
                {t.teacher.classes.actions.createClass}
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <Link
                key={cls.classId}
                href={`/teacher/classes/${cls.classId}`}
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
                      <Badge variant="success" size="sm">
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
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-foreground-secondary">
                        <BookOpen className="h-4 w-4 shrink-0" />
                        <span>{t.teacher.classes.counts.assignments(cls.activeAssignmentsCount || 0)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground-secondary">
                        <Users className="h-4 w-4 shrink-0" />
                        <span>{cls.role}</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="justify-between border-t border-border pt-4">
                    <span className="text-sm text-foreground-secondary">
                      {t.teacher.classes.card.created(formatDate(cls.createdAt))}
                    </span>
                    <ArrowRight className="h-4 w-4 text-foreground-secondary" />
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
