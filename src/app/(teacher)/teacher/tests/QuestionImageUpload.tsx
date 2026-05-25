"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/translations";

interface QuestionImageManagerProps {
  /** Array of Supabase Storage paths */
  images: string[];
  /** Callback with updated array of paths */
  onImagesChange: (paths: string[]) => void;
  disabled?: boolean;
  variant?: "default" | "compact";
  maxImages?: number;
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Global cache for local previews - persists across component re-renders and remounts
const globalPreviewCache = new Map<string, string>();

export function QuestionImageManager({
  images: imagesProp,
  onImagesChange,
  disabled = false,
  variant = "default",
  maxImages = 5,
}: QuestionImageManagerProps) {
  const images = imagesProp ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Track paths with local blob previews created by this instance
  const localPreviewPaths = useRef<Set<string>>(new Set());
  // Force re-render when previews change
  const [, forceUpdate] = useState({});

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const path of localPreviewPaths.current) {
        const preview = globalPreviewCache.get(path);
        if (preview) {
          URL.revokeObjectURL(preview);
          globalPreviewCache.delete(path);
        }
      }
    };
  }, []);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const initResponse = await fetch("/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        uploadType: "test_asset",
        contextType: "test",
      }),
    });

    const initData = (await initResponse.json()) as {
      success: boolean;
      data?: {
        uploadId: string;
        targetUrl: string;
        upload?: { signedUrl: string; path: string; bucket: string };
        storagePath?: string;
        signedUrl?: string;
      };
      error?: { message?: string };
    };

    if (!initResponse.ok || !initData.success || !initData.data) {
      throw new Error(initData.error?.message ?? "Upload init failed.");
    }

    const signedUrl = initData.data.upload?.signedUrl ?? initData.data.signedUrl ?? initData.data.targetUrl;
    const storagePath = initData.data.upload?.path ?? initData.data.storagePath ?? "";

    const uploadResponse = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to storage.");
    }

    const completeResponse = await fetch(`/api/v1/uploads/${initData.data.uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageBucket: initData.data.upload?.bucket ?? "uploads",
        storagePath,
        storageObjectId: initData.data.uploadId,
      }),
    });

    const completeData = (await completeResponse.json()) as { success: boolean; error?: { message?: string } };

    if (!completeResponse.ok || !completeData.success) {
      throw new Error(completeData.error?.message ?? "Upload complete failed.");
    }

    return storagePath;
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    // Validate all files first
    for (const file of filesToUpload) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        window.alert(`"${file.name}" is not a supported image format. Use JPEG, PNG, GIF, or WebP.`);
        resetFileInput();
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        window.alert(`"${file.name}" is too large. Max 5MB per image.`);
        resetFileInput();
        return;
      }
    }

    setIsUploading(true);

    try {
      const newPaths: string[] = [];

      for (const file of filesToUpload) {
        const storagePath = await uploadFile(file);
        newPaths.push(storagePath);
        // Store in global cache
        globalPreviewCache.set(storagePath, URL.createObjectURL(file));
        localPreviewPaths.current.add(storagePath);
      }

      // Force re-render to show new previews
      forceUpdate({});
      onImagesChange([...images, ...newPaths]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      resetFileInput();
    }
  };

  const handleRemove = (path: string) => {
    const preview = globalPreviewCache.get(path);
    if (preview) {
      URL.revokeObjectURL(preview);
      globalPreviewCache.delete(path);
      localPreviewPaths.current.delete(path);
      forceUpdate({});
    }
    onImagesChange(images.filter((p) => p !== path));
  };

  const getImageSrc = (path: string): string => {
    // Prefer local preview (just uploaded), else use signed URL endpoint
    const local = globalPreviewCache.get(path);
    if (local) return local;
    return `/api/v1/uploads/signed-url?path=${encodeURIComponent(path)}`;
  };

  const canAddMore = images.length < maxImages;

  // Compact variant: small thumbnails + add button in a row (for MC options)
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1 shrink-0">
        {images.map((path) => (
          <div key={path} className="relative group">
            <img
              src={getImageSrc(path)}
              alt="Option image"
              className="h-8 w-8 rounded border border-border object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(path)}
                className="absolute -right-1 -top-1 h-4 w-4 flex items-center justify-center rounded-full bg-surface border border-border text-foreground-secondary hover:text-error"
              >
                <X className="h-2 w-2" />
              </button>
            )}
          </div>
        ))}
        {canAddMore && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileSelect}
              disabled={disabled || isUploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="h-8 w-8 flex items-center justify-center rounded border border-dashed border-border hover:border-primary hover:bg-primary-subtle/20 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3 text-foreground-secondary" />}
            </button>
          </>
        )}
      </div>
    );
  }

  // Default variant: larger previews with labels (for question-level images)
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((path) => (
            <div key={path} className="relative group">
              <img
                src={getImageSrc(path)}
                alt="Question image"
                className="max-h-36 max-w-[240px] rounded-md border border-border object-contain"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(path)}
                  className="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-surface/90 border border-border text-foreground-secondary hover:text-error"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canAddMore && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            multiple
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            leftIcon={isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
          >
            {isUploading ? t.teacher.tests.buttons.uploading : images.length === 0 ? t.teacher.tests.buttons.addImage : t.teacher.tests.buttons.addMore}
          </Button>
        </>
      )}
    </div>
  );
}
