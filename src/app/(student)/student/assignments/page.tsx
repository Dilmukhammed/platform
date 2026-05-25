import Link from "next/link";
import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import {
  listStudentAssignments,
  type StudentAssignmentSummary as Assignment,
} from "@/modules/students/server-data";
import { AssignmentsListLoading } from "@/components/ui/assignments-list-loading";
import {
  DocumentStateIcon,
  EmptyStateCard,
  ErrorStateIcon,
} from "@/components/ui/empty-state-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Status configuration for UI mapping
const statusConfig: Record<
  Assignment["status"],
  { label: string; variant: "default" | "primary" | "success" | "warning" | "error" | "info"; statusType: "success" | "warning" | "error" | "info" }
> = {
  not_started: { label: t.student.assignments.status.notStarted, variant: "default", statusType: "info" },
  in_progress: { label: t.student.assignments.status.inProgress, variant: "warning", statusType: "warning" },
  submitted: { label: t.student.assignments.status.submitted, variant: "info", statusType: "info" },
  reviewed: { label: t.student.assignments.status.reviewed, variant: "primary", statusType: "success" },
  released: { label: t.student.assignments.status.released, variant: "success", statusType: "success" },
};

// Filter tabs configuration
const filterTabs = [
  { key: "all", label: t.student.assignments.filters.all },
  { key: "active", label: t.student.assignments.filters.active },
  { key: "overdue", label: t.student.assignments.filters.overdue },
  { key: "completed", label: t.student.assignments.filters.completed },
  { key: "reviewed", label: t.student.assignments.filters.reviewed },
] as const;

type FilterTab = (typeof filterTabs)[number]["key"];

// Helper to check if assignment is overdue
function isOverdue(assignment: Assignment): boolean {
  if (!assignment.deadline) return false;
  if (["submitted", "reviewed", "released"].includes(assignment.status)) return false;
  return new Date(assignment.deadline) < new Date();
}

// Helper to format deadline with countdown
function formatDeadline(deadline: string | null): { text: string; isUrgent: boolean } {
  if (!deadline) return { text: t.student.assignments.deadline.noDeadline, isUrgent: false };

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    return { text: t.student.assignments.deadline.overdueBy(Math.abs(diffDays)), isUrgent: true };
  }

  if (diffDays > 7) {
    return { text: t.student.assignments.deadline.dueDate(deadlineDate.toLocaleDateString()), isUrgent: false };
  }

  if (diffDays > 1) {
    return { text: t.student.assignments.deadline.dueInDays(diffDays), isUrgent: diffDays <= 2 };
  }

  if (diffHours > 1) {
    return { text: t.student.assignments.deadline.dueInHours(diffHours), isUrgent: true };
  }

  return { text: t.student.assignments.deadline.dueSoon, isUrgent: true };
}

// Filter assignments based on active tab
function filterAssignments(assignments: Assignment[], filter: FilterTab): Assignment[] {
  switch (filter) {
    case "active":
      return assignments.filter(
        (a) => ["not_started", "in_progress"].includes(a.status) && !isOverdue(a)
      );
    case "overdue":
      return assignments.filter((a) => isOverdue(a));
    case "completed":
      return assignments.filter((a) => ["submitted", "reviewed", "released"].includes(a.status));
    case "reviewed":
      return assignments.filter((a) => ["reviewed", "released"].includes(a.status));
    default:
      return assignments;
  }
}

// Fetch assignments from API
async function fetchAssignments(userId: string) {
  return listStudentAssignments(userId);
}

// Loading skeleton component
function AssignmentsLoading() {
  return <AssignmentsListLoading variant="student" filterCount={filterTabs.length} />;
}

// Error state component
function AssignmentsError({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <EmptyStateCard
      title={t.student.assignments.errors.loadFailed}
      description={error}
      icon={<ErrorStateIcon />}
      action={
        retry ? (
          <Button variant="secondary" onClick={retry}>
            {t.student.assignments.errors.tryAgain}
          </Button>
        ) : null
      }
    />
  );
}

