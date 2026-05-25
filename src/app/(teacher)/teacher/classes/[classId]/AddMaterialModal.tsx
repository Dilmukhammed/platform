"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface EligibleMaterial {
  materialId: string;
  title: string;
  description: string | null;
  scopeType: "personal" | "organization";
  ownerName: string | null;
  isLinked: boolean;
  createdAt: string;
}

interface AddMaterialModalProps {
  classId: string;
}

export function AddMaterialModal({ classId }: AddMaterialModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [materials, setMaterials] = useState<EligibleMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/teacher/classes/${classId}/materials/eligible`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || "Failed to fetch materials");
        return;
      }

      setMaterials(data.data?.data ?? []);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  // Fetch materials when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMaterials();
      setSearchQuery("");
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, fetchMaterials]);

  const handleAddMaterial = async (material: EligibleMaterial) => {
    setIsAdding(material.materialId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/v1/teacher/classes/${classId}/materials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materialId: material.materialId }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || "Failed to add material");
        setIsAdding(null);
        return;
      }

      // Success - update local state and show message
      setMaterials((prev) =>
        prev.map((m) =>
          m.materialId === material.materialId ? { ...m, isLinked: true } : m
        )
      );
      setSuccessMessage(`"${material.title}" added to class`);

      // Refresh the page to show the new material
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsAdding(null);
    }
  };

  // Filter materials by search query
  const filteredMaterials = materials.filter((material) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      material.title.toLowerCase().includes(query) ||
      material.description?.toLowerCase().includes(query) ||
      material.ownerName?.toLowerCase().includes(query)
    );
  });

  // Separate into available and already linked
  const availableMaterials = filteredMaterials.filter((m) => !m.isLinked);
  const linkedMaterials = filteredMaterials.filter((m) => m.isLinked);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Material
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <Card elevation="md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Add Material to Class</CardTitle>
                    <CardDescription>
                      Select a material to share with your students
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="-mr-2 -mt-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                  <Input
                    placeholder="Search materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-card border border-error bg-error-subtle/30 p-3 text-sm text-error">
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="rounded-card border border-success bg-success-subtle/30 p-3 text-sm text-success">
                    {successMessage}
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-foreground-muted" />
                  </div>
                )}

                {/* Materials List */}
                {!isLoading && (
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {/* Available Materials */}
                    {availableMaterials.length > 0 && (
                      <div className="space-y-1">
                        {availableMaterials.map((material) => (
                          <button
                            key={material.materialId}
                            onClick={() => handleAddMaterial(material)}
                            disabled={isAdding !== null}
                            className="w-full rounded-card border border-border bg-surface-raised p-3 text-left transition-colors hover:border-border-hover hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate">
                                  {material.title}
                                </div>
                                {material.description && (
                                  <div className="mt-0.5 text-sm text-foreground-secondary line-clamp-1">
                                    {material.description}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isAdding === material.materialId ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" />
                                ) : (
                                  <Plus className="h-4 w-4 text-foreground-muted" />
                                )}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge
                                variant={material.scopeType === "personal" ? "primary" : "info"}
                                size="sm"
                              >
                                {material.scopeType === "personal"
                                  ? "Personal"
                                  : "School Library"}
                              </Badge>
                              {material.ownerName && (
                                <span className="text-xs text-foreground-muted">
                                  {material.ownerName}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Already Linked Materials */}
                    {linkedMaterials.length > 0 && (
                      <div className="space-y-1">
                        {availableMaterials.length > 0 && (
                          <div className="pt-2 pb-1 text-xs font-medium text-foreground-muted uppercase tracking-wide">
                            Already in class
                          </div>
                        )}
                        {linkedMaterials.map((material) => (
                          <div
                            key={material.materialId}
                            className="rounded-card border border-border bg-surface-muted/50 p-3 opacity-60"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate">
                                  {material.title}
                                </div>
                                {material.description && (
                                  <div className="mt-0.5 text-sm text-foreground-secondary line-clamp-1">
                                    {material.description}
                                  </div>
                                )}
                              </div>
                              <Badge variant="success" size="sm">
                                Added
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge
                                variant={material.scopeType === "personal" ? "primary" : "info"}
                                size="sm"
                              >
                                {material.scopeType === "personal"
                                  ? "Personal"
                                  : "School Library"}
                              </Badge>
                              {material.ownerName && (
                                <span className="text-xs text-foreground-muted">
                                  {material.ownerName}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State */}
                    {filteredMaterials.length === 0 && !isLoading && (
                      <EmptyState
                        icon={<FileText className="h-6 w-6" />}
                        title="No materials found"
                        description={
                          searchQuery
                            ? "Try a different search term"
                            : "Upload materials first to add them to your class"
                        }
                      />
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsOpen(false)}
                >
                  Done
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
