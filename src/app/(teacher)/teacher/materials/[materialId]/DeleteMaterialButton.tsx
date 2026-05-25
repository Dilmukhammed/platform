"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DeleteMaterialButtonProps {
  materialId: string;
  materialTitle: string;
}

export function DeleteMaterialButton({ materialId, materialTitle }: DeleteMaterialButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/teacher/materials/${materialId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setError(data?.error?.message ?? "Failed to delete material.");
        setIsDeleting(false);
        setShowConfirm(false);
        return;
      }

      router.push("/teacher/materials?deleted=1");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <Card elevation="sm">
      <CardHeader>
        <CardTitle>Delete material</CardTitle>
        <CardDescription>
          Soft delete this material and remove it from your teacher materials list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : null}

        {showConfirm ? (
          <div className="rounded-lg border border-warning-subtle bg-warning-subtle/50 px-4 py-3 text-sm">
            <p className="font-medium text-foreground mb-3">
              Delete &quot;{materialTitle}&quot;? This will remove the material from your teacher library.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                {isDeleting ? "Deleting..." : "Yes, delete"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setShowConfirm(true)}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Delete material
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
