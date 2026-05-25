create table public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  upload_type text not null,
  status text not null default 'pending',
  owner_role text not null,
  owner_platform_user_id uuid,
  owner_student_profile_id uuid,
  context_type text,
  context_id uuid,
  original_file_name text,
  declared_file_size_bytes bigint,
  declared_mime_type text,
  completed_file_size_bytes bigint,
  completed_mime_type text,
  storage_bucket text not null,
  storage_path text not null,
  storage_object_id text,
  storage_object_version text,
  storage_etag text,
  checksum text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint upload_sessions_owner_platform_user_id_fkey
    foreign key (owner_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint upload_sessions_owner_student_profile_id_fkey
    foreign key (owner_student_profile_id)
    references public.student_profiles (id)
    on update cascade
    on delete restrict,
  constraint upload_sessions_upload_type_check
    check (upload_type in ('material', 'submission', 'test_asset')),
  constraint upload_sessions_status_check
    check (status in ('pending', 'completed', 'failed')),
  constraint upload_sessions_owner_role_check
    check (owner_role in ('teacher', 'student')),
  constraint upload_sessions_context_type_check
    check (context_type is null or context_type in ('material', 'submission', 'test', 'assignment_result')),
  constraint upload_sessions_context_pair_check
    check (
      (context_type is null and context_id is null)
      or (context_type is not null and context_id is not null)
    ),
  constraint upload_sessions_owner_target_check
    check (
      (owner_role = 'teacher' and owner_platform_user_id is not null and owner_student_profile_id is null)
      or (owner_role = 'student' and owner_student_profile_id is not null and owner_platform_user_id is null)
    ),
  constraint upload_sessions_original_file_name_check
    check (original_file_name is null or btrim(original_file_name) <> ''),
  constraint upload_sessions_declared_file_size_bytes_check
    check (declared_file_size_bytes is null or declared_file_size_bytes > 0),
  constraint upload_sessions_declared_mime_type_check
    check (declared_mime_type is null or btrim(declared_mime_type) <> ''),
  constraint upload_sessions_completed_file_size_bytes_check
    check (completed_file_size_bytes is null or completed_file_size_bytes > 0),
  constraint upload_sessions_completed_mime_type_check
    check (completed_mime_type is null or btrim(completed_mime_type) <> ''),
  constraint upload_sessions_storage_bucket_check
    check (btrim(storage_bucket) <> ''),
  constraint upload_sessions_storage_path_check
    check (btrim(storage_path) <> ''),
  constraint upload_sessions_error_message_check
    check (error_message is null or btrim(error_message) <> '')
);

create index upload_sessions_owner_platform_user_id_idx
  on public.upload_sessions (owner_platform_user_id);

create index upload_sessions_owner_student_profile_id_idx
  on public.upload_sessions (owner_student_profile_id);

create index upload_sessions_status_idx
  on public.upload_sessions (status);

create unique index upload_sessions_storage_bucket_path_idx
  on public.upload_sessions (storage_bucket, storage_path);
