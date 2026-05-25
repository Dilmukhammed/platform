-- T10: Organization invites schema
-- Table: organization_invites

-- ──────────────────────────────────────────────
-- organization_invites
-- ──────────────────────────────────────────────
-- Tracks invite tokens for joining organizations.
-- Used by the join-by-invite flow to validate tokens and create memberships.

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  token text not null,
  email text,
  role public.organization_membership_role_enum not null default 'teacher',
  status text not null default 'pending',
  invited_by_platform_user_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_invites_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint organization_invites_invited_by_platform_user_id_fkey
    foreign key (invited_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint organization_invites_token_check
    check (btrim(token) <> ''),
  constraint organization_invites_status_check
    check (btrim(status) <> '')
);

create index organization_invites_organization_id_idx
  on public.organization_invites (organization_id);

-- Unique token among non-deleted invites
create unique index organization_invites_token_unique_idx
  on public.organization_invites (token)
  where deleted_at is null;
