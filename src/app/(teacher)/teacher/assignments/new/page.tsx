import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";
import {
  getTeacherSelectedOrganization,
  getTeacherAssignmentTemplateCreateOptions,
  type TeacherSelectedOrganization,
  type TeacherAssignmentTemplateCreateOptions,
} from "@/modules/teachers/server-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Types — use shared types from server-data

// Organization info card
function OrganizationInfoCard({ organizationName }: { organizationName: string }) {
  return (
    <Card className="bg-primary-subtle/30">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-foreground-secondary">Creating in organization</p>
          <p className="font-medium text-foreground">{organizationName}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Material selection component
function MaterialSelection({ materials }: { materials: Array<{ id: string; title: string }> }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">Link Materials</h3>
        <p className="text-sm text-foreground-secondary">
          Select materials to attach to this assignment template
        </p>
      </div>
      
      {materials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground-secondary">
          No materials available in the active organization.
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((material) => (
            <label 
              key={material.id} 
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
            >
              <input 
                type="checkbox" 
                name="materialId" 
                value={material.id}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{material.title}</span>
                  </div>
                </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Test selection component
function TestSelection({ tests }: { tests: Array<{ id: string; title: string }> }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">Link a Test</h3>
        <p className="text-sm text-foreground-secondary">
          Select a test to include in this assignment template
        </p>
      </div>
      
      {tests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground-secondary">
          No tests available in the active organization.
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test) => (
            <label 
              key={test.id} 
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
            >
              <input 
                type="radio" 
                name="linkedTestId" 
                value={test.id}
                className="mt-1 h-4 w-4 rounded-full border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{test.title}</span>
                  </div>
                </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Server action to create assignment template
async function createAssignmentTemplateAction(formData: FormData) {
  "use server";
  
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const instructions = formData.get("instructions") as string;
  const hasPractice = formData.get("hasPractice") === "on";
  const materialIds = formData.getAll("materialId") as string[];
  const linkedTestId = formData.get("linkedTestId") as string | null;
  
  // Append instructions to description since DB has no dedicated instructions column
  const fullDescription = [description, instructions ? `\n\nStudent Instructions:\n${instructions}` : null]
    .filter(Boolean)
    .join("\n")
    .trim() || undefined;
  
  try {
    await apiPost("/api/v1/teacher/assignment-templates", {
      title,
      description: fullDescription,
      hasPractice,
      hasTest: !!linkedTestId,
      materialIds,
      linkedTestId: linkedTestId || undefined,
    });

    revalidatePath("/teacher/assignments");
    redirect("/teacher/assignments?created=true");
  } catch (error) {
    console.error("[assignments/new] Failed to create assignment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create assignment template";
    redirect(`/teacher/assignments/new?error=${encodeURIComponent(errorMessage)}`);
  }
}

// Page component
export default async function TeacherNewAssignmentPage() {
  const session = await requireAreaAccess("teacher");
  
  // Fetch data directly from Supabase (no internal HTTP round-trip)
  let selectedOrganization: TeacherSelectedOrganization | null = null;
  let createOptions: TeacherAssignmentTemplateCreateOptions | null = null;
  
  try {
    selectedOrganization = await getTeacherSelectedOrganization(session.userId);
  } catch {
    selectedOrganization = null;
  }
  
  if (selectedOrganization?.organizationId) {
    try {
      createOptions = await getTeacherAssignmentTemplateCreateOptions(session.userId);
    } catch {
      createOptions = null;
    }
  }

  // No organization selected - show empty state
  if (!selectedOrganization?.organizationId || !createOptions) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-6">
        {/* Back Navigation */}
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" leftIcon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          }>
            <Link href="/teacher/assignments">Back to Templates</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-8">
            <EmptyState
              title="Select an organization"
              description="Select an approved organization before creating assignment templates."
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              action={
                <Button asChild variant="secondary">
                  <Link href="/teacher/organizations">Go to Organizations</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" leftIcon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        }>
          <Link href="/teacher/assignments">Back to Templates</Link>
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Create Assignment Template</CardTitle>
          <CardDescription>
            Create a reusable assignment template with linked materials and tests
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Organization Info */}
      <OrganizationInfoCard organizationName={createOptions.organizationName ?? selectedOrganization.organizationName ?? "Unknown"} />

      {/* Form */}
      <form action={createAssignmentTemplateAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label="Title"
              htmlFor="title"
              hint="A clear, descriptive title for this assignment"
              required
            >
              <Input
                id="title"
                name="title"
                type="text"
                placeholder="e.g., Week 3: Introduction to Algebra"
                required
                minLength={3}
              />
            </FormField>

            <FormField
              label="Description"
              htmlFor="description"
              hint="Brief summary for the template library (optional)"
            >
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the purpose and scope of this assignment..."
                rows={3}
              />
            </FormField>

            <FormField
              label="Student Instructions"
              htmlFor="instructions"
              hint="Detailed instructions that students will see (optional)"
            >
              <Textarea
                id="instructions"
                name="instructions"
                placeholder="Provide clear instructions for students including deliverables, expectations, and grading criteria..."
                rows={5}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Configuration</CardTitle>
            <CardDescription>
              Link materials and tests to this assignment template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted">
              <input 
                type="checkbox" 
                name="hasPractice" 
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <span className="font-medium text-foreground">Includes Practice</span>
                <p className="text-sm text-foreground-secondary">Students will complete a practice submission before the test</p>
              </div>
            </label>
            <MaterialSelection materials={createOptions.materials} />
            <div className="border-t border-border" />
            <TestSelection tests={createOptions.tests} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="secondary">
            <Link href="/teacher/assignments">Cancel</Link>
          </Button>
          <Button type="submit">
            Create Template
          </Button>
        </div>
      </form>
    </section>
  );
}
