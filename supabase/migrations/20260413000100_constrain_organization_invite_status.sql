-- Constrain organization_invites.status to the intended invite lifecycle states.

alter table public.organization_invites
  drop constraint if exists organization_invites_status_check;

alter table public.organization_invites
  add constraint organization_invites_status_check
  check (status in ('pending', 'accepted', 'expired', 'cancelled'));
