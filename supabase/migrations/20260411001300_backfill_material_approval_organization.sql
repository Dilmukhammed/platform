-- ============================================================================
-- Backfill material_approvals.organization_id for legacy rows
-- ============================================================================
-- Strategy:
--   Case 1: Org-scoped materials → copy materials.owner_organization_id
--   Case 2: Personal materials where requester has exactly one active
--            org membership → use that org
--   Case 3: Ambiguous (multiple memberships, no memberships, or other)
--            → leave organization_id NULL (reported via audit view)
--
-- The migration is idempotent: every UPDATE is gated on
--   material_approvals.organization_id IS NULL
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Step 1: Backfill org-scoped materials
--         These have a deterministic owner_organization_id on the material.
-- ---------------------------------------------------------------------------
update public.material_approvals
  set organization_id = m.owner_organization_id
from public.materials m
where m.id = material_approvals.material_id
  and m.scope_type = 'organization'
  and m.owner_organization_id is not null
  and material_approvals.organization_id is null;

-- ---------------------------------------------------------------------------
-- Step 2: Backfill personal materials where the requester has exactly one
--         active org membership.
--         We use a CTE that counts active memberships per requester and only
--         returns rows where the count is exactly 1.
-- ---------------------------------------------------------------------------
update public.material_approvals
  set organization_id = sor.organization_id
from public.materials m,
     (
       select
         om.platform_user_id,
         om.organization_id
       from public.organization_memberships om
       where om.deleted_at is null
         and om.status = 'active'
       group by om.platform_user_id, om.organization_id
     ) sor
where m.id = material_approvals.material_id
  and sor.platform_user_id = material_approvals.requested_by_platform_user_id
  and m.scope_type = 'personal'
  and material_approvals.organization_id is null
  -- Safety: requester has exactly one active org membership
  and (
    select count(*)
    from public.organization_memberships om2
    where om2.platform_user_id = material_approvals.requested_by_platform_user_id
      and om2.deleted_at is null
      and om2.status = 'active'
  ) = 1;

-- ---------------------------------------------------------------------------
-- Step 3: Create an audit view for unresolved rows (organization_id IS NULL
--         after the backfill).  This surfaces ambiguous legacy approvals so
--         admins can resolve them manually.
-- ---------------------------------------------------------------------------
create or replace view public.unresolved_material_approval_organizations as
select
  ma.id               as approval_id,
  ma.material_id,
  m.title             as material_title,
  m.scope_type,
  ma.requested_by_platform_user_id,
  pu.display_name     as requester_name,
  ma.decision,
  ma.created_at       as approval_created_at,
  (
    select count(*)
    from public.organization_memberships om
    where om.platform_user_id = ma.requested_by_platform_user_id
      and om.deleted_at is null
      and om.status = 'active'
  )                    as requester_active_org_count
from public.material_approvals ma
join public.materials m
  on m.id = ma.material_id
left join public.platform_users pu
  on pu.id = ma.requested_by_platform_user_id
where ma.organization_id is null
and ma.deleted_at is null
order by ma.created_at desc;

comment on view public.unresolved_material_approval_organizations is
  'Audit view: material_approvals rows where organization_id could not be backfilled. '
  'requester_active_org_count shows why (0 = no org, >1 = ambiguous). '
  'These approvals are excluded from school library visibility.';

-- ---------------------------------------------------------------------------
-- Step 4: Log backfill statistics to the console via RAISE NOTICE
-- ---------------------------------------------------------------------------
do $$
declare
  v_total_null     bigint;
  v_remaining_null bigint;
  v_backfilled     bigint;
begin
  select count(*) into v_remaining_null
  from public.material_approvals
  where organization_id is null
    and deleted_at is null;

  raise notice 'Backfill complete. Remaining unresolved material_approvals with organization_id IS NULL: %', v_remaining_null;
end;
$$;

commit;