// Empty state component
function AssignmentsEmpty({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; description: string }> = {
    all: {
      title: t.student.assignments.empty.all.title,
      description: t.student.assignments.empty.all.description,
    },
    active: {
      title: t.student.assignments.empty.active.title,
      description: t.student.assignments.empty.active.description,
    },
    overdue: {
      title: t.student.assignments.empty.overdue.title,
      description: t.student.assignments.empty.overdue.description,
    },
    completed: {
      title: t.student.assignments.empty.completed.title,
      description: t.student.assignments.empty.completed.description,
    },
    reviewed: {
      title: t.student.assignments.empty.reviewed.title,
      description: t.student.assignments.empty.reviewed.description,
    },
  };

  const message = messages[filter];

  return (
    <EmptyStateCard
      title={message.title}
      description={message.description}
      icon={<DocumentStateIcon />}
      action={
        <Button asChild>
          <Link href="/join">{t.student.assignments.empty.joinClass}</Link>
        </Button>
      }
    />
  );
}

// Assignment row component
function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const status = statusConfig[assignment.status];
  const deadline = formatDeadline(assignment.deadline);

  return (
    <TableRow interactive>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Link
            href={`/student/assignments/${assignment.assignmentResultId}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {assignment.assignmentTitle}
          </Link>
          <span className="text-sm text-foreground-secondary">
            {assignment.classTitle}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <StatusChip status={status.statusType} size="sm">
          {status.label}
        </StatusChip>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {assignment.hasTest && (
            <Badge variant="info" size="sm">
              {t.student.assignments.table.test}
            </Badge>
          )}
          {assignment.hasPractice && (
            <Badge variant="primary" size="sm">
              {t.student.assignments.table.practical}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className={deadline.isUrgent ? "text-error font-medium" : "text-foreground-secondary"}>
          {deadline.text}
        </span>
      </TableCell>
      <TableCell>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/student/assignments/${assignment.assignmentResultId}`}>
            {t.student.assignments.table.view}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Main assignments content component
async function AssignmentsContent({ filter }: { filter: FilterTab }) {
  const session = await requireAreaAccess("student");
  let assignments: Assignment[] = [];
  let error: string | null = null;

  try {
    const response = await fetchAssignments(session.userId);
    assignments = response.data;
  } catch (err) {
    if (err instanceof Error) {
      error = err.message;
    } else {
      error = t.student.assignments.errors.unexpected;
    }
  }

  if (error) {
    return <AssignmentsError error={error} />;
  }

  const filteredAssignments = filterAssignments(assignments, filter);

  if (filteredAssignments.length === 0) {
    return <AssignmentsEmpty filter={filter} />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow noHover>
              <TableHead>{t.student.assignments.table.headers.assignment}</TableHead>
              <TableHead>{t.student.assignments.table.headers.status}</TableHead>
              <TableHead>{t.student.assignments.table.headers.type}</TableHead>
              <TableHead>{t.student.assignments.table.headers.deadline}</TableHead>
              <TableHead>{t.student.assignments.table.headers.action}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.map((assignment) => (
              <AssignmentRow key={assignment.assignmentResultId} assignment={assignment} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Page component
export default async function StudentAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = (params?.filter as FilterTab) || "all";

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.student.assignments.title}</CardTitle>
          <CardDescription>
            {t.student.assignments.description}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <Button
              key={tab.key}
              asChild
              variant={isActive ? "primary" : "ghost"}
              size="sm"
            >
              <Link
                href={`/student/assignments?filter=${tab.key}`}
                scroll={false}
              >
                {tab.label}
              </Link>
            </Button>
          );
        })}
      </div>

      {/* Assignments List */}
      <Suspense fallback={<AssignmentsLoading />}>
        <AssignmentsContent filter={activeFilter} />
      </Suspense>
    </section>
  );
}
