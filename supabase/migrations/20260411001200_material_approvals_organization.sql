alter table public.material_approvals
  add column organization_id uuid;

alter table public.material_approvals
  add constraint material_approvals_organization_id_fkey
  foreign key (organization_id)
  references public.organizations (id)
  on update cascade
  on delete restrict;

create index material_approvals_material_organization_created_at_idx
  on public.material_approvals (material_id, organization_id, created_at desc)
  where deleted_at is null;

create unique index material_approvals_pending_material_organization_idx
  on public.material_approvals (material_id, organization_id)
  where deleted_at is null
    and decision = 'pending';
