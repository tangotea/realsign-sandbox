-- RealSign V1 / Milestone 2
-- Provider marketplace: roles, verification, subjects, services, pricing,
-- availability, booking settings, invitations, and admin review controls.

create type public.provider_role_type as enum ('deaf_tutor', 'qualified_deaf_teacher', 'interpreter');
create type public.verification_type as enum ('identity', 'deaf', 'teacher_qualification', 'interpreter_assessment');
create type public.verification_state as enum ('not_submitted', 'pending', 'approved', 'rejected', 'needs_information');
create type public.service_status as enum ('draft', 'active', 'paused', 'archived');
create type public.availability_exception_type as enum ('blocked', 'extra');

create table public.provider_roles (
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  role public.provider_role_type not null,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (provider_id, role)
);

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  type public.verification_type not null,
  state public.verification_state not null default 'not_submitted',
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  internal_note text,
  retention_delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, type)
);

create trigger verification_records_touch_updated_at
before update on public.verification_records
for each row execute function public.touch_updated_at();

create table public.provider_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  min_grade smallint,
  max_grade smallint,
  phase text not null,
  active boolean not null default true,
  display_order smallint not null default 100
);

insert into public.subjects(code,name,min_grade,max_grade,phase,display_order) values
  ('sasl-r12','SASL Home Language',0,12,'R-12',1),
  ('home-language-r3','Home Language',0,3,'Foundation',2),
  ('first-additional-language-r3','First Additional Language',1,3,'Foundation',3),
  ('mathematics-r3','Mathematics',0,3,'Foundation',4),
  ('life-skills-r3','Life Skills',0,3,'Foundation',5),
  ('coding-robotics-r3','Coding and Robotics',0,3,'Foundation',6),
  ('home-language-46','Home Language',4,6,'Intermediate',10),
  ('first-additional-language-46','First Additional Language',4,6,'Intermediate',11),
  ('second-additional-language-46','Second Additional Language',4,6,'Intermediate',12),
  ('mathematics-46','Mathematics',4,6,'Intermediate',13),
  ('natural-sciences-technology-46','Natural Sciences and Technology',4,6,'Intermediate',14),
  ('social-sciences-46','Social Sciences',4,6,'Intermediate',15),
  ('life-skills-46','Life Skills',4,6,'Intermediate',16),
  ('coding-robotics-46','Coding and Robotics',4,6,'Intermediate',17),
  ('home-language-79','Home Language',7,9,'Senior',20),
  ('first-additional-language-79','First Additional Language',7,9,'Senior',21),
  ('second-additional-language-79','Second Additional Language',7,9,'Senior',22),
  ('mathematics-79','Mathematics',7,9,'Senior',23),
  ('natural-sciences-79','Natural Sciences',7,9,'Senior',24),
  ('social-sciences-79','Social Sciences',7,9,'Senior',25),
  ('technology-79','Technology',7,9,'Senior',26),
  ('ems-79','Economic and Management Sciences',7,9,'Senior',27),
  ('creative-arts-79','Creative Arts',7,9,'Senior',28),
  ('life-orientation-79','Life Orientation',7,9,'Senior',29),
  ('coding-robotics-79','Coding and Robotics',7,9,'Senior',30),
  ('accounting-1012','Accounting',10,12,'FET',40),
  ('agricultural-management-practices-1012','Agricultural Management Practices',10,12,'FET',41),
  ('agricultural-sciences-1012','Agricultural Sciences',10,12,'FET',42),
  ('agricultural-technology-1012','Agricultural Technology',10,12,'FET',43),
  ('business-studies-1012','Business Studies',10,12,'FET',44),
  ('civil-technology-1012','Civil Technology',10,12,'FET',45),
  ('computer-applications-technology-1012','Computer Applications Technology',10,12,'FET',46),
  ('consumer-studies-1012','Consumer Studies',10,12,'FET',47),
  ('dance-studies-1012','Dance Studies',10,12,'FET',48),
  ('design-1012','Design',10,12,'FET',49),
  ('dramatic-arts-1012','Dramatic Arts',10,12,'FET',50),
  ('economics-1012','Economics',10,12,'FET',51),
  ('electrical-technology-1012','Electrical Technology',10,12,'FET',52),
  ('engineering-graphics-design-1012','Engineering Graphics and Design',10,12,'FET',53),
  ('geography-1012','Geography',10,12,'FET',54),
  ('history-1012','History',10,12,'FET',55),
  ('hospitality-studies-1012','Hospitality Studies',10,12,'FET',56),
  ('information-technology-1012','Information Technology',10,12,'FET',57),
  ('life-orientation-1012','Life Orientation',10,12,'FET',58),
  ('life-sciences-1012','Life Sciences',10,12,'FET',59),
  ('marine-sciences-1012','Marine Sciences',10,12,'FET',60),
  ('maritime-economics-1012','Maritime Economics',10,12,'FET',61),
  ('mathematical-literacy-1012','Mathematical Literacy',10,12,'FET',62),
  ('mathematics-1012','Mathematics',10,12,'FET',63),
  ('mechanical-technology-1012','Mechanical Technology',10,12,'FET',64),
  ('music-1012','Music',10,12,'FET',65),
  ('nautical-science-1012','Nautical Science',10,12,'FET',66),
  ('physical-sciences-1012','Physical Sciences',10,12,'FET',67),
  ('religion-studies-1012','Religion Studies',10,12,'FET',68),
  ('sport-exercise-science-1012','Sport and Exercise Science',10,12,'FET',69),
  ('technical-mathematics-1012','Technical Mathematics',10,12,'FET',70),
  ('technical-sciences-1012','Technical Sciences',10,12,'FET',71),
  ('tourism-1012','Tourism',10,12,'FET',72),
  ('visual-arts-1012','Visual Arts',10,12,'FET',73),
  ('languages-1012','Languages',10,12,'FET',74),
  ('other-adult','Other / Adult Learning',null,null,'Adult / Other',90)
