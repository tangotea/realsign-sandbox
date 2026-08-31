-- RealSign V1 / Milestone 8
-- Store private learner identity evidence and allow safe self-service replacement.

alter table public.user_identity_verifications
  add column if not exists storage_path text,
  add column if not exists submitted_at timestamptz;

drop policy if exists "identity_self_restart" on public.user_identity_verifications;
create policy "identity_self_restart" on public.user_identity_verifications for update to authenticated
using(
  user_id=auth.uid()
  and state in ('not_started','pending','rejected','needs_information')
)
with check(
  user_id=auth.uid()
  and (
    (state='pending' and (storage_path is null or split_part(storage_path,'/',1)=auth.uid()::text))
    or (state='not_started' and storage_path is null)
  )
);
