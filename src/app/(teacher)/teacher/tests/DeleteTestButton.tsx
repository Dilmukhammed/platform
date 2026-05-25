"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";

import { t } from "@/lib/translations";

type TestStatus = "draft" | "active" | "archived" | "deletion_requested";

interface DeleteTestButtonProps {
  testId: string;
  title: string;
  status: TestStatus;
  hasPendingApproval: boolean;
}

export function DeleteTestButton({
  testId,
  title,
  status,
  hasPendingApproval,
}: DeleteTestButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reason, setReason] = useState("");

  // Deletion requested — show badge instead of button
  if (status === "deletion_requested") {
    return (
      <Badge variant="warning" size="sm">
        {t.teacher.tests.status.deletionPending}
      </Badge>
    );
  }

  const isDraft = status === "draft" || hasPendingApproval;
  const isActive = status === "active";

  // Only show delete button for draft or active tests
  if (!isDraft && !isActive) {
    return null;
  }

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const body = isActive ? { reason: reason.trim() || undefined } : undefined;

      const response = await fetch(`/api/v1/teacher/tests/${testId}`, {
        method: "DELETE",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { message: string };
      } | null;

      if (!response.ok || !data?.success) {
        alert(data?.error?.message ?? "Failed to delete test.");
        setIsDeleting(false);
        return;
      }

      if (isActive) {
        router.push("/teacher/tests?deletion-requested=true");
      } else {
        router.push("/teacher/tests?deleted=true");
      }
      router.refresh();
    } catch {
      alert("An unexpected error occurred.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        leftIcon={<Trash2 className="h-3 w-3" />}
      >
        {isActive ? t.teacher.tests.buttons.requestDeletion : t.teacher.tests.buttons.delete}
      </Button>

      {isDraft && (
        <Modal open={isOpen} onOpenChange={setIsOpen}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>&lsquo;{title}&rsquo; ni oʻchirish?</ModalTitle>
              <ModalDescription>
                Bu amalni bekor qilib boʻlmaydi.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
              >
                {t.teacher.tests.buttons.cancel}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                loading={isDeleting}
              >
                {isDeleting ? t.teacher.tests.buttons.deleting : t.teacher.tests.buttons.delete}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}

      {isActive && (
        <Modal open={isOpen} onOpenChange={setIsOpen}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>&lsquo;{title}&rsquo; ni oʻchirish soʻrovi?</ModalTitle>
              <ModalDescription>
                Bu test hozirda eʼlon qilingan va maktab doirasida koʻrinadi.
                Administrator oʻchirishni tasdiqlashi kerak.
              </ModalDescription>
            </ModalHeader>
            <div className="space-y-2">
              <label
                htmlFor="deletion-reason"
                className="text-sm font-medium text-foreground"
              >
                Sabab (ixtiyoriy)
              </label>
              <Textarea
                id="deletion-reason"
                size="sm"
                rows={3}
                placeholder="Nima uchun bu test oʻchirilishi kerak..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isDeleting}
              />
            </div>
            <ModalFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
              >
                {t.teacher.tests.buttons.cancel}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                loading={isDeleting}
              >
                {isDeleting ? t.teacher.tests.buttons.submitting : t.teacher.tests.buttons.submitRequest}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