on conflict (code) do nothing;

create table public.provider_subjects (
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  min_grade smallint,
  max_grade smallint,
  homework_help boolean not null default false,
  general_tutoring boolean not null default true,
  exam_preparation boolean not null default false,
  qualification_verified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(provider_id, subject_id)
);

create table public.rate_rules (
  id uuid primary key default gen_random_uuid(),
  provider_role public.provider_role_type not null,
  duration_min smallint not null check (duration_min in (30,45,60,90)),
  min_price_cents integer not null check (min_price_cents >= 0),
  max_price_cents integer not null check (max_price_cents >= min_price_cents),
  active boolean not null default true,
  unique(provider_role, duration_min)
);

-- Illustrative defaults only; Admin can change before launch.
insert into public.rate_rules(provider_role,duration_min,min_price_cents,max_price_cents) values
 ('deaf_tutor',30,10000,30000),('deaf_tutor',45,15000,45000),('deaf_tutor',60,18000,60000),
 ('qualified_deaf_teacher',30,15000,45000),('qualified_deaf_teacher',45,22000,65000),('qualified_deaf_teacher',60,28000,85000),
 ('interpreter',30,15000,50000),('interpreter',60,25000,90000),('interpreter',90,35000,130000)
on conflict do nothing;

create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  provider_role public.provider_role_type not null,
  subject_id uuid references public.subjects(id),
  title text not null,
  support_type text,
  min_grade smallint,
  max_grade smallint,
  duration_min smallint not null check (duration_min in (30,45,60,90)),
  price_cents integer not null check(price_cents >= 0),
  remote boolean not null default true,
  in_person boolean not null default false,
  status public.service_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger provider_services_touch_updated_at
before update on public.provider_services
for each row execute function public.touch_updated_at();

