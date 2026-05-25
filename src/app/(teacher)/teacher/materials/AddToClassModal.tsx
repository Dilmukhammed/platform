"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { t } from "@/lib/translations";

interface TeacherClass {
  classId: string;
  title: string;
  description?: string | null;
}

interface AddToClassModalProps {
  materialId: string;
  materialTitle: string;
  organizationId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (classNames: string[]) => void;
}

export function AddToClassModal({
  materialId,
  materialTitle,
  organizationId,
  isOpen,
  onClose,
  onSuccess,
}: AddToClassModalProps) {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<TeacherClass[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  // Fetch teacher's classes
  useEffect(() => {
    if (!isOpen) return;

    const fetchClasses = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = organizationId
          ? `/api/v1/teacher/classes?pageSize=100&organizationId=${encodeURIComponent(organizationId)}`
          : "/api/v1/teacher/classes?pageSize=100";
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch classes");
        }

        const data = await response.json();
        const classList = (data.data ?? []).map((ct: Record<string, unknown>) => ({
          classId: ct.classId as string,
          title: ct.title as string,
          description: ct.description as string | null,
        }));

        setClasses(classList);
        setFilteredClasses(classList);
      } catch (err) {
        console.error("[AddToClassModal] Failed to fetch classes:", err);
        setError(t.teacher.materials.addToClass.failedToLoad);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClasses();
  }, [isOpen, organizationId]);

  // Filter classes based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredClasses(classes);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = classes.filter(
      (cls) =>
        cls.title.toLowerCase().includes(query) ||
        (cls.description?.toLowerCase().includes(query) ?? false)
    );
    setFilteredClasses(filtered);
  }, [searchQuery, classes]);

  // Handle adding material to all selected classes
  const handleAddToClasses = useCallback(async () => {
    if (selectedClassIds.size === 0) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const selectedIds = Array.from(selectedClassIds);

    try {
      const results = await Promise.allSettled(
        selectedIds.map(async (classId) => {
          const response = await fetch(
            `/api/v1/teacher/classes/${classId}/materials`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ materialId }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const apiErrorMessage =
              errorData?.error?.message ??
              errorData?.message ??
              null;
            throw new Error(
              apiErrorMessage ?? "Failed to add material to class"
            );
          }

          return response.json();
        })
      );

      const succeeded: string[] = [];
      const failed: { className: string; reason: string }[] = [];

      results.forEach((result, index) => {
        const classId = selectedIds[index];
        const cls = classes.find((c) => c.classId === classId);
        const className = cls?.title ?? "Unknown class";

        if (result.status === "fulfilled") {
          succeeded.push(className);
        } else {
          failed.push({
            className,
            reason: result.reason instanceof Error ? result.reason.message : "Unknown error",
          });
        }
      });

      if (succeeded.length > 0 && failed.length === 0) {
        const label = succeeded.length === 1
          ? `"${succeeded[0]}"`
          : `${succeeded.length} ta sinf`;
        setSuccessMessage(t.teacher.materials.addToClass.addedSuccessfully(label));

        setTimeout(() => {
          onSuccess?.(succeeded);
          onClose();
        }, 1500);
      } else if (succeeded.length > 0 && failed.length > 0) {
        const label = succeeded.length === 1
          ? `"${succeeded[0]}"`
          : `${succeeded.length} ta sinf`;
        const failedNames = failed.map((f) => `"${f.className}": ${f.reason}`).join("; ");
        setSuccessMessage(t.teacher.materials.addToClass.addedPartial(label));
        setError(t.teacher.materials.addToClass.failedFor(failedNames));

        setTimeout(() => {
          onSuccess?.(succeeded);
          onClose();
        }, 2500);
      } else {
        const failedNames = failed.map((f) => `"${f.className}": ${f.reason}`).join("; ");
        setError(`Failed to add material to any class: ${failedNames}`);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("[AddToClassModal] Failed to add material:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add material to classes"
      );
      setIsSubmitting(false);
    }
  }, [selectedClassIds, materialId, classes, onSuccess, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedClassIds(new Set());
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedCount = selectedClassIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
        <Card elevation="md" className="w-full">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{t.teacher.materials.addToClass.title}</CardTitle>
                <CardDescription>
                  {t.teacher.materials.addToClass.description(materialTitle)}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="-mr-2 -mt-2"
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-error bg-error-subtle/30 p-3 text-sm text-error">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-md border border-success bg-success-subtle/30 p-3 text-sm text-success">
                {successMessage}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
              <Input
                placeholder={t.teacher.materials.addToClass.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={isLoading || isSubmitting}
              />
            </div>

            {/* Selected count indicator */}
            {selectedCount > 0 && !isSubmitting && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-secondary">
                  {t.teacher.materials.addToClass.selectedCount(selectedCount)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedClassIds(new Set())}
                  className="text-primary hover:underline text-sm"
                >
                  {t.teacher.materials.addToClass.clearAll}
                </button>
              </div>
            )}

            {/* Classes list */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-foreground-secondary">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t.teacher.materials.addToClass.loading}
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 text-foreground-secondary">
                  {t.teacher.materials.addToClass.noClasses}
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="text-center py-8 text-foreground-secondary">
                  {t.teacher.materials.addToClass.noMatch}
                </div>
              ) : (
                filteredClasses.map((cls) => {
                  const isSelected = selectedClassIds.has(cls.classId);
                  return (
                    <button
                      key={cls.classId}
                      type="button"
                      onClick={() => toggleClass(cls.classId)}
                      disabled={isSubmitting}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-all
                        ${
                          isSelected
                            ? "border-primary bg-primary-subtle/30"
                            : "border-border hover:border-border-hover hover:bg-surface-muted"
                        }
                        ${isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {cls.title}
                          </div>
                          {cls.description && (
                            <div className="text-sm text-foreground-secondary truncate">
                              {cls.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t.teacher.materials.addToClass.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleAddToClasses}
              disabled={selectedCount === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t.teacher.materials.addToClass.adding}
                </>
              ) : (
                t.teacher.materials.addToClass.addButton(selectedCount)
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
