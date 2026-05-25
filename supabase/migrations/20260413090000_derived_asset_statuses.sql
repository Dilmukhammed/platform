alter table public.derived_assets
  add column if not exists derivation_status text not null default 'ready',
  add column if not exists error_message text,
  add column if not exists source_storage_bucket text,
  add column if not exists source_storage_path text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'derived_assets_derivation_status_check'
  ) then
    alter table public.derived_assets
      add constraint derived_assets_derivation_status_check
      check (derivation_status in ('pending', 'processing', 'ready', 'failed'));
  end if;
end $$;

alter table public.derived_assets
  drop constraint if exists derived_assets_byte_size_check;

alter table public.derived_assets
  add constraint derived_assets_byte_size_check
  check (byte_size is null or byte_size >= 0);

update public.derived_assets
set derivation_status = 'ready'
where derivation_status is distinct from 'ready'
  and deleted_at is null;
