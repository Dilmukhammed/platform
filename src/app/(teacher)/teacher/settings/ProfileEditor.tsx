"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Upload, Camera } from "lucide-react";
import { apiPatch, apiPost } from "@/lib/api/client-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/translations";

interface ProfileEditorProps {
  userId: string;
  initialDisplayName: string;
  loginIdentifier: string;
  role: string;
  initialAvatarUrl: string | null;
}

export function ProfileEditor({ userId, initialDisplayName, loginIdentifier, role, initialAvatarUrl }: ProfileEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);

  async function handleSave() {
    if (!displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch("/api/v1/teacher/profile", { displayName: displayName.trim() });
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDisplayName(initialDisplayName);
    setIsEditing(false);
    setError(null);
  }

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      // 1. Get signed upload URL
      const { signedUrl, path } = await apiPost<{ signedUrl: string; path: string }>("/api/v1/teacher/profile/avatar", {});

      // 2. Upload file to signed URL
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) throw new Error("Failed to upload avatar.");

      // 3. Update platform_users.avatar_url
      await apiPatch("/api/v1/teacher/profile", { avatarUrl: path } as Record<string, unknown>);

      // 4. Show new avatar
      const avatarRes = await fetch(`/api/v1/teacher/profile/avatar?t=${Date.now()}`);
      if (avatarRes.ok) {
        setAvatarUrl(avatarRes.url);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover border-2 border-border"
                unoptimized
              />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted border-2 border-border">
              <Camera className="h-6 w-6 text-foreground-secondary" />
            </div>
          )}
          <button
            type="button"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-foreground-inverse shadow-sm hover:bg-primary-hover transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Upload avatar"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{t.teacher.settings.profile.description}</p>
          <p className="text-xs text-foreground-secondary">{t.teacher.settings.profile.description}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleAvatarUpload(file);
          }}
        />
        {uploading && <span className="text-xs text-foreground-secondary">Uploading...</span>}
      </div>

      {/* Display Name */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {isEditing ? (
            <FormField label="Display Name" htmlFor="displayName">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
              />
            </FormField>
          ) : (
            <FormField label="Display Name">
              <Input value={displayName} disabled className="bg-surface-muted" />
            </FormField>
          )}
        </div>
        <FormField label="Login Identifier">
          <Input value={loginIdentifier} disabled className="bg-surface-muted" />
        </FormField>
      </div>

      {/* Edit/Save actions */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button size="sm" onClick={handleSave} disabled={saving} leftIcon={<Check className="h-4 w-4" />}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving} leftIcon={<X className="h-4 w-4" />}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
        <Badge variant="primary" size="sm">{role}</Badge>
        <span className="text-xs text-foreground-secondary">Account role cannot be changed</span>
      </div>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}
