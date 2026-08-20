-- RealSign V1 / Milestone 3
-- Learner marketplace, public provider discovery, time-zone-aware slot generation,
-- checkout reservations, database-level double-booking protection, and booking shell.

create extension if not exists btree_gist;

create type public.identity_verification_state as enum ('not_started','pending','approved','rejected','needs_information');
create type public.reservation_state as enum ('hold','booked','released','expired','cancelled');
create type public.booking_state as enum (
  'confirmed','in_session','completed','cancelled_by_learner','cancelled_by_provider',
  'no_show_learner','no_show_provider','technical_failure','disputed','refunded',
  'partially_refunded','rescheduled'
);
create type public.reschedule_state as enum ('pending','accepted','declined','cancelled','expired');

-- Learners must eventually pass the selected KYC provider before a paid booking can be finalised.
create table public.user_identity_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state public.identity_verification_state not null default 'not_started',
  provider_reference text,
  verified_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_identity_verifications_touch_updated_at
before update on public.user_identity_verifications
for each row execute function public.touch_updated_at();

alter table public.provider_booking_settings
  add column if not exists timezone text not null default 'Africa/Johannesburg';

-- Reservation rows are the single source of truth for provider time occupancy.
-- A hold and a confirmed booking therefore cannot race each other in separate tables.
create table public.booking_reservations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  service_id uuid not null references public.provider_services(id) on delete restrict,
  learner_user_id uuid not null references public.profiles(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  block_end_at timestamptz not null,
  price_cents_snapshot integer not null check(price_cents_snapshot >= 0),
  learner_for text not null default 'myself' check(learner_for in ('myself','child_or_dependent','assisted_person')),
  learner_first_name text,
  learner_grade smallint,
  learner_note text,
  state public.reservation_state not null default 'hold',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_at > start_at),
  check(block_end_at >= end_at),
  check((state <> 'hold') or expires_at is not null)
);

create trigger booking_reservations_touch_updated_at
before update on public.booking_reservations
for each row execute function public.touch_updated_at();

alter table public.booking_reservations
  add constraint booking_reservations_no_provider_overlap
  exclude using gist (
    provider_id with =,
    tstzrange(start_at, block_end_at, '[)') with &&
  ) where (state in ('hold','booked'));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('RS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  reservation_id uuid not null unique references public.booking_reservations(id) on delete restrict,
  learner_user_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  service_id uuid not null references public.provider_services(id) on delete restrict,
  state public.booking_state not null default 'confirmed',
  start_at timestamptz not null,
  end_at timestamptz not null,
  price_cents integer not null check(price_cents >= 0),
  learner_for text not null default 'myself' check(learner_for in ('myself','child_or_dependent','assisted_person')),
  learner_first_name text,
  learner_grade smallint,
  learner_note text,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

create table public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  state public.reschedule_state not null default 'pending',
  note text,
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check(proposed_end_at > proposed_start_at)
);

create index booking_reservations_provider_time_idx on public.booking_reservations(provider_id,start_at,state);
create index booking_reservations_learner_idx on public.booking_reservations(learner_user_id,created_at desc);
create index bookings_learner_start_idx on public.bookings(learner_user_id,start_at desc);
create index bookings_provider_start_idx on public.bookings(provider_id,start_at desc);
create index bookings_state_idx on public.bookings(state,start_at);

