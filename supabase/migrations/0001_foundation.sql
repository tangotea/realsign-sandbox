-- RealSign V1 / Milestone 1 foundation
-- Supabase/PostgreSQL schema: accounts, roles, languages, provider shell,
-- admin permissions, audit trail, and private verification storage.

create extension if not exists pgcrypto;

create type public.app_role as enum ('learner', 'provider', 'admin');
create type public.admin_role as enum ('super', 'verification', 'support', 'finance');
create type public.language_modality as enum ('signed', 'spoken_written');
create type public.provider_status as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.languages (
  id smallserial primary key,
  code text not null unique,
  name text not null unique,
  modality public.language_modality not null,
  is_official_sa_language boolean not null default true,
  display_order smallint not null,
  active boolean not null default true
);

insert into public.languages (code, name, modality, display_order) values
  ('sasl', 'SASL', 'signed', 1),
  ('en', 'English', 'spoken_written', 2),
  ('af', 'Afrikaans', 'spoken_written', 3),
  ('nr', 'isiNdebele', 'spoken_written', 4),
  ('xh', 'isiXhosa', 'spoken_written', 5),
  ('zu', 'isiZulu', 'spoken_written', 6),
  ('nso', 'Sepedi', 'spoken_written', 7),
  ('st', 'Sesotho', 'spoken_written', 8),
  ('tn', 'Setswana', 'spoken_written', 9),
  ('ss', 'siSwati', 'spoken_written', 10),
  ('ve', 'Tshivenda', 'spoken_written', 11),
  ('ts', 'Xitsonga', 'spoken_written', 12)
on conflict (code) do nothing;

create table public.user_languages (
  user_id uuid not null references public.profiles(id) on delete cascade,
  language_id smallint not null references public.languages(id),
  created_at timestamptz not null default now(),
  primary key (user_id, language_id)
);

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.provider_status not null default 'draft',
  public_display_name text,
  introduction_text text,
  introduction_video_path text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.admin_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log(actor_user_id, created_at desc);
create index provider_profiles_status_idx on public.provider_profiles(status);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger provider_profiles_touch_updated_at
before update on public.provider_profiles
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'first_name', ''),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'learner');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles a
    where a.user_id = auth.uid()
      and a.is_active = true
  );
$$;

create or replace function public.record_admin_action(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.current_is_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason)
  returning id into new_id;

  return new_id;
end;
$$;

-- Row Level Security ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.languages enable row level security;
alter table public.user_languages enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_is_admin());

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "roles_select_self_or_admin"
on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.current_is_admin());

create policy "languages_public_read"
on public.languages for select to anon, authenticated
using (active = true);

create policy "user_languages_select_self_or_admin"
on public.user_languages for select to authenticated
using (user_id = auth.uid() or public.current_is_admin());

create policy "user_languages_insert_self"
on public.user_languages for insert to authenticated
with check (user_id = auth.uid());

create policy "user_languages_delete_self"
on public.user_languages for delete to authenticated
using (user_id = auth.uid());

create policy "provider_profile_public_read_approved"
on public.provider_profiles for select to anon, authenticated
using (status = 'approved' or user_id = auth.uid() or public.current_is_admin());

create policy "provider_profile_create_self"
on public.provider_profiles for insert to authenticated
with check (user_id = auth.uid());

create policy "provider_profile_update_self_draft"
on public.provider_profiles for update to authenticated
using (user_id = auth.uid() and status in ('draft', 'rejected'))
with check (user_id = auth.uid());

create policy "admin_profile_select_self_or_admin"
on public.admin_profiles for select to authenticated
using (user_id = auth.uid() or public.current_is_admin());

create policy "audit_admin_read"
on public.audit_log for select to authenticated
using (public.current_is_admin());

-- Storage -------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('provider-media', 'provider-media', false)
on conflict (id) do nothing;

create policy "verification_upload_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "verification_read_own_or_admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'verification-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.current_is_admin())
);

create policy "verification_delete_own_or_admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'verification-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.current_is_admin())
);

create policy "provider_media_upload_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'provider-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "provider_media_read_own_or_admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'provider-media'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.current_is_admin())
);
