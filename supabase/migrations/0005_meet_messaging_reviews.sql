-- RealSign V1 / Milestone 5
-- Private video-session metadata, temporary booking chat, technical events,
-- booking completion, learner reviews and provider private session reports.

create type public.video_session_state as enum ('created','waiting','in_session','ended','failed');
create type public.technical_event_type as enum ('joined','left','rejoined','connection_interrupted','connection_recovered','network_warning','network_bad','video_unclear','cannot_see_other','power_or_internet','other');
create type public.review_moderation_state as enum ('published','flagged','hidden');

create table public.video_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  provider_room_name text not null unique,
  provider_room_url text not null,
  state public.video_session_state not null default 'created',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger video_sessions_touch_updated_at before update on public.video_sessions for each row execute function public.touch_updated_at();

create table public.video_session_participants (
  id bigint generated always as identity primary key,
  video_session_id uuid not null references public.video_sessions(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null check(participant_role in ('learner','provider')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  daily_session_id text,
  created_at timestamptz not null default now()
);
create index video_session_participants_booking_idx on public.video_session_participants(booking_id, joined_at);

create table public.booking_messages (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 1000),
  is_quick_message boolean not null default false,
  created_at timestamptz not null default now()
);
create index booking_messages_booking_idx on public.booking_messages(booking_id, created_at);

create table public.technical_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  video_session_id uuid references public.video_sessions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.technical_event_type not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index technical_events_booking_idx on public.technical_events(booking_id, created_at);

create table public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  stars smallint not null check(stars between 1 and 5),
  tags text[] not null default '{}',
  comment text check(comment is null or char_length(comment) <= 1000),
  moderation_state public.review_moderation_state not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger booking_reviews_touch_updated_at before update on public.booking_reviews for each row execute function public.touch_updated_at();

create table public.provider_session_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  category text not null check(category in ('everything_fine','learner_no_show','inappropriate_behaviour','harassment','technical_problem','other')),
  note text check(note is null or char_length(note) <= 1500),
  created_at timestamptz not null default now()
);

