import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, School, Search, User } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiGet } from "@/lib/api/server-fetch";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SchoolLibraryMaterial {
  materialId: string;
  title: string;
  description: string | null;
  organizationName: string;
  ownerTeacherId: string;
  ownerTeacherName: string | null;
  approvedAt: string;
}

/**
 * Material card component for school library materials
 */
function SchoolMaterialCard({ material }: { material: SchoolLibraryMaterial }) {
  return (
    <Card elevation="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{material.title}</CardTitle>
            <CardDescription>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Added by {material.ownerTeacherName ?? "Unknown"}
              </span>
            </CardDescription>
          </div>
          <StatusChip status="success" label="Approved" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-body text-foreground-secondary">
          {material.description ?? "No description provided."}
        </p>

        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-foreground-secondary">Organization</dt>
            <dd className="font-medium text-foreground">{material.organizationName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-foreground-secondary">Approved</dt>
            <dd className="font-medium text-foreground">
              {new Date(material.approvedAt).toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-foreground-secondary">Material ID</dt>
            <dd className="font-mono text-xs text-foreground-secondary">{material.materialId}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export default async function TeacherSchoolMaterialsPage() {
  const session = await requireAreaAccess("teacher");

  // Fetch data from API
  interface OrganizationItem {
    organizationId: string;
    name: string;
    slug: string;
    role: string;
    status: string;
  }

  interface SchoolMaterial {
    materialId: string;
    title: string;
    description: string | null;
    organizationName: string;
    ownerTeacherId: string;
    ownerTeacherName: string | null;
    approvedAt: string;
  }

  const [orgData, materials] = await Promise.all([
    apiGet<{ organizationId: string; organizationName: string }>("/api/v1/teacher/organizations/selected"),
    apiGet<SchoolMaterial[]>("/api/v1/teacher/materials/library"),
  ]);

  const selectedOrgName = orgData?.organizationName ?? "your school";
  const selectedOrgId = orgData?.organizationId;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground-secondary uppercase tracking-wider">
            <School className="w-4 h-4" />
            School Library
          </div>
          <CardTitle className="text-h1">Approved School Materials</CardTitle>
          <CardDescription>
            Browse and use materials that have been approved for{" "}
            <strong className="text-foreground">{selectedOrgName}</strong>.
            These materials have been reviewed by school administrators and are ready for classroom use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/teacher/materials">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to personal materials
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/teacher/library">
                <BookOpen className="mr-1 h-4 w-4" />
                Library overview
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-success-subtle/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">{materials.length}</div>
            <div className="text-sm text-foreground-secondary">
              {materials.length === 1 ? "Approved Material" : "Approved Materials"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary-subtle/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">
              {new Set(materials.map(m => m.ownerTeacherId)).size}
            </div>
            <div className="text-sm text-foreground-secondary">Contributing Teachers</div>
          </CardContent>
        </Card>
        <Card className="bg-info-subtle/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">{selectedOrgName}</div>
            <div className="text-sm text-foreground-secondary">Organization</div>
          </CardContent>
        </Card>
      </div>

      {/* Materials List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-foreground">Available Materials</h2>
          {materials.length > 0 && (
            <Badge variant="success" size="md">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {materials.length} approved
            </Badge>
          )}
        </div>

        {materials.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<School className="w-6 h-6" />}
                title="No approved materials yet"
                description={`There are no approved school materials available for ${selectedOrgName} at this time. Check back later or contact your school administrator.`}
                action={
                  <Button asChild variant="primary">
                    <Link href="/teacher/materials">Create Personal Material</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Cards View */}
            <div className="grid gap-4">
              {materials.map((material) => (
                <SchoolMaterialCard key={material.materialId} material={material} />
              ))}
            </div>

            {/* Table View */}
            <Card>
              <CardHeader>
                <CardTitle>Materials Directory</CardTitle>
                <CardDescription>Complete list of approved school materials</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((material) => (
                      <TableRow key={material.materialId}>
                        <TableCell className="font-medium">{material.title}</TableCell>
                        <TableCell className="text-foreground-secondary">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {material.ownerTeacherName}
                          </span>
                        </TableCell>
                        <TableCell className="text-foreground-secondary">
                          {new Date(material.approvedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-foreground-secondary max-w-xs truncate">
                          {material.description ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-info-subtle/30">
        <CardHeader>
          <CardTitle className="text-h3">About School Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-body text-foreground-secondary">
          <p>
            School materials have been reviewed and approved by administrators for use across your organization.
            These materials are:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Quality-checked by school administrators</li>
            <li>Available to all teachers in {selectedOrgName}</li>
            <li>Ready for use in assignments and lesson plans</li>
            <li>Regularly updated by contributing teachers</li>
          </ul>
          <p className="mt-4">
            Want to contribute? Create a personal material and submit it for approval from your{" "}
            <Link href="/teacher/materials" className="text-primary hover:underline">
              personal materials page
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
