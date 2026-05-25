import type { AuthenticatedSession } from "@/modules/auth/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadType = "material" | "submission" | "test_asset";
export type UploadStatus = "pending" | "completed" | "failed";
export type UploadOwnerRole = "teacher" | "student";
export type UploadContextType = "material" | "submission" | "test" | "assignment_result";

export const MAX_UPLOAD_SIZE_BYTES = 1_073_741_824;

export const ALLOWED_MIME_TYPES: Record<UploadType, string[]> = {
  material: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/plain",
  ],
  submission: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/tiff",
    "image/webp",
    "application/dwg",
    "application/acad",
    "application/autocad",
    "application/octet-stream",
  ],
  test_asset: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "audio/mpeg",
    "audio/wav",
    "video/mp4",
  ],
};

export type UploadSessionRecord = {
  id: string;
  status: UploadStatus;
  uploadType: UploadType;
  ownerRole: UploadOwnerRole;
  ownerId: string;
  contextId?: string;
  contextType?: UploadContextType;
  fileName?: string;
  declaredFileSize?: number;
  declaredMimeType?: string;
  completedFileSize?: number;
  completedMimeType?: string;
  storageBucket: string;
  storagePath: string;
  storageObjectId?: string;
  storageObjectVersion?: string;
  storageEtag?: string;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
};

type CreateUploadSessionInput = {
  uploadId: string;
  uploadType: UploadType;
  ownerRole: UploadOwnerRole;
  ownerId: string;
  contextId?: string;
  contextType?: UploadContextType;
  fileName?: string;
  declaredFileSize?: number;
  declaredMimeType?: string;
  storageBucket: string;
  storagePath: string;
};

type FinalizeUploadSessionInput = {
  uploadId: string;
  completedFileSize: number | null;
  completedMimeType: string | null;
  storageObjectId: string | null;
  storageObjectVersion: string | null;
  storageEtag: string | null;
  checksum?: string;
};

type FailUploadSessionInput = {
  uploadId: string;
  errorMessage: string;
};

type UploadSessionRow = {
  id: string;
  status: UploadStatus;
  upload_type: UploadType;
  owner_role: UploadOwnerRole;
  owner_platform_user_id: string | null;
  owner_student_profile_id: string | null;
  context_id: string | null;
  context_type: UploadContextType | null;
  original_file_name: string | null;
  declared_file_size_bytes: number | null;
  declared_mime_type: string | null;
  completed_file_size_bytes: number | null;
  completed_mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  storage_object_id: string | null;
  storage_object_version: string | null;
  storage_etag: string | null;
  checksum: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export function getAllowedMimeTypes(uploadType: UploadType): string[] {
  return ALLOWED_MIME_TYPES[uploadType];
}

export function getUploadBucketName(): string {
  return process.env.SUPABASE_UPLOADS_BUCKET
    ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
    ?? "uploads";
}

export function sanitizeUploadFileName(fileName?: string) {
  if (!fileName) {
    return "upload.bin";
  }

  const sanitized = fileName
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return sanitized || "upload.bin";
}

export function getUploadOwnerRole(session: AuthenticatedSession): UploadOwnerRole | null {
  if (session.role === "teacher") {
    return "teacher";
  }

  if (session.role === "student") {
    return "student";
  }

  return null;
}

export function buildReservedUploadStoragePath(input: {
  uploadId: string;
  uploadType: UploadType;
  ownerRole: UploadOwnerRole;
  ownerId: string;
  contextType?: UploadContextType;
  contextId?: string;
  fileName?: string;
}) {
  const fileName = sanitizeUploadFileName(input.fileName);
  const scopedContext = input.contextId && input.contextType
    ? `${input.contextType}/${input.contextId}`
    : "unscoped";

  return [
    "uploads",
    input.uploadType,
    input.ownerRole,
    input.ownerId,
    scopedContext,
    input.uploadId,
    fileName,
  ].join("/");
}

function mapUploadSessionRow(row: UploadSessionRow): UploadSessionRecord {
  return {
    id: row.id,
    status: row.status,
    uploadType: row.upload_type,
    ownerRole: row.owner_role,
    ownerId: row.owner_platform_user_id ?? row.owner_student_profile_id ?? "",
    contextId: row.context_id ?? undefined,
    contextType: row.context_type ?? undefined,
    fileName: row.original_file_name ?? undefined,
    declaredFileSize: row.declared_file_size_bytes ?? undefined,
    declaredMimeType: row.declared_mime_type ?? undefined,
    completedFileSize: row.completed_file_size_bytes ?? undefined,
    completedMimeType: row.completed_mime_type ?? undefined,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    storageObjectId: row.storage_object_id ?? undefined,
    storageObjectVersion: row.storage_object_version ?? undefined,
    storageEtag: row.storage_etag ?? undefined,
    checksum: row.checksum ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

export async function createUploadSession(
  supabase: SupabaseClient,
  input: CreateUploadSessionInput,
): Promise<UploadSessionRecord> {
  const payload = {
    id: input.uploadId,
    status: "pending",
    upload_type: input.uploadType,
    owner_role: input.ownerRole,
    owner_platform_user_id: input.ownerRole === "teacher" ? input.ownerId : null,
    owner_student_profile_id: input.ownerRole === "student" ? input.ownerId : null,
    context_id: input.contextId ?? null,
    context_type: input.contextType ?? null,
    original_file_name: input.fileName ?? null,
    declared_file_size_bytes: input.declaredFileSize ?? null,
    declared_mime_type: input.declaredMimeType ?? null,
    storage_bucket: input.storageBucket,
    storage_path: input.storagePath,
  };

  const { data, error } = await supabase
    .from("upload_sessions")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create upload session.");
  }

  return mapUploadSessionRow(data as UploadSessionRow);
}

export async function getUploadSessionById(
  supabase: SupabaseClient,
  uploadId: string,
): Promise<UploadSessionRecord | null> {
  const { data, error } = await supabase
    .from("upload_sessions")
    .select("*")
    .eq("id", uploadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapUploadSessionRow(data as UploadSessionRow) : null;
}

export async function finalizeUploadSession(
  supabase: SupabaseClient,
  input: FinalizeUploadSessionInput,
): Promise<UploadSessionRecord | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("upload_sessions")
    .update({
      status: "completed",
      completed_file_size_bytes: input.completedFileSize,
      completed_mime_type: input.completedMimeType,
      storage_object_id: input.storageObjectId,
      storage_object_version: input.storageObjectVersion,
      storage_etag: input.storageEtag,
      checksum: input.checksum ?? null,
      completed_at: now,
      updated_at: now,
      error_message: null,
    })
    .eq("id", input.uploadId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapUploadSessionRow(data as UploadSessionRow) : null;
}

export async function failUploadSession(
  supabase: SupabaseClient,
  input: FailUploadSessionInput,
): Promise<UploadSessionRecord | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("upload_sessions")
    .update({
      status: "failed",
      error_message: input.errorMessage,
      updated_at: now,
    })
    .eq("id", input.uploadId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapUploadSessionRow(data as UploadSessionRow) : null;
}

export function uploadSessionBelongsToUser(
  upload: UploadSessionRecord,
  session: AuthenticatedSession,
) {
  const ownerRole = getUploadOwnerRole(session);
  return ownerRole === upload.ownerRole && upload.ownerId === session.userId;
}