create table public.provider_booking_settings (
  provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
  booking_notice_min integer not null default 120 check (booking_notice_min >= 60),
  buffer_min integer not null default 15 check (buffer_min >= 15),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger provider_booking_settings_touch_updated_at
before update on public.provider_booking_settings
for each row execute function public.touch_updated_at();

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check(end_time > start_time)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  date date not null,
  type public.availability_exception_type not null,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  check((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time))
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.platform_settings(key,value) values
 ('minimum_booking_notice_min','60'::jsonb),
 ('default_booking_notice_min','120'::jsonb),
 ('minimum_buffer_min','15'::jsonb),
 ('checkout_hold_min','5'::jsonb),
 ('video_wrapup_min','2'::jsonb)
on conflict(key) do nothing;

-- Fix Milestone 1 provider-status escalation gap.
drop policy if exists "provider_profile_update_self_draft" on public.provider_profiles;
create policy "provider_profile_update_self_before_approval"
on public.provider_profiles for update to authenticated
using (user_id = auth.uid() and status in ('draft','rejected'))
with check (user_id = auth.uid() and status in ('draft','pending','rejected'));

create policy "provider_profile_admin_update"
on public.provider_profiles for update to authenticated
using (public.current_is_admin())
with check (public.current_is_admin());

create policy "roles_provider_insert_self"
on public.user_roles for insert to authenticated
with check (user_id = auth.uid() and role = 'provider');

alter table public.provider_roles enable row level security;
alter table public.verification_records enable row level security;
alter table public.provider_invitations enable row level security;
alter table public.subjects enable row level security;
alter table public.provider_subjects enable row level security;
alter table public.rate_rules enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_booking_settings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.platform_settings enable row level security;

create policy "provider_roles_read_public_or_self_admin" on public.provider_roles for select to anon, authenticated
using (
  exists(select 1 from public.provider_profiles p where p.id=provider_id and (p.status='approved' or p.user_id=auth.uid() or public.current_is_admin()))
);
create policy "provider_roles_insert_self" on public.provider_roles for insert to authenticated
with check (exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid() and p.status in ('draft','rejected')));
create policy "provider_roles_delete_self_before_approval" on public.provider_roles for delete to authenticated
using (exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid() and p.status in ('draft','rejected')));
create policy "provider_roles_admin_update" on public.provider_roles for update to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());

create policy "verification_read_self_admin" on public.verification_records for select to authenticated
using (exists(select 1 from public.provider_profiles p where p.id=provider_id and (p.user_id=auth.uid() or public.current_is_admin())));
create policy "verification_insert_self" on public.verification_records for insert to authenticated
with check (exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "verification_update_self_pending" on public.verification_records for update to authenticated
using (exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) and state in ('not_submitted','needs_information','rejected'))
with check (state in ('pending','not_submitted'));
create policy "verification_admin_update" on public.verification_records for update to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());

create policy "subjects_public_read" on public.subjects for select to anon,authenticated using(active=true);
create policy "rate_rules_read" on public.rate_rules for select to anon,authenticated using(active=true or public.current_is_admin());
create policy "rate_rules_admin_all" on public.rate_rules for all to authenticated using(public.current_is_admin()) with check(public.current_is_admin());

create policy "provider_subjects_read" on public.provider_subjects for select to anon,authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and (p.status='approved' or p.user_id=auth.uid() or public.current_is_admin())));
create policy "provider_subjects_insert_self" on public.provider_subjects for insert to authenticated
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid() and p.status in ('draft','rejected')));
create policy "provider_subjects_update_self" on public.provider_subjects for update to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid() and p.status in ('draft','rejected')))
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "provider_subjects_delete_self" on public.provider_subjects for delete to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid() and p.status in ('draft','rejected')));
create policy "provider_subjects_admin_update" on public.provider_subjects for update to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());

create policy "services_read_public_self_admin" on public.provider_services for select to anon,authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and ((p.status='approved' and status='active') or p.user_id=auth.uid() or public.current_is_admin())));
create policy "services_insert_self" on public.provider_services for insert to authenticated
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "services_update_self" on public.provider_services for update to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()))
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "services_delete_self" on public.provider_services for delete to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "services_admin_all" on public.provider_services for all to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());

create policy "booking_settings_self_admin" on public.provider_booking_settings for select to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and (p.user_id=auth.uid() or public.current_is_admin())));
create policy "booking_settings_insert_self" on public.provider_booking_settings for insert to authenticated
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "booking_settings_update_self" on public.provider_booking_settings for update to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()))
with check(booking_notice_min >= 60 and buffer_min >=15);

