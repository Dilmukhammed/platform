import Link from "next/link";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { notFound, redirect } from "next/navigation";

import { t } from "@/lib/translations";
import {
  Key,
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
} from "lucide-react";

import { apiGet, apiPost } from "@/lib/api/server-fetch";
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
import { CopyButton } from "./CopyButton";

interface JoinCodeHistoryEntry {
  joinCodeId: string;
  code: string;
  status: "active" | "revoked" | "expired";
  validFrom: string;
  validUntil: string | null;
  createdAt: string;
  rotatedAt: string | null;
}

interface ClassDetail {
  classId: string;
  title: string;
  joinCode: {
    joinCodeId: string;
    code: string;
    status: string;
    validFrom: string;
    validUntil: string | null;
  } | null;
}

interface JoinCodeResponse {
  classId: string;
  activeCode: JoinCodeHistoryEntry | null;
  history: JoinCodeHistoryEntry[];
}


function getStatusBadgeVariant(
  status: string
): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "expired":
      return "warning";
    case "revoked":
      return "error";
    default:
      return "default";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "active":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "expired":
      return <Clock className="h-4 w-4 text-warning" />;
    case "revoked":
      return <XCircle className="h-4 w-4 text-error" />;
    default:
      return null;
  }
}

interface SearchParams {
  rotated?: string;
  error?: string;
}

// Server action to rotate join code
async function rotateJoinCodeAction(formData: FormData) {
  "use server";
  
  const classId = formData.get("classId") as string;
  const redirectPath = formData.get("redirectPath") as string;
  
  try {
    await apiPost(`/api/v1/teacher/classes/${classId}/join-codes/rotate`, {});

    revalidatePath(redirectPath);
    redirect(`${redirectPath}?rotated=true`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[join-code] Failed to rotate join code:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to rotate join code";
    redirect(`${redirectPath}?error=${encodeURIComponent(errorMessage)}`);
  }
}

export default async function JoinCodeManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { classId } = await params;
  const query = (await searchParams) ?? {};

  const message = typeof query.rotated === "string" ? t.teacher.classes.joinCode.messages.rotated : null;
  const error = typeof query.error === "string" ? query.error : null;

  let classDetail: ClassDetail;
  let joinCodes: JoinCodeResponse;

  try {
    classDetail = await apiGet<ClassDetail>(`/api/v1/teacher/classes/${classId}`);
    joinCodes = await apiGet<JoinCodeResponse>(`/api/v1/teacher/classes/${classId}/join-codes`);
  } catch {
    notFound();
  }

  const activeJoinCode = joinCodes.activeCode ?? classDetail.joinCode;
  const joinCodeHistory = joinCodes.history;

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
        <h1 className="text-h1 font-bold text-foreground">{t.teacher.classes.joinCode.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">
          {t.teacher.classes.joinCode.description(classDetail.title)}
        </p>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="rounded-card border border-success bg-success-subtle p-4 text-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
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

      {/* Active Join Code Card */}
      <Card elevation="sm" className="border-primary-subtle">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle>{t.teacher.classes.joinCode.active.title}</CardTitle>
          </div>
          <CardDescription>
            {t.teacher.classes.joinCode.active.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-surface-muted p-6 sm:flex-row sm:justify-between">
            {activeJoinCode ? (
              <code className="text-4xl font-mono font-bold tracking-[0.2em] text-foreground">
                {activeJoinCode.code}
              </code>
            ) : (
              <p className="text-center text-sm text-foreground-secondary">
                {t.teacher.classes.joinCode.active.noActive}
              </p>
            )}
            <div className="flex gap-2">
              <CopyButton code={activeJoinCode?.code ?? ""} />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-info-subtle/50 p-4">
            <AlertCircle className="h-5 w-5 text-info mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">{t.teacher.classes.joinCode.active.howTitle}</p>
              <p className="text-foreground-secondary">
                {t.teacher.classes.joinCode.active.howDescription}
              </p>
            </div>
          </div>

          {/* Rotate Form */}
          <form action={rotateJoinCodeAction} className="pt-2">
            <input type="hidden" name="classId" value={classId} />
            <input
              type="hidden"
              name="redirectPath"
              value={`/teacher/classes/${classId}/join-code`}
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.teacher.classes.joinCode.active.rotate}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Rotation History */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-foreground-secondary" />
            <CardTitle>{t.teacher.classes.joinCode.history.title}</CardTitle>
          </div>
          <CardDescription>
            {t.teacher.classes.joinCode.history.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {joinCodeHistory.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title={t.teacher.classes.joinCode.history.emptyTitle}
              description={t.teacher.classes.joinCode.history.emptyDescription}
            />
          ) : (
            <div className="space-y-3">
              {joinCodeHistory.map((entry) => (
                <div
                  key={entry.joinCodeId}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted">
                      {getStatusIcon(entry.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-lg font-semibold text-foreground">
                          {entry.code}
                        </code>
                        <Badge variant={getStatusBadgeVariant(entry.status)} size="sm">
                          {entry.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground-secondary">
                        {t.teacher.classes.joinCode.history.created(formatDate(entry.createdAt))}
                      </p>
                      {entry.rotatedAt && (
                        <p className="text-xs text-foreground-muted">
                          {t.teacher.classes.joinCode.history.rotated(formatDate(entry.rotatedAt))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card elevation="sm" className="bg-surface-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-foreground-secondary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">{t.teacher.classes.joinCode.info.title}</p>
              <p className="text-foreground-secondary">
                {t.teacher.classes.joinCode.info.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