insert into public.platform_settings(key,value) values
 ('video_join_early_min','15'::jsonb),
 ('video_wrap_up_min','2'::jsonb),
 ('chat_close_hours','24'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_booking_participant(p_booking_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.bookings b
    join public.provider_profiles p on p.id=b.provider_id
    where b.id=p_booking_id and (b.learner_user_id=p_user_id or p.user_id=p_user_id)
  );
$$;
grant execute on function public.is_booking_participant(uuid,uuid) to authenticated, service_role;

create or replace function public.booking_chat_is_open(p_booking_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare b public.bookings%rowtype; close_hours integer:=24;
begin
  select * into b from public.bookings where id=p_booking_id;
  if b.id is null then return false; end if;
  select coalesce((value #>> '{}')::integer,24) into close_hours from public.platform_settings where key='chat_close_hours';
  return now() <= b.end_at + make_interval(hours=>greatest(0,coalesce(close_hours,24)))
     and b.state not in ('refunded');
end; $$;
grant execute on function public.booking_chat_is_open(uuid) to authenticated, service_role;

create or replace function public.mark_booking_in_session(p_booking_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; early_min integer:=15;
begin
  if auth.role()<>'service_role' and not public.is_booking_participant(p_booking_id,auth.uid()) then raise exception 'Booking access required'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if b.id is null or b.state not in ('confirmed','in_session') then raise exception 'Booking cannot enter session'; end if;
  select coalesce((value #>> '{}')::integer,15) into early_min from public.platform_settings where key='video_join_early_min';
  if now() < b.start_at-make_interval(mins=>greatest(0,early_min)) then raise exception 'Session is not open yet'; end if;
  if now() > b.end_at+interval '10 minutes' then raise exception 'Session has ended'; end if;
  update public.bookings set state='in_session' where id=p_booking_id and state='confirmed';
end; $$;
grant execute on function public.mark_booking_in_session(uuid) to authenticated,service_role;

create or replace function public.complete_booking_after_end(p_booking_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype;
begin
  if auth.role()<>'service_role' and not public.is_booking_participant(p_booking_id,auth.uid()) then raise exception 'Booking access required'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if now() < b.end_at then raise exception 'Paid session time has not ended'; end if;
  if b.state in ('confirmed','in_session') then update public.bookings set state='completed' where id=p_booking_id; end if;
  update public.video_sessions set state='ended',ended_at=coalesce(ended_at,now()) where booking_id=p_booking_id;
end; $$;
grant execute on function public.complete_booking_after_end(uuid) to authenticated,service_role;

alter table public.video_sessions enable row level security;
alter table public.video_session_participants enable row level security;
alter table public.booking_messages enable row level security;
alter table public.technical_events enable row level security;
alter table public.booking_reviews enable row level security;
alter table public.provider_session_reports enable row level security;

create policy "video_sessions_participants_admin_read" on public.video_sessions for select to authenticated using(public.is_booking_participant(booking_id) or public.current_is_admin());
create policy "video_participants_participants_admin_read" on public.video_session_participants for select to authenticated using(public.is_booking_participant(booking_id) or public.current_is_admin());
create policy "messages_participants_read" on public.booking_messages for select to authenticated using(public.is_booking_participant(booking_id));
create policy "messages_participants_insert" on public.booking_messages for insert to authenticated with check(sender_user_id=auth.uid() and public.is_booking_participant(booking_id) and public.booking_chat_is_open(booking_id));
create policy "technical_participants_admin_read" on public.technical_events for select to authenticated using(public.is_booking_participant(booking_id) or public.current_is_admin());
create policy "technical_participants_insert" on public.technical_events for insert to authenticated with check(user_id=auth.uid() and public.is_booking_participant(booking_id));
create policy "reviews_public_read" on public.booking_reviews for select to anon,authenticated using(moderation_state='published' or learner_user_id=auth.uid() or public.current_is_admin());
create policy "review_learner_insert" on public.booking_reviews for insert to authenticated with check(
 learner_user_id=auth.uid() and exists(select 1 from public.bookings b where b.id=booking_id and b.learner_user_id=auth.uid() and b.provider_id=provider_id and b.state='completed')
);
create policy "provider_reports_provider_admin_read" on public.provider_session_reports for select to authenticated using(exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.current_is_admin());
create policy "provider_reports_provider_insert" on public.provider_session_reports for insert to authenticated with check(exists(select 1 from public.provider_profiles p join public.bookings b on b.provider_id=p.id where p.id=provider_id and p.user_id=auth.uid() and b.id=booking_id));

-- Public aggregate review data without exposing hidden/flagged comments.
create or replace function public.get_public_provider_reviews(p_provider_id uuid, p_limit integer default 10)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'average',coalesce(round(avg(stars)::numeric,1),0),
   'count',count(*),
   'reviews',coalesce(jsonb_agg(jsonb_build_object('stars',stars,'tags',tags,'comment',comment,'created_at',created_at) order by created_at desc) filter(where rn<=greatest(1,least(coalesce(p_limit,10),30))),'[]'::jsonb)
 )
 from (select r.*,row_number() over(order by created_at desc) rn from public.booking_reviews r where provider_id=p_provider_id and moderation_state='published') q;
$$;
grant execute on function public.get_public_provider_reviews(uuid,integer) to anon,authenticated;

-- Scheduled finance jobs can call this before releasing provider earnings so a client
-- closing their browser at session-end does not leave completed appointments stuck in_session.
create or replace function public.auto_complete_due_bookings()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer; wrap_min integer:=2;
begin
  if auth.role()<>'service_role' and not exists(select 1 from public.admin_profiles a where a.user_id=auth.uid() and a.is_active=true and a.role in ('super','finance','support')) then raise exception 'Admin/service access required'; end if;
  select coalesce((value #>> '{}')::integer,2) into wrap_min from public.platform_settings where key='video_wrap_up_min';
  update public.bookings set state='completed'
   where state in ('confirmed','in_session') and end_at+make_interval(mins=>greatest(0,coalesce(wrap_min,2)))<=now();
  get diagnostics n=row_count;
  update public.video_sessions vs set state='ended',ended_at=coalesce(ended_at,now()) from public.bookings b where vs.booking_id=b.id and b.state='completed' and vs.state<>'ended';
  return n;
end; $$;
grant execute on function public.auto_complete_due_bookings() to service_role,authenticated;

-- Security hardening: callers may only ask about their own booking-participant status,
-- unless they are Admin/service-role.
create or replace function public.is_booking_participant(p_booking_id uuid, p_user_id uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' and not public.current_is_admin() and p_user_id is distinct from auth.uid() then return false; end if;
  return exists(select 1 from public.bookings b join public.provider_profiles p on p.id=b.provider_id where b.id=p_booking_id and (b.learner_user_id=p_user_id or p.user_id=p_user_id));
end; $$;

-- Chat closes on cancellation/refund/reschedule instead of lingering until the original appointment end.
create or replace function public.booking_chat_is_open(p_booking_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare b public.bookings%rowtype; close_hours integer:=24;
begin
  select * into b from public.bookings where id=p_booking_id;
  if b.id is null then return false; end if;
  if b.state in ('cancelled_by_learner','cancelled_by_provider','refunded','rescheduled') then return false; end if;
  select coalesce((value #>> '{}')::integer,24) into close_hours from public.platform_settings where key='chat_close_hours';
  return now() <= b.end_at + make_interval(hours=>greatest(0,coalesce(close_hours,24)));
end; $$;

-- A normal remote booking is only auto-completed when both learner and provider actually joined.
create or replace function public.complete_booking_after_end(p_booking_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; both_joined boolean;
begin
  if auth.role()<>'service_role' and not public.is_booking_participant(p_booking_id,auth.uid()) then raise exception 'Booking access required'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if now() < b.end_at then raise exception 'Paid session time has not ended'; end if;
  select count(distinct participant_role)=2 into both_joined from public.video_session_participants where booking_id=p_booking_id;
  if auth.role()<>'service_role' and not both_joined then raise exception 'Attendance is incomplete; report a no-show or technical issue instead'; end if;
  if b.state in ('confirmed','in_session') then update public.bookings set state='completed' where id=p_booking_id; end if;
  update public.video_sessions set state='ended',ended_at=coalesce(ended_at,now()) where booking_id=p_booking_id;
end; $$;

create or replace function public.auto_complete_due_bookings()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer; wrap_min integer:=2;
begin
  if auth.role()<>'service_role' and not exists(select 1 from public.admin_profiles a where a.user_id=auth.uid() and a.is_active=true and a.role in ('super','finance','support')) then raise exception 'Admin/service access required'; end if;
  select coalesce((value #>> '{}')::integer,2) into wrap_min from public.platform_settings where key='video_wrap_up_min';
  update public.bookings b set state='completed'
   where b.state='in_session' and b.end_at+make_interval(mins=>greatest(0,coalesce(wrap_min,2)))<=now()
     and (select count(distinct vsp.participant_role) from public.video_session_participants vsp where vsp.booking_id=b.id)=2;
  get diagnostics n=row_count;
  update public.video_sessions vs set state='ended',ended_at=coalesce(ended_at,now()) from public.bookings b where vs.booking_id=b.id and b.state='completed' and vs.state<>'ended';
  return n;
end; $$;

-- Provider reports are restricted to their own booking and can be filed once the appointment has ended
-- (including no-show/technical cases that are not marked completed).
drop policy if exists "provider_reports_provider_insert" on public.provider_session_reports;
create policy "provider_reports_provider_insert" on public.provider_session_reports for insert to authenticated with check(
  exists(select 1 from public.provider_profiles p join public.bookings b on b.provider_id=p.id where p.id=provider_id and p.user_id=auth.uid() and b.id=booking_id and now()>=b.end_at)
);