create policy "availability_self_admin_read" on public.availability_rules for select to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and (p.user_id=auth.uid() or public.current_is_admin())));
create policy "availability_self_insert" on public.availability_rules for insert to authenticated
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "availability_self_update" on public.availability_rules for update to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()))
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "availability_self_delete" on public.availability_rules for delete to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));

create policy "exceptions_self_admin_read" on public.availability_exceptions for select to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and (p.user_id=auth.uid() or public.current_is_admin())));
create policy "exceptions_self_insert" on public.availability_exceptions for insert to authenticated
with check(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create policy "exceptions_self_delete" on public.availability_exceptions for delete to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));

create policy "settings_public_read" on public.platform_settings for select to anon,authenticated using(true);
create policy "settings_admin_all" on public.platform_settings for all to authenticated using(public.current_is_admin()) with check(public.current_is_admin());

-- Invitations are intentionally admin-readable and inviter-readable only in V1.
create policy "invites_read_inviter_admin" on public.provider_invitations for select to authenticated
using(exists(select 1 from public.provider_profiles p where p.id=inviter_provider_id and (p.user_id=auth.uid() or public.current_is_admin())));

-- Admin can read and update availability/booking settings for support.
create policy "booking_settings_admin_update" on public.provider_booking_settings for update to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());
create policy "availability_admin_all" on public.availability_rules for all to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());
create policy "exceptions_admin_all" on public.availability_exceptions for all to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());

create or replace function public.ensure_provider_application()
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  p_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select id into p_id from public.provider_profiles where user_id=auth.uid();
  if p_id is null then
    insert into public.provider_profiles(user_id, public_display_name)
    select auth.uid(), coalesce(display_name,first_name,'Provider') from public.profiles where id=auth.uid()
    returning id into p_id;
    insert into public.user_roles(user_id,role) values(auth.uid(),'provider') on conflict do nothing;
    insert into public.provider_booking_settings(provider_id) values(p_id) on conflict do nothing;
  end if;
  return p_id;
end;
$$;

create or replace function public.submit_provider_application()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare p_id uuid;
begin
  select id into p_id from public.provider_profiles where user_id=auth.uid();
  if p_id is null then raise exception 'Provider application not found'; end if;
  if not exists(select 1 from public.provider_roles where provider_id=p_id) then raise exception 'Choose at least one provider role'; end if;
  update public.provider_profiles set status='pending' where id=p_id and status in ('draft','rejected');
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data)
  values(auth.uid(),'provider_application_submitted','provider_profile',p_id::text,jsonb_build_object('status','pending'));
end;
$$;

create or replace function public.admin_review_provider(p_provider_id uuid, p_status public.provider_status, p_reason text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare old_status public.provider_status;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('approved','rejected','suspended','pending') then raise exception 'Invalid admin review status'; end if;
  select status into old_status from public.provider_profiles where id=p_provider_id;
  update public.provider_profiles set status=p_status, approved_at=case when p_status='approved' then now() else approved_at end where id=p_provider_id;
  if p_status='approved' then
    update public.provider_roles set approved=true, approved_at=now() where provider_id=p_provider_id;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(auth.uid(),'provider_status_changed','provider_profile',p_provider_id::text,jsonb_build_object('status',old_status),jsonb_build_object('status',p_status),p_reason);
end;
$$;

create index verification_provider_state_idx on public.verification_records(provider_id,state);
create index provider_services_provider_status_idx on public.provider_services(provider_id,status);
create index availability_provider_weekday_idx on public.availability_rules(provider_id,weekday);
create index subjects_phase_idx on public.subjects(phase,display_order);


create or replace function public.admin_review_verification(p_verification_id uuid, p_state public.verification_state, p_note text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare old_state public.verification_state;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_state not in ('approved','rejected','needs_information','pending') then raise exception 'Invalid verification state'; end if;
  select state into old_state from public.verification_records where id=p_verification_id;
  update public.verification_records
  set state=p_state, reviewed_at=now(), reviewed_by=auth.uid(), internal_note=coalesce(p_note,internal_note)
  where id=p_verification_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(auth.uid(),'verification_state_changed','verification_record',p_verification_id::text,jsonb_build_object('state',old_state),jsonb_build_object('state',p_state),p_note);
end;
$$;
