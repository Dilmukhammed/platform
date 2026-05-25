"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/translations";

interface SessionExpirationWarningProps {
  /** ISO timestamp when the session expires */
  expiresAt: string;
  /** URL to redirect to when session expires */
  loginUrl: string;
  /** API endpoint to refresh/extend the session */
  refreshUrl?: string;
  /** Minutes before expiration to show warning (default: 5) */
  warningMinutes?: number;
}

/**
 * Session Expiration Warning Component
 *
 * Monitors session expiration and shows a warning modal before the session expires.
 * Allows users to extend their session or redirects to login when expired.
 *
 * @example
 * ```tsx
 * <SessionExpirationWarning
 *   expiresAt={session.expiresAt}
 *   loginUrl="/auth/teacher/sign-in"
 *   refreshUrl="/api/v1/teacher/auth/refresh"
 * />
 * ```
 */
export function SessionExpirationWarning({
  expiresAt,
  loginUrl,
  refreshUrl,
  warningMinutes = 5,
}: SessionExpirationWarningProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = React.useState(false);
  const [isExtending, setIsExtending] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState<string>("");

  const expirationTime = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const warningMs = warningMinutes * 60 * 1000;

  React.useEffect(() => {
    const checkExpiration = () => {
      const now = Date.now();
      const timeUntilExpiry = expirationTime - now;

      if (timeUntilExpiry <= 0) {
        // Session expired - redirect to login
        router.push(loginUrl);
        return;
      }

      if (timeUntilExpiry <= warningMs && !showWarning) {
        // Show warning when within warning window
        setShowWarning(true);
      }

      // Update time remaining display
      const minutes = Math.max(0, Math.floor(timeUntilExpiry / 60000));
      const seconds = Math.max(0, Math.floor((timeUntilExpiry % 60000) / 1000));
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    // Check immediately
    checkExpiration();

    // Set up interval to check every second
    const interval = setInterval(checkExpiration, 1000);

    return () => clearInterval(interval);
  }, [expirationTime, warningMs, showWarning, loginUrl, router]);

  const handleExtendSession = async () => {
    if (!refreshUrl) {
      // If no refresh URL, just reload the page to trigger session refresh
      window.location.reload();
      return;
    }

    setIsExtending(true);
    try {
      const response = await fetch(refreshUrl, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Session extended - close warning and reload to get new expiration
        setShowWarning(false);
        window.location.reload();
      } else {
        // Refresh failed - redirect to login
        router.push(loginUrl);
      }
    } catch {
      // Error refreshing - redirect to login
      router.push(loginUrl);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    router.push(loginUrl);
  };

  return (
    <Modal open={showWarning} onOpenChange={setShowWarning}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{t.components.sessionExpirationWarning.title}</ModalTitle>
          <ModalDescription>
            {t.components.sessionExpirationWarning.description.replace("{timeRemaining}", timeRemaining)}
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="ghost" onClick={handleLogout}>
            {t.components.sessionExpirationWarning.logOut}
          </Button>
          <Button onClick={handleExtendSession} loading={isExtending}>
            {t.components.sessionExpirationWarning.stayLoggedIn}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
