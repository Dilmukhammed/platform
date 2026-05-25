create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status public.organization_status_enum not null default 'pending',
  created_by_platform_user_id uuid not null,
  approved_by_platform_user_id uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_created_by_platform_user_id_fkey
    foreign key (created_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint organizations_approved_by_platform_user_id_fkey
    foreign key (approved_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint organizations_approval_fields_check
    check (
      (approved_by_platform_user_id is null and approved_at is null)
      or (approved_by_platform_user_id is not null and approved_at is not null)
    )
);

create index organizations_created_by_platform_user_id_idx
  on public.organizations (created_by_platform_user_id);

create index organizations_approved_by_platform_user_id_idx
  on public.organizations (approved_by_platform_user_id);

create unique index organizations_slug_active_idx
  on public.organizations (slug)
  where deleted_at is null
    and status in ('pending', 'active', 'suspended');

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  platform_user_id uuid not null,
  role public.organization_membership_role_enum not null,
  status public.organization_membership_status_enum not null default 'pending',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_memberships_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint organization_memberships_platform_user_id_fkey
    foreign key (platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict
);

create index organization_memberships_organization_id_idx
  on public.organization_memberships (organization_id);

create index organization_memberships_platform_user_id_idx
  on public.organization_memberships (platform_user_id);

create unique index organization_memberships_active_user_org_idx
  on public.organization_memberships (organization_id, platform_user_id)
  where deleted_at is null
    and status = 'active';
