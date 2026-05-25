"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { t } from "@/lib/translations";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

// Error types for class code validation
type JoinErrorType = "invalid" | "expired" | "revoked" | "generic";

interface JoinError {
  type: JoinErrorType;
  message: string;
  hint: string;
}

// Success result from join API
type JoinOutcome = "joined" | "already_enrolled" | "previous_enrollment";

interface JoinSuccessResult {
  enrollmentId: string;
  classId: string;
  classTitle: string;
  status: string;
  joinedAt: string | null;
  assignmentResultsCreated: number;
  joinOutcome: JoinOutcome;
}

// Error response from API
interface ApiError {
  code: string;
  message: string;
}

// Join state machine
type JoinState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "error"; error: JoinError }
  | { status: "success"; result: JoinSuccessResult }
  | { status: "redirecting_to_auth"; returnUrl: string };

// Sanitize returnUrl to prevent open redirects
function sanitizeReturnUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("..")) return null;
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.origin !== "http://localhost") return null;
    const path = parsed.pathname;
    if (!path.startsWith("/")) return null;
    const localUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (localUrl.includes("//")) return null;
    return localUrl;
  } catch {
    return null;
  }
}

// Cookie helper for preserving join intent
const JOIN_INTENT_COOKIE = "join_intent_code";
const COOKIE_MAX_AGE = 60 * 60; // 1 hour

