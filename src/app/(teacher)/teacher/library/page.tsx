import Link from "next/link";
import { BookOpen, ChevronRight, Library, School, User } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiGet } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface Material {
  id: string;
  title: string;
  description: string | null;
  ownerTeacherName: string;
  approvedAt: string;
}

interface SelectedOrganization {
  organizationId: string;
  organizationName: string;
}

/**
 * Navigation card component for library sections
 */
function LibraryNavCard({
  title,
  description,
  href,
  icon: Icon,
  count,
  countLabel,
  variant = "default",
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  count?: number;
  countLabel?: string;
  variant?: "default" | "primary" | "success";
}) {
  const variantStyles = {
    default: "bg-surface-raised",
    primary: "bg-primary-subtle/30",
    success: "bg-success-subtle/30",
  };

  return (
    <Card
      elevation="sm"
      className={`${variantStyles[variant]} transition-all duration-fast hover:shadow-md`}
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted">
            <Icon className="h-5 w-5 text-foreground-secondary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-h3">{title}</CardTitle>
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {count !== undefined && countLabel && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant={variant === "success" ? "success" : "info"} size="md">
              {count}
            </Badge>
            <span className="text-sm text-foreground-secondary">{countLabel}</span>
          </div>
        )}
        <Button asChild variant="secondary" className="w-full">
          <Link href={href}>
            {t.teacher.library.open(title)}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function TeacherLibraryPage() {
  const session = await requireAreaAccess("teacher");
  
  let selectedOrganization: SelectedOrganization | null = null;
  let schoolMaterials: Material[] = [];

  try {
    [selectedOrganization, schoolMaterials] = await Promise.all([
      apiGet<SelectedOrganization | null>("/api/v1/teacher/organizations/selected"),
      apiGet<Material[]>("/api/v1/teacher/materials/library"),
    ]);
  } catch {
    // New teacher without organization — show empty state gracefully
  }

  const hasOrganization = !!selectedOrganization;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-secondary uppercase tracking-wider">
            <Library className="w-4 h-4" />
            {t.teacher.library.title}
          </div>
          <CardTitle className="text-h1">{t.teacher.library.overview}</CardTitle>
          <CardDescription>
            {t.teacher.library.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasOrganization ? (
            <Badge variant="primary" size="md">
              <School className="w-3 h-3 mr-1" />
              {selectedOrganization!.organizationName}
            </Badge>
          ) : (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/50 px-4 py-3 text-sm text-foreground-secondary">
              {t.teacher.library.noOrganizationSelected}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      {hasOrganization ? (
        <div className="grid gap-4 md:grid-cols-2">
          {/* School Materials Card */}
          <LibraryNavCard
            title={t.teacher.library.schoolMaterials.title}
            description={t.teacher.library.schoolMaterials.description(selectedOrganization!.organizationName)}
            href="/teacher/library/school/materials"
            icon={School}
            count={schoolMaterials.length}
            countLabel={t.teacher.library.schoolMaterials.countLabel(schoolMaterials.length)}
            variant="success"
          />

          {/* Personal Materials Card */}
          <LibraryNavCard
            title={t.teacher.library.personalMaterials.title}
            description={t.teacher.library.personalMaterials.description}
            href="/teacher/materials"
            icon={BookOpen}
            variant="primary"
          />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<School className="w-6 h-6" />}
              title={t.teacher.library.organizationRequired.title}
              description={t.teacher.library.organizationRequired.description}
              action={
                <Button asChild variant="primary">
                  <Link href="/teacher">{t.teacher.library.organizationRequired.action}</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Quick Links Section */}
      {hasOrganization && (
        <Card>
          <CardHeader>
            <CardTitle>{t.teacher.library.quickActions.title}</CardTitle>
            <CardDescription>{t.teacher.library.quickActions.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/teacher/materials">
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t.teacher.library.quickActions.createMaterial}
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/teacher/library/school/materials">
                  <School className="mr-2 h-4 w-4" />
                  {t.teacher.library.quickActions.browseSchoolLibrary}
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/teacher/assignments">
                  <Library className="mr-2 h-4 w-4" />
                  {t.teacher.library.quickActions.viewAssignments}
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="justify-start">
                <Link href="/teacher">
                  <User className="mr-2 h-4 w-4" />
                  {t.teacher.library.quickActions.backToDashboard}
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-info-subtle/30">
        <CardHeader>
          <CardTitle className="text-h3">{t.teacher.library.about.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-body text-foreground-secondary">
          <p>
            {t.teacher.library.about.intro}
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t.teacher.library.about.points.p1}</li>
            <li>{t.teacher.library.about.points.p2}</li>
            <li>{t.teacher.library.about.points.p3}</li>
            <li>{t.teacher.library.about.points.p4}</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