-- Public marketplace output intentionally exposes only approved public profile data.
create or replace function public.search_marketplace_providers(
  p_subject_id uuid default null,
  p_grade smallint default null,
  p_language_code text default null,
  p_role public.provider_role_type default null,
  p_limit integer default 30
)
returns table (
  provider_id uuid,
  public_display_name text,
  introduction_text text,
  introduction_video_path text,
  roles text[],
  languages text[],
  subject_names text[],
  min_price_cents integer,
  sample_service_id uuid,
  sample_service_title text,
  sample_duration_min smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select distinct p.id
    from public.provider_profiles p
    join public.provider_roles pr on pr.provider_id=p.id and pr.approved=true
    join public.provider_services s on s.provider_id=p.id and s.status='active'
    left join public.provider_subjects ps on ps.provider_id=p.id
    left join public.subjects sub on sub.id=ps.subject_id
    where p.status='approved'
      and (p_role is null or pr.role=p_role)
      and (p_subject_id is null or s.subject_id=p_subject_id or ps.subject_id=p_subject_id)
      and (
        p_grade is null
        or ((s.min_grade is null or s.min_grade <= p_grade) and (s.max_grade is null or s.max_grade >= p_grade))
        or ((ps.min_grade is null or ps.min_grade <= p_grade) and (ps.max_grade is null or ps.max_grade >= p_grade))
      )
      and (
        p_language_code is null
        or exists (
          select 1 from public.user_languages ul
          join public.languages l on l.id=ul.language_id
          where ul.user_id=p.user_id and l.code=p_language_code and l.active=true
        )
      )
  ), service_pick as (
    select distinct on (s.provider_id)
      s.provider_id, s.id, s.title, s.duration_min, s.price_cents
    from public.provider_services s
    join eligible e on e.id=s.provider_id
    where s.status='active'
      and (p_subject_id is null or s.subject_id=p_subject_id)
      and (p_grade is null or ((s.min_grade is null or s.min_grade <= p_grade) and (s.max_grade is null or s.max_grade >= p_grade)))
    order by s.provider_id, s.price_cents asc, s.duration_min asc, s.created_at asc
  )
  select
    p.id,
    coalesce(nullif(p.public_display_name,''),'RealSign Provider'),
    p.introduction_text,
    p.introduction_video_path,
    array(select distinct replace(pr.role::text,'_',' ') from public.provider_roles pr where pr.provider_id=p.id and pr.approved=true order by 1),
    array(select l.name from public.user_languages ul join public.languages l on l.id=ul.language_id where ul.user_id=p.user_id and l.active=true order by l.display_order),
    array(select distinct sub.name from public.provider_subjects ps join public.subjects sub on sub.id=ps.subject_id where ps.provider_id=p.id and sub.active=true order by 1),
    sp.price_cents,
    sp.id,
    sp.title,
    sp.duration_min
  from eligible e
  join public.provider_profiles p on p.id=e.id
  join service_pick sp on sp.provider_id=p.id
  order by sp.price_cents asc, p.public_display_name asc
  limit greatest(1,least(coalesce(p_limit,30),100));
$$;

grant execute on function public.search_marketplace_providers(uuid,smallint,text,public.provider_role_type,integer) to anon, authenticated;

create or replace function public.get_public_provider(p_provider_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',p.id,
    'display_name',coalesce(nullif(p.public_display_name,''),'RealSign Provider'),
    'introduction_text',p.introduction_text,
    'introduction_video_path',p.introduction_video_path,
    'verification_badges',(select coalesce(jsonb_agg(v.type order by v.type),'[]'::jsonb) from public.verification_records v where v.provider_id=p.id and v.state='approved'),
    'roles',(select coalesce(jsonb_agg(jsonb_build_object('role',pr.role,'approved',pr.approved) order by pr.role), '[]'::jsonb) from public.provider_roles pr where pr.provider_id=p.id and pr.approved=true),
    'languages',(select coalesce(jsonb_agg(jsonb_build_object('code',l.code,'name',l.name,'modality',l.modality) order by l.display_order),'[]'::jsonb) from public.user_languages ul join public.languages l on l.id=ul.language_id where ul.user_id=p.user_id and l.active=true),
    'subjects',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'phase',s.phase,'min_grade',ps.min_grade,'max_grade',ps.max_grade,'homework_help',ps.homework_help,'general_tutoring',ps.general_tutoring,'exam_preparation',ps.exam_preparation,'qualification_verified',ps.qualification_verified) order by s.display_order),'[]'::jsonb) from public.provider_subjects ps join public.subjects s on s.id=ps.subject_id where ps.provider_id=p.id and s.active=true),
    'services',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'provider_role',s.provider_role,'subject_id',s.subject_id,'duration_min',s.duration_min,'price_cents',s.price_cents,'remote',s.remote,'in_person',s.in_person) order by s.price_cents,s.duration_min),'[]'::jsonb) from public.provider_services s where s.provider_id=p.id and s.status='active'),
    'booking_settings',(select jsonb_build_object('booking_notice_min',pbs.booking_notice_min,'buffer_min',pbs.buffer_min,'timezone',pbs.timezone) from public.provider_booking_settings pbs where pbs.provider_id=p.id)
  )
  from public.provider_profiles p
  where p.id=p_provider_id and p.status='approved';
