-- RealSign V1 / admin account lifecycle controls
-- Archive hides an account without removing history. Block also prevents future
-- signups with the same email; a future KYC integration can add an identity key.

alter table public.profiles
  add column if not exists account_state text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists account_state_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_state_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_state_check
      check (account_state in ('active', 'archived', 'blocked'));
  end if;
end;
$$;

create index if not exists profiles_account_state_idx
  on public.profiles(account_state, created_at desc);

create table if not exists public.account_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email_normalized text not null,
  identity_match_key text,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists account_blocks_active_email_idx
  on public.account_blocks(email_normalized)
  where lifted_at is null;

create index if not exists account_blocks_identity_idx
  on public.account_blocks(identity_match_key)
  where identity_match_key is not null and lifted_at is null;

alter table public.account_blocks enable row level security;

create or replace function public.reject_blocked_email_signup()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is not null and exists (
    select 1
    from public.account_blocks
    where email_normalized = lower(trim(new.email))
      and lifted_at is null
  ) then
    raise exception 'This email cannot be used to create a RealSign account';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_blocked_email_before_signup on auth.users;
create trigger reject_blocked_email_before_signup
before insert on auth.users
for each row execute function public.reject_blocked_email_signup();

drop policy if exists "provider_profile_public_read_approved" on public.provider_profiles;
create policy "provider_profile_public_read_approved"
on public.provider_profiles for select to anon, authenticated
using (
  (
    status = 'approved'
    and exists (
      select 1 from public.profiles profile
      where profile.id = provider_profiles.user_id
        and profile.account_state = 'active'
    )
  )
  or user_id = auth.uid()
  or public.current_is_admin()
);

drop policy if exists "services_read_public_self_admin" on public.provider_services;
create policy "services_read_public_self_admin"
on public.provider_services for select to anon, authenticated
using (
  exists (
    select 1 from public.provider_profiles provider
    join public.profiles profile on profile.id = provider.user_id
    where provider.id = provider_services.provider_id
      and (
        (provider.status = 'approved' and provider_services.status = 'active' and profile.account_state = 'active')
        or provider.user_id = auth.uid()
        or public.current_is_admin()
      )
  )
);
