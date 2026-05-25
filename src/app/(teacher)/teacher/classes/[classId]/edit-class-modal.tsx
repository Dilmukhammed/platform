"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

interface EditClassModalProps {
  classId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialStatus: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  status?: string;
  general?: string;
}

export function EditClassModal({
  classId,
  initialTitle,
  initialDescription,
  initialStatus,
}: EditClassModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: initialTitle,
    description: initialDescription ?? "",
    status: initialStatus,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 255) {
      newErrors.title = "Title must be less than 255 characters";
    }

    if (formData.description.length > 1000) {
      newErrors.description = "Description must be less than 1000 characters";
    }

    if (!["draft", "active", "archived"].includes(formData.status)) {
      newErrors.status = "Invalid status";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/v1/teacher/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim() || undefined,
          description: formData.description.trim() || undefined,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrors({ general: data.error?.message || "Failed to update class" });
        setIsSubmitting(false);
        return;
      }

      // Success - close modal and refresh
      setIsOpen(false);
      router.refresh();
    } catch {
      setErrors({ general: "An unexpected error occurred" });
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)} className="min-w-0">
        <Pencil className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">Edit</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <Card elevation="md">
              <form onSubmit={handleSubmit}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Edit Class</CardTitle>
                      <CardDescription>Update class details</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      disabled={isSubmitting}
                      className="-mr-2 -mt-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {errors.general && (
                    <div className="rounded-card border border-error bg-error-subtle/30 p-3 text-sm text-error">
                      {errors.general}
                    </div>
                  )}

                  <FormField
                    label="Title"
                    htmlFor="title"
                    error={errors.title}
                    required
                  >
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      disabled={isSubmitting}
                      state={errors.title ? "error" : "default"}
                    />
                  </FormField>

                  <FormField
                    label="Description"
                    htmlFor="description"
                    error={errors.description}
                    hint="Optional"
                  >
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={3}
                      disabled={isSubmitting}
                      state={errors.description ? "error" : "default"}
                    />
                  </FormField>

                  <FormField
                    label="Status"
                    htmlFor="status"
                    error={errors.status}
                  >
                    <Select
                      id="status"
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value)}
                      disabled={isSubmitting}
                      state={errors.status ? "error" : "default"}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </Select>
                  </FormField>
                </CardContent>

                <CardFooter className="flex justify-end gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
