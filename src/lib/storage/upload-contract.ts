import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "@/lib/translations";

export type SignedUploadContract = {
  provider: "supabase";
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  method: "PUT";
  upsert: true;
};

export async function createSignedUploadContract(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<SignedUploadContract> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path, {
    upsert: true,
  });

  if (error || !data) {
    throw error ?? new Error(t.api.upload.failedToCreateSignedUploadUrl);
  }

  return {
    provider: "supabase",
    bucket,
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
    method: "PUT",
    upsert: true,
  };
}

export async function getStoredObjectMetadata(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
) {
  const { data, error } = await supabase.storage.from(bucket).info(path);

  if (error || !data) {
    throw error ?? new Error(t.api.upload.uploadedObjectNotFound);
  }

  return {
    objectId: data.id ?? null,
    version: data.version ?? null,
    etag: data.etag ?? null,
    size: data.size ?? null,
    mimeType: data.contentType ?? null,
  };
}