function setJoinIntentCookie(code: string) {
  document.cookie = `${JOIN_INTENT_COOKIE}=${code}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function getJoinIntentCookie(): string | null {
  const match = document.cookie.match(new RegExp(`${JOIN_INTENT_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

function clearJoinIntentCookie() {
  document.cookie = `${JOIN_INTENT_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// Parse API error to join error
function parseJoinError(apiError: ApiError): JoinError {
  const message = apiError.message.toLowerCase();

  if (message.includes("expired") || apiError.code === "FORBIDDEN") {
    return {
      type: "expired",
      message: t.public.join.errors.expiredTitle,
      hint: t.public.join.errors.expiredHint,
    };
  }

  if (message.includes("revoked") || message.includes("inactive")) {
    return {
      type: "revoked",
      message: t.public.join.errors.revokedTitle,
      hint: t.public.join.errors.revokedHint,
    };
  }

  if (message.includes("not found") || message.includes("invalid") || apiError.code === "RESOURCE_NOT_FOUND") {
    return {
      type: "invalid",
      message: t.public.join.errors.invalidTitle,
      hint: t.public.join.errors.invalidHint,
    };
  }

  return {
    type: "generic",
    message: apiError.message || t.public.join.errors.genericTitle,
    hint: t.public.join.errors.genericHint,
  };
}

// Check if user is authenticated as student
async function checkStudentAuth(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/student/profile");
    return response.ok;
  } catch {
    return false;
  }
}

// Join class via API
async function joinClass(code: string): Promise<JoinSuccessResult> {
  const response = await fetch("/api/v1/student/classes/join-by-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw data.error as ApiError;
  }

  return data.data as JoinSuccessResult;
}

// Success view component
function JoinSuccessView({
  result,
  onContinue,
}: {
  result: JoinSuccessResult;
  onContinue: () => void;
}) {
  const title =
    result.joinOutcome === "already_enrolled"
      ? t.public.join.success.alreadyEnrolledTitle(result.classTitle)
      : result.joinOutcome === "previous_enrollment"
        ? t.public.join.success.previousEnrollmentTitle(result.classTitle)
        : t.public.join.success.joinedTitle(result.classTitle);

  const description =
    result.joinOutcome === "already_enrolled"
      ? t.public.join.success.alreadyEnrolledDescription
      : result.joinOutcome === "previous_enrollment"
        ? t.public.join.success.previousEnrollmentDescription
        : t.public.join.success.joinedDescription(result.assignmentResultsCreated);

  return (
    <EmptyState
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
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      }
      title={title}
      description={description}
      action={
        <Button size="lg" onClick={onContinue}>
          {t.public.join.goToClass}
        </Button>
      }
    />
  );
}

// Error view component
function JoinErrorView({
  error,
  onRetry,
}: {
  error: JoinError;
  onRetry: () => void;
}) {
  const errorIcons: Record<JoinErrorType, React.ReactNode> = {
    invalid: (
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
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    expired: (
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
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    revoked: (
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
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    ),
    generic: (
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
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  return (
    <EmptyState
      icon={errorIcons[error.type]}
      title={error.message}
      description={error.hint}
      action={
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={onRetry}>
            {t.common.tryAgain}
          </Button>
          <Link href="/help" className="text-sm text-foreground-secondary hover:text-foreground">
            {t.public.join.needHelpContactSupport}
          </Link>
        </div>
      }
    />
  );
}

// Loading fallback for Suspense
function JoinPageSkeleton() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <div className="h-8 w-48 animate-pulse rounded bg-surface-muted" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-surface-muted" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="h-20 animate-pulse rounded bg-surface-muted" />
            <div className="h-12 animate-pulse rounded bg-surface-muted" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// Inner component that uses useSearchParams
function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [state, setState] = useState<JoinState>({ status: "idle" });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Handle join attempt
  const handleJoin = useCallback(async (joinCode: string) => {
    setState({ status: "validating" });

    try {
      const isStudent = await checkStudentAuth();

      if (!isStudent) {
        // Not authenticated - save intent and redirect to login
        setJoinIntentCookie(joinCode);
        const returnUrl = encodeURIComponent(`/join?code=${joinCode}`);
        router.push(`/auth/student/login?returnUrl=${returnUrl}`);
        return;
      }

      // Authenticated - attempt to join
      const result = await joinClass(joinCode);
      clearJoinIntentCookie();
      setState({ status: "success", result });
    } catch (err) {
      const apiError = err as ApiError;
      setState({ status: "error", error: parseJoinError(apiError) });
    }
  }, [router]);

  // Check for pending join intent on mount
  useEffect(() => {
    const pendingCode = searchParams?.get("code") || getJoinIntentCookie();
    if (pendingCode) {
      setCode(pendingCode);
      // If we have a pending code and we're on the join page, attempt auto-join
      checkStudentAuth().then((isStudent) => {
        setIsAuthenticated(isStudent);
        if (isStudent) {
          // Auto-join for authenticated students
          handleJoin(pendingCode);
        }
      });
    } else {
      checkStudentAuth().then(setIsAuthenticated);
    }
  }, [handleJoin, searchParams]);

  // Handle successful join redirect — honor returnUrl if provided
  const handleContinue = useCallback(() => {
    if (state.status === "success") {
      clearJoinIntentCookie();
      const returnUrl = sanitizeReturnUrl(searchParams?.get("returnUrl") ?? null);
      if (returnUrl) {
        router.push(returnUrl);
      } else {
        router.push(`/student/classes/${state.result.classId}`);
      }
    }
  }, [state, router, searchParams]);

  // Form submission handler
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim() || code.length !== 6) {
        setState({
          status: "error",
          error: {
            type: "invalid",
            message: t.public.join.invalidSixDigit.title,
            hint: t.public.join.invalidSixDigit.hint,
          },
        });
        return;
      }
      await handleJoin(code.trim());
    },
    [code, handleJoin]
  );

  // Retry handler
  const handleRetry = useCallback(() => {
    setState({ status: "idle" });
    setCode("");
  }, []);

  // Render based on state
  if (state.status === "success") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center p-6">
        <JoinSuccessView result={state.result} onContinue={handleContinue} />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center p-6">
        <JoinErrorView error={state.error} onRetry={handleRetry} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t.public.join.title}</CardTitle>
          <CardDescription>
            {t.public.join.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FormField
              label={t.public.join.classCode}
              htmlFor="joinCode"
              hint={t.public.join.classCodeHint}
              required
            >
              <Input
                id="joinCode"
                name="joinCode"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder={t.public.join.classCodePlaceholder}
                value={code}
                onChange={(e) => {
                  // Only allow digits
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(value);
                }}
                disabled={state.status === "validating"}
                size="lg"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoComplete="off"
                autoFocus
              />
            </FormField>

            <Button
              type="submit"
              size="lg"
              loading={state.status === "validating"}
              disabled={code.length !== 6 || state.status === "validating"}
              className="w-full"
            >
              {state.status === "validating" ? t.public.join.joining : t.public.join.joinButton}
            </Button>

            <div className="flex flex-col gap-2 text-center">
              <p className="text-sm text-foreground-secondary">
                {t.public.join.alreadyHaveAccount}{" "}
                <Link
                  href={`/auth/student/login${code ? `?returnUrl=${encodeURIComponent(`/join?code=${code}`)}` : ""}`}
                  className="text-primary hover:underline"
                >
                  {t.public.join.signIn}
                </Link>
              </p>
              <Link
                href="/help"
                className="text-sm text-foreground-muted hover:text-foreground-secondary"
              >
                {t.public.join.needHelpFindingCode}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

// Main page component with Suspense boundary
export default function JoinPage() {
  return (
    <Suspense fallback={<JoinPageSkeleton />}>
      <JoinPageInner />
    </Suspense>
  );
}
