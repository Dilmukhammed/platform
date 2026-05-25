"use client";

import { apiPost } from "@/lib/api/client-fetch";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/translations";
import { Check } from "lucide-react";
import { useState } from "react";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [isRead, setIsRead] = useState(false);

  async function handleMarkRead() {
    try {
      await apiPost(`/api/v1/student/notifications/${notificationId}/read`, {});
      setIsRead(true);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  if (isRead) {
    return null;
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleMarkRead}>
      <Check className="h-4 w-4 mr-1" />
      {t.student.notifications.markRead}
    </Button>
  );
}