$$;

grant execute on function public.get_public_provider(uuid) to anon, authenticated;

-- Generate genuine slots on the server in the provider's own time zone.
create or replace function public.get_service_slots(p_service_id uuid, p_date date)
returns table(start_at timestamptz, end_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
  v_duration integer;
  v_notice integer;
  v_buffer integer;
  v_timezone text;
  v_date_blocked boolean;
begin
  select s.provider_id,s.duration_min,pbs.booking_notice_min,pbs.buffer_min,pbs.timezone
  into v_provider,v_duration,v_notice,v_buffer,v_timezone
  from public.provider_services s
  join public.provider_profiles p on p.id=s.provider_id and p.status='approved'
  join public.provider_booking_settings pbs on pbs.provider_id=s.provider_id
  where s.id=p_service_id and s.status='active';

  if v_provider is null then return; end if;

  select exists(
    select 1 from public.availability_exceptions ae
    where ae.provider_id=v_provider and ae.date=p_date and ae.type='blocked'
      and ae.start_time is null and ae.end_time is null
  ) into v_date_blocked;

  if v_date_blocked then return; end if;

  return query
  with windows as (
    select ar.start_time, ar.end_time
    from public.availability_rules ar
    where ar.provider_id=v_provider and ar.active=true
      and ar.weekday=extract(dow from p_date)::smallint
    union all
    select ae.start_time, ae.end_time
    from public.availability_exceptions ae
    where ae.provider_id=v_provider and ae.date=p_date and ae.type='extra'
      and ae.start_time is not null and ae.end_time is not null
  ), candidates as (
    select gs as slot_start, gs + make_interval(mins=>v_duration) as slot_end
    from windows w
    cross join lateral generate_series(
      ((p_date::text || ' ' || w.start_time::text)::timestamp at time zone v_timezone),
      ((p_date::text || ' ' || w.end_time::text)::timestamp at time zone v_timezone) - make_interval(mins=>v_duration),
      make_interval(mins=>v_duration + v_buffer)
    ) gs
  )
  select distinct c.slot_start, c.slot_end
  from candidates c
  where c.slot_start >= now() + make_interval(mins=>v_notice)
    and not exists(
      select 1 from public.availability_exceptions ae
      where ae.provider_id=v_provider and ae.date=p_date and ae.type='blocked'
        and ae.start_time is not null and ae.end_time is not null
        and tstzrange(c.slot_start,c.slot_end,'[)') && tstzrange(
          ((p_date::text || ' ' || ae.start_time::text)::timestamp at time zone v_timezone),
          ((p_date::text || ' ' || ae.end_time::text)::timestamp at time zone v_timezone),'[)'
        )
    )
    and not exists(
      select 1 from public.booking_reservations br
      where br.provider_id=v_provider
        and (br.state='booked' or (br.state='hold' and br.expires_at>now()))
        and tstzrange(c.slot_start,c.slot_end + make_interval(mins=>v_buffer),'[)') && tstzrange(br.start_at,br.block_end_at,'[)')
    )
  order by c.slot_start;
end;
$$;

grant execute on function public.get_service_slots(uuid,date) to anon, authenticated;

create or replace function public.release_expired_booking_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update public.booking_reservations
  set state='expired'
  where state='hold' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.release_expired_booking_holds() to anon, authenticated;

create or replace function public.create_booking_hold(
  p_service_id uuid,
  p_start_at timestamptz,
  p_learner_for text default 'myself',
  p_learner_first_name text default null,
  p_learner_grade smallint default null,
  p_learner_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
  v_duration integer;
  v_price integer;
  v_buffer integer;
  v_timezone text;
  v_hold_min integer := 5;
  v_end_at timestamptz;
  v_id uuid;
  v_expires timestamptz;
  v_local_date date;
  v_identity public.identity_verification_state;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_learner_for not in ('myself','child_or_dependent','assisted_person') then raise exception 'Invalid learner type'; end if;

  select state into v_identity from public.user_identity_verifications where user_id=auth.uid();
  if coalesce(v_identity,'not_started') <> 'approved' then raise exception 'Identity verification required before booking'; end if;

  perform public.release_expired_booking_holds();

  select s.provider_id,s.duration_min,s.price_cents,pbs.buffer_min,pbs.timezone
  into v_provider,v_duration,v_price,v_buffer,v_timezone
  from public.provider_services s
  join public.provider_profiles p on p.id=s.provider_id and p.status='approved'
  join public.provider_booking_settings pbs on pbs.provider_id=s.provider_id
  where s.id=p_service_id and s.status='active';

  if v_provider is null then raise exception 'Service is not bookable'; end if;
  if exists(select 1 from public.provider_profiles p where p.id=v_provider and p.user_id=auth.uid()) then raise exception 'You cannot book yourself'; end if;

  v_end_at := p_start_at + make_interval(mins=>v_duration);
  v_local_date := (p_start_at at time zone v_timezone)::date;

  if not exists(select 1 from public.get_service_slots(p_service_id,v_local_date) s where s.start_at=p_start_at and s.end_at=v_end_at) then
    raise exception 'This time is no longer available';
  end if;

  select coalesce((value #>> '{}')::integer,5) into v_hold_min from public.platform_settings where key='checkout_hold_min';
  v_hold_min := coalesce(v_hold_min,5);
  v_expires := now() + make_interval(mins=>v_hold_min);

  begin
    insert into public.booking_reservations(provider_id,service_id,learner_user_id,start_at,end_at,block_end_at,price_cents_snapshot,learner_for,learner_first_name,learner_grade,learner_note,state,expires_at)
    values(v_provider,p_service_id,auth.uid(),p_start_at,v_end_at,v_end_at+make_interval(mins=>v_buffer),v_price,p_learner_for,p_learner_first_name,p_learner_grade,p_learner_note,'hold',v_expires)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'This time has just been reserved by someone else';
  end;

  return jsonb_build_object('hold_id',v_id,'expires_at',v_expires,'price_cents',v_price,'start_at',p_start_at,'end_at',v_end_at);
end;
$$;

grant execute on function public.create_booking_hold(uuid,timestamptz,text,text,smallint,text) to authenticated;

create or replace function public.release_own_booking_hold(p_hold_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.booking_reservations set state='released'
  where id=p_hold_id and learner_user_id=auth.uid() and state='hold';
end;
$$;

grant execute on function public.release_own_booking_hold(uuid) to authenticated;

-- Payment webhook / trusted server finalises a reservation. Never exposed to ordinary users.
create or replace function public.finalize_booking_from_hold(p_hold_id uuid, p_payment_reference text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.booking_reservations%rowtype;
  b_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into r from public.booking_reservations where id=p_hold_id for update;
  if r.id is null or r.state <> 'hold' or r.expires_at <= now() then raise exception 'Booking hold is not valid'; end if;
  update public.booking_reservations set state='booked',expires_at=null where id=r.id;
  insert into public.bookings(reservation_id,learner_user_id,provider_id,service_id,start_at,end_at,price_cents,learner_for,learner_first_name,learner_grade,learner_note,payment_reference)
  values(r.id,r.learner_user_id,r.provider_id,r.service_id,r.start_at,r.end_at,r.price_cents_snapshot,r.learner_for,r.learner_first_name,r.learner_grade,r.learner_note,p_payment_reference)
  returning id into b_id;
  return b_id;
end;
$$;

revoke all on function public.finalize_booking_from_hold(uuid,text) from public, anon, authenticated;
grant execute on function public.finalize_booking_from_hold(uuid,text) to service_role;


-- Harden provider approval: public provider status cannot imply badges that were never verified.
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
  if p_status='approved' then
    if not exists(select 1 from public.verification_records where provider_id=p_provider_id and type='identity' and state='approved') then raise exception 'Provider identity verification must be approved first'; end if;
    if exists(select 1 from public.provider_roles where provider_id=p_provider_id and role in ('deaf_tutor','qualified_deaf_teacher'))
       and not exists(select 1 from public.verification_records where provider_id=p_provider_id and type='deaf' and state='approved') then raise exception 'Deaf verification must be approved first'; end if;
    if exists(select 1 from public.provider_roles where provider_id=p_provider_id and role='qualified_deaf_teacher')
       and not exists(select 1 from public.verification_records where provider_id=p_provider_id and type='teacher_qualification' and state='approved') then raise exception 'Teacher qualification must be approved first'; end if;
    if exists(select 1 from public.provider_roles where provider_id=p_provider_id and role='interpreter')
       and not exists(select 1 from public.verification_records where provider_id=p_provider_id and type='interpreter_assessment' and state='approved') then raise exception 'Interpreter verification must be approved first'; end if;
  end if;
  update public.provider_profiles set status=p_status, approved_at=case when p_status='approved' then now() else approved_at end where id=p_provider_id;
  if p_status='approved' then
    update public.provider_roles set approved=true, approved_at=now() where provider_id=p_provider_id;
  elsif p_status in ('rejected','suspended') then
    update public.provider_roles set approved=false where provider_id=p_provider_id;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(auth.uid(),'provider_status_changed','provider_profile',p_provider_id::text,jsonb_build_object('status',old_status),jsonb_build_object('status',p_status),p_reason);
end;
$$;

-- RLS -----------------------------------------------------------------------
alter table public.user_identity_verifications enable row level security;
alter table public.booking_reservations enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_reschedule_requests enable row level security;

create policy "identity_self_admin_read" on public.user_identity_verifications for select to authenticated
using(user_id=auth.uid() or public.current_is_admin());
create policy "identity_self_insert" on public.user_identity_verifications for insert to authenticated
with check(user_id=auth.uid() and state in ('not_started','pending'));
create policy "identity_self_restart" on public.user_identity_verifications for update to authenticated
using(user_id=auth.uid() and state in ('not_started','rejected','needs_information'))
with check(user_id=auth.uid() and state='pending');
create policy "identity_admin_update" on public.user_identity_verifications for update to authenticated
using(public.current_is_admin()) with check(public.current_is_admin());

create policy "reservations_learner_provider_admin_read" on public.booking_reservations for select to authenticated
using(
  learner_user_id=auth.uid()
  or exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid())
  or public.current_is_admin()
);

create policy "bookings_learner_provider_admin_read" on public.bookings for select to authenticated
using(
  learner_user_id=auth.uid()
  or exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid())
  or public.current_is_admin()
);

create policy "reschedules_participants_admin_read" on public.booking_reschedule_requests for select to authenticated
using(
  exists(select 1 from public.bookings b join public.provider_profiles p on p.id=b.provider_id where b.id=booking_id and (b.learner_user_id=auth.uid() or p.user_id=auth.uid()))
  or public.current_is_admin()
);

-- Admin-only manual identity state change for testing/support until a KYC webhook is connected.
create or replace function public.admin_set_user_identity_state(p_user_id uuid,p_state public.identity_verification_state,p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare old_state public.identity_verification_state;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  select state into old_state from public.user_identity_verifications where user_id=p_user_id;
  insert into public.user_identity_verifications(user_id,state,verified_at,reviewed_at,reviewed_by)
  values(p_user_id,p_state,case when p_state='approved' then now() else null end,now(),auth.uid())
  on conflict(user_id) do update set state=excluded.state, verified_at=excluded.verified_at, reviewed_at=now(), reviewed_by=auth.uid();
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(auth.uid(),'learner_identity_state_changed','profile',p_user_id::text,jsonb_build_object('state',old_state),jsonb_build_object('state',p_state),p_reason);
end;
$$;

grant execute on function public.admin_set_user_identity_state(uuid,public.identity_verification_state,text) to authenticated;
