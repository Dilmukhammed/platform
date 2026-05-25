"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditMaterialFormProps {
  materialId: string;
  initialTitle: string;
  initialDescription: string | null;
}

interface FormErrors {
  title?: string;
  description?: string;
  general?: string;
}

export function EditMaterialForm({
  materialId,
  initialTitle,
  initialDescription,
}: EditMaterialFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription ?? "");
  }, [initialDescription, initialTitle]);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const normalizedInitialTitle = initialTitle.trim();
  const normalizedInitialDescription = (initialDescription ?? "").trim();

  const isUnchanged = useMemo(
    () => trimmedTitle === normalizedInitialTitle && trimmedDescription === normalizedInitialDescription,
    [normalizedInitialDescription, normalizedInitialTitle, trimmedDescription, trimmedTitle],
  );

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!trimmedTitle) {
      nextErrors.title = "Title is required.";
    } else if (trimmedTitle.length > 255) {
      nextErrors.title = "Title must be 255 characters or fewer.";
    }

    if (description.length > 1000) {
      nextErrors.description = "Description must be 1000 characters or fewer.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/teacher/materials/${materialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setErrors({
          general: data?.error?.message ?? "Failed to update material.",
        });
        setIsSubmitting(false);
        return;
      }

      setTitle(trimmedTitle);
      setDescription(trimmedDescription);
      setSuccessMessage("Material details updated.");
      router.refresh();
    } catch {
      setErrors({ general: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card elevation="sm">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Edit material details</CardTitle>
          <CardDescription>
            Update the teacher-facing title and description. File replacement stays outside this v1.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage ? (
            <div className="rounded-lg border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          ) : null}

          {errors.general ? (
            <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
              {errors.general}
            </div>
          ) : null}

          <FormField
            label="Title"
            htmlFor="material-title"
            required
            hint="Required. Maximum 255 characters."
            error={errors.title}
          >
            <Input
              id="material-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isSubmitting}
              state={errors.title ? "error" : "default"}
              maxLength={255}
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="material-description"
            hint="Optional. Maximum 1000 characters."
            error={errors.description}
          >
            <Textarea
              id="material-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              state={errors.description ? "error" : "default"}
              rows={6}
              maxLength={1000}
            />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end border-t border-border pt-4">
          <Button type="submit" disabled={isSubmitting || isUnchanged}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
