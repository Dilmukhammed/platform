"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/translations";

interface NotificationsBadgeProps {
  recipientType: "student" | "teacher" | "admin";
  recipientId: string;
}

export function NotificationsBadge({ recipientType, recipientId }: NotificationsBadgeProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUnreadCount() {
      try {
        const basePath = recipientType === "student" ? "/api/v1/student" : recipientType === "teacher" ? "/api/v1/teacher" : "/api/v1/admin";
        const response = await fetch(`${basePath}/notifications`);
        
        if (!response.ok) {
          setCount(0);
          return;
        }

        const body = await response.json() as { data?: { unreadCount?: number } };
        const unreadCount = body.data?.unreadCount ?? 0;

        if (!cancelled) {
          setCount(unreadCount);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
        }
      }
    }

    fetchUnreadCount();
    return () => { cancelled = true; };
  }, [recipientType, recipientId]);

  if (count === null || count === 0) return null;

  return (
    <span
      className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground"
      role="status"
      aria-label={t.components.notificationsBadge.unreadNotificationsAria.replace("{count}", String(count))}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
