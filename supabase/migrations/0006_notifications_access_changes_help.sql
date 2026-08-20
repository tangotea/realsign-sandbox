-- RealSign V1 / Milestone 6
-- Push notification queue/subscriptions, cancellation & rescheduling rules,
-- no-show handling, Deaf Access sponsorship credits, and Admin-managed SASL help.

create type public.notification_state as enum ('queued','sent','failed','skipped');
create type public.notification_kind as enum (
  'booking_confirmed','booking_changed','booking_cancelled','booking_reminder_24h',
  'booking_reminder_1h','booking_reminder_10m','provider_new_booking','reschedule_requested',
  'reschedule_accepted','reschedule_declined','provider_application','payout','system'
);
create type public.credit_scope as enum ('interpreter_only','tutor_teacher_only','any_service');
create type public.credit_reservation_state as enum ('reserved','used','released','reversed');
create type public.sponsor_fund_state as enum ('active','closed');
create type public.sponsor_close_instruction as enum ('roll_over','general_access_pool','refund_eligible_balance');
create type public.cancellation_resolution_state as enum ('not_required','finance_pending','credit_pending','resolved','manual_review');

-- User-level Deaf verification is separate from provider Deaf verification. It is private
-- and is used for access-programme eligibility; it is not a public profile badge by default.
create table public.user_deaf_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state public.verification_state not null default 'not_submitted',
  storage_path text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  internal_note text,
  retention_delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_deaf_verifications_touch_updated_at before update on public.user_deaf_verifications for each row execute function public.touch_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  active boolean not null default true,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
create trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions for each row execute function public.touch_updated_at();

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  reminder_24h boolean not null default true,
  reminder_1h boolean not null default true,
  reminder_10m boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_touch_updated_at before update on public.notification_preferences for each row execute function public.touch_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  target_url text,
  scheduled_for timestamptz not null default now(),
  state public.notification_state not null default 'queued',
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index notifications_due_idx on public.notifications(state,scheduled_for);
create index notifications_user_idx on public.notifications(user_id,created_at desc);

-- Cancellations are factual records. Financial resolution can then be performed safely
-- by the existing finance/refund layer rather than by a browser changing money tables.
create table public.booking_cancellations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  cancelled_by uuid not null references public.profiles(id) on delete restrict,
  cancelled_role text not null check(cancelled_role in ('learner','provider','admin')),
  reason text,
  within_free_window boolean not null,
  cash_refund_recommended_cents integer not null default 0 check(cash_refund_recommended_cents>=0),
  sponsor_credit_returned_cents integer not null default 0 check(sponsor_credit_returned_cents>=0),
  resolution_state public.cancellation_resolution_state not null default 'not_required',
  created_at timestamptz not null default now()
);

alter table public.booking_reschedule_requests add column if not exists replacement_reservation_id uuid references public.booking_reservations(id) on delete set null;
alter table public.booking_reschedule_requests add column if not exists auto_accepted boolean not null default false;

-- Sponsors and funds. Credits are non-transferable booking subsidies, not cash wallets.
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sponsors_touch_updated_at before update on public.sponsors for each row execute function public.touch_updated_at();

create table public.sponsor_funds (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  name text not null,
  original_contribution_cents integer not null check(original_contribution_cents>0),
  admin_fee_bps integer not null default 750 check(admin_fee_bps between 0 and 10000),
  admin_fee_cents integer not null check(admin_fee_cents>=0),
  programme_cents integer not null check(programme_cents>=0),
  credit_scope public.credit_scope not null default 'interpreter_only',
  max_per_booking_cents integer,
  max_per_user_month_cents integer,
  allocation_end_date date,
  close_instruction public.sponsor_close_instruction not null default 'roll_over',
  state public.sponsor_fund_state not null default 'active',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(programme_cents + admin_fee_cents <= original_contribution_cents)
);
create trigger sponsor_funds_touch_updated_at before update on public.sponsor_funds for each row execute function public.touch_updated_at();

create table public.credit_allocations (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.sponsor_funds(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete cascade, -- null = general access pool
  scope public.credit_scope not null,
  allocated_cents integer not null check(allocated_cents>0),
  reserved_cents integer not null default 0 check(reserved_cents>=0),
  used_cents integer not null default 0 check(used_cents>=0),
  allocation_end_date date,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check(reserved_cents + used_cents <= allocated_cents)
);
create index credit_allocations_user_idx on public.credit_allocations(user_id,active);
create index credit_allocations_fund_idx on public.credit_allocations(fund_id,active);

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.credit_allocations(id) on delete restrict,
  hold_id uuid not null unique references public.booking_reservations(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents integer not null check(amount_cents>0),
  state public.credit_reservation_state not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger credit_reservations_touch_updated_at before update on public.credit_reservations for each row execute function public.touch_updated_at();

alter table public.booking_reservations add column if not exists sponsor_subsidy_cents integer not null default 0 check(sponsor_subsidy_cents>=0 and sponsor_subsidy_cents<=price_cents_snapshot);
alter table public.bookings add column if not exists sponsor_subsidy_cents integer not null default 0 check(sponsor_subsidy_cents>=0 and sponsor_subsidy_cents<=price_cents);

-- Extend finance ledger vocabulary for sponsor money.
alter table public.financial_ledger drop constraint if exists financial_ledger_category_check;
alter table public.financial_ledger add constraint financial_ledger_category_check check(category in (
  'customer_payment','sponsor_subsidy','sponsorship_admin_fee','platform_fee','gateway_fee','provider_earning','refund','provider_payout','payout_fee','manual_adjustment'
));

create table public.help_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  text_explanation text,
  video_path text,
  audience text[] not null default array['everyone']::text[],
  screen_key text not null,
  placement_key text not null,
  active boolean not null default true,
  display_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger help_content_touch_updated_at before update on public.help_content for each row execute function public.touch_updated_at();

insert into public.platform_settings(key,value) values
 ('free_cancellation_hours','24'::jsonb),
 ('short_notice_reschedule_request_hours','2'::jsonb),
 ('sponsored_booking_platform_fee_bps','0'::jsonb),
 ('sponsorship_default_admin_fee_bps','750'::jsonb)
on conflict(key) do nothing;

-- --------------------------------------------------------------------------
-- Notification helpers
-- --------------------------------------------------------------------------
create or replace function public.queue_notification(
  p_user_id uuid,p_booking_id uuid,p_kind public.notification_kind,p_title text,p_body text,
  p_target_url text default null,p_scheduled_for timestamptz default now(),p_dedupe_key text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare n_id uuid;
begin
  insert into public.notifications(user_id,booking_id,kind,title,body,target_url,scheduled_for,dedupe_key)
  values(p_user_id,p_booking_id,p_kind,p_title,p_body,p_target_url,coalesce(p_scheduled_for,now()),p_dedupe_key)
  on conflict(dedupe_key) do update set scheduled_for=excluded.scheduled_for
  returning id into n_id;
  return n_id;
end; $$;
grant execute on function public.queue_notification(uuid,uuid,public.notification_kind,text,text,text,timestamptz,text) to service_role;

create or replace function public.enqueue_booking_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer:=0; r record; provider_user uuid; prefs public.notification_preferences%rowtype;
begin
  if auth.role()<>'service_role' and not public.current_is_admin() then raise exception 'Admin/service access required'; end if;
  for r in select b.id,b.reference,b.start_at,b.learner_user_id,b.provider_id,p.public_display_name,p.user_id as provider_user_id
           from public.bookings b join public.provider_profiles p on p.id=b.provider_id
           where b.state='confirmed' and b.start_at between now()+interval '5 minutes' and now()+interval '25 hours'
  loop
    -- Learner reminders
    select * into prefs from public.notification_preferences where user_id=r.learner_user_id;
    if coalesce(prefs.reminder_24h,true) and r.start_at between now()+interval '23 hours 50 minutes' and now()+interval '24 hours 10 minutes' then
      perform public.queue_notification(r.learner_user_id,r.id,'booking_reminder_24h','RealSign booking tomorrow','Your session with '||coalesce(r.public_display_name,'your provider')||' is in about 24 hours.','/bookings/'||r.id,now(),'24h-learner-'||r.id);
      n:=n+1;
    end if;
    if coalesce(prefs.reminder_1h,true) and r.start_at between now()+interval '50 minutes' and now()+interval '70 minutes' then
      perform public.queue_notification(r.learner_user_id,r.id,'booking_reminder_1h','RealSign session in 1 hour','Your RealSign session starts in about 1 hour.','/bookings/'||r.id,now(),'1h-learner-'||r.id); n:=n+1;
    end if;
    if coalesce(prefs.reminder_10m,true) and r.start_at between now()+interval '5 minutes' and now()+interval '15 minutes' then
      perform public.queue_notification(r.learner_user_id,r.id,'booking_reminder_10m','RealSign session starts soon','Your session starts in about 10 minutes. Check your camera and connection.','/bookings/'||r.id,now(),'10m-learner-'||r.id); n:=n+1;
    end if;
    -- Provider reminders use same user preferences.
    provider_user:=r.provider_user_id;
    select * into prefs from public.notification_preferences where user_id=provider_user;
    if coalesce(prefs.reminder_24h,true) and r.start_at between now()+interval '23 hours 50 minutes' and now()+interval '24 hours 10 minutes' then
      perform public.queue_notification(provider_user,r.id,'booking_reminder_24h','RealSign booking tomorrow','You have a RealSign booking in about 24 hours.','/bookings/'||r.id,now(),'24h-provider-'||r.id); n:=n+1;
    end if;
    if coalesce(prefs.reminder_1h,true) and r.start_at between now()+interval '50 minutes' and now()+interval '70 minutes' then
      perform public.queue_notification(provider_user,r.id,'booking_reminder_1h','RealSign session in 1 hour','Your RealSign session starts in about 1 hour.','/bookings/'||r.id,now(),'1h-provider-'||r.id); n:=n+1;
    end if;
    if coalesce(prefs.reminder_10m,true) and r.start_at between now()+interval '5 minutes' and now()+interval '15 minutes' then
      perform public.queue_notification(provider_user,r.id,'booking_reminder_10m','RealSign session starts soon','Your session starts in about 10 minutes. Check your camera and connection.','/bookings/'||r.id,now(),'10m-provider-'||r.id); n:=n+1;
    end if;
  end loop;
  return n;
end; $$;
grant execute on function public.enqueue_booking_reminders() to service_role,authenticated;

-- --------------------------------------------------------------------------
-- Sponsorship helpers
-- --------------------------------------------------------------------------
create or replace function public.credit_scope_matches_service(p_scope public.credit_scope,p_service_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select case p_scope
    when 'any_service' then true
    when 'interpreter_only' then exists(select 1 from public.provider_services s where s.id=p_service_id and s.provider_role='interpreter')
    when 'tutor_teacher_only' then exists(select 1 from public.provider_services s where s.id=p_service_id and s.provider_role in ('deaf_tutor','qualified_deaf_teacher'))
    else false end;
$$;
grant execute on function public.credit_scope_matches_service(public.credit_scope,uuid) to authenticated,service_role;

create or replace function public.reserve_sponsorship_for_own_hold(p_hold_id uuid,p_requested_cents integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; a public.credit_allocations%rowtype; available integer; amount integer; max_booking integer; deaf_ok boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.booking_reservations where id=p_hold_id and learner_user_id=auth.uid() and state='hold' and expires_at>now() for update;
  if r.id is null then raise exception 'Active checkout hold required'; end if;
  if exists(select 1 from public.payment_transactions where hold_id=r.id and state in ('initialized','pending','success')) then raise exception 'Choose sponsorship before payment starts'; end if;
  if exists(select 1 from public.credit_reservations where hold_id=r.id and state='reserved') then
    select cr.amount_cents into amount from public.credit_reservations cr where cr.hold_id=r.id and cr.state='reserved';
    return jsonb_build_object('subsidy_cents',amount,'cash_due_cents',r.price_cents_snapshot-amount);
  end if;

  select exists(select 1 from public.user_deaf_verifications d where d.user_id=auth.uid() and d.state='approved') into deaf_ok;

  select ca.* into a from public.credit_allocations ca join public.sponsor_funds sf on sf.id=ca.fund_id
  where ca.active=true and sf.state='active'
    and (ca.allocation_end_date is null or ca.allocation_end_date>=current_date)
    and (sf.allocation_end_date is null or sf.allocation_end_date>=current_date)
    and public.credit_scope_matches_service(ca.scope,r.service_id)
    and (ca.user_id=auth.uid() or (ca.user_id is null and deaf_ok))
    and ca.allocated_cents-ca.reserved_cents-ca.used_cents>0
  order by (ca.user_id=auth.uid()) desc,ca.created_at asc
  limit 1 for update;
  if a.id is null then return jsonb_build_object('subsidy_cents',0,'cash_due_cents',r.price_cents_snapshot,'reason','no_eligible_credit'); end if;

  select sf.max_per_booking_cents into max_booking from public.sponsor_funds sf where sf.id=a.fund_id;
  available:=a.allocated_cents-a.reserved_cents-a.used_cents;
  amount:=least(r.price_cents_snapshot,available,coalesce(p_requested_cents,r.price_cents_snapshot),coalesce(max_booking,r.price_cents_snapshot));
  if amount<=0 then return jsonb_build_object('subsidy_cents',0,'cash_due_cents',r.price_cents_snapshot); end if;

  update public.credit_allocations set reserved_cents=reserved_cents+amount where id=a.id;
  insert into public.credit_reservations(allocation_id,hold_id,user_id,amount_cents) values(a.id,r.id,auth.uid(),amount);
  update public.booking_reservations set sponsor_subsidy_cents=amount where id=r.id;
  return jsonb_build_object('subsidy_cents',amount,'cash_due_cents',r.price_cents_snapshot-amount,'allocation_id',a.id);
end; $$;
grant execute on function public.reserve_sponsorship_for_own_hold(uuid,integer) to authenticated;

create or replace function public.release_reserved_sponsorship(p_hold_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cr public.credit_reservations%rowtype;
begin
  if auth.role()<>'service_role' and not exists(select 1 from public.booking_reservations br where br.id=p_hold_id and br.learner_user_id=auth.uid()) and not public.current_is_admin() then raise exception 'Access denied'; end if;
  select * into cr from public.credit_reservations where hold_id=p_hold_id and state='reserved' for update;
  if cr.id is null then return 0; end if;
  update public.credit_allocations set reserved_cents=greatest(0,reserved_cents-cr.amount_cents) where id=cr.allocation_id;
  update public.credit_reservations set state='released' where id=cr.id;
  update public.booking_reservations set sponsor_subsidy_cents=0 where id=p_hold_id;
  return cr.amount_cents;
end; $$;
grant execute on function public.release_reserved_sponsorship(uuid) to authenticated,service_role;

-- Price charged to Paystack is the learner cash portion after any sponsor subsidy.
create or replace function public.prepare_own_booking_payment(p_hold_id uuid,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; existing public.payment_transactions%rowtype; fee_bps integer:=1500; pending_min integer:=20; p_id uuid; cash_due integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reference is null or length(p_reference)<16 then raise exception 'Invalid payment reference'; end if;
  select * into r from public.booking_reservations where id=p_hold_id and learner_user_id=auth.uid() for update;
  if r.id is null or r.state<>'hold' or r.expires_at is null or r.expires_at<=now() then raise exception 'Checkout hold has expired'; end if;
  select * into existing from public.payment_transactions where hold_id=r.id and state in ('initialized','pending','success','refund_pending','partially_refunded') order by created_at desc limit 1;
  if existing.id is not null then return jsonb_build_object('payment_id',existing.id,'reference',existing.reference,'amount_cents',existing.amount_cents,'checkout_url',existing.checkout_url,'state',existing.state); end if;
  cash_due:=greatest(0,r.price_cents_snapshot-r.sponsor_subsidy_cents);
  if cash_due=0 then raise exception 'This booking is fully sponsored; use sponsored checkout'; end if;
  select coalesce((value#>>'{}')::integer,1500) into fee_bps from public.platform_settings where key='standard_platform_fee_bps';
  select coalesce((value#>>'{}')::integer,20) into pending_min from public.platform_settings where key='payment_pending_hold_min';
  update public.booking_reservations set expires_at=now()+make_interval(mins=>greatest(5,coalesce(pending_min,20))) where id=r.id;
  insert into public.payment_transactions(hold_id,learner_user_id,provider_id,reference,amount_cents,platform_fee_bps_snapshot,state,metadata)
  values(r.id,r.learner_user_id,r.provider_id,p_reference,cash_due,greatest(0,least(coalesce(fee_bps,1500),10000)),'initialized',jsonb_build_object('service_id',r.service_id,'gross_booking_cents',r.price_cents_snapshot,'sponsor_subsidy_cents',r.sponsor_subsidy_cents)) returning id into p_id;
  return jsonb_build_object('payment_id',p_id,'reference',p_reference,'amount_cents',cash_due,'gross_booking_cents',r.price_cents_snapshot,'sponsor_subsidy_cents',r.sponsor_subsidy_cents,'state','initialized');
end; $$;
grant execute on function public.prepare_own_booking_payment(uuid,text) to authenticated;

create or replace function public.mark_credit_used_for_booking(p_hold_id uuid,p_booking_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cr public.credit_reservations%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select * into cr from public.credit_reservations where hold_id=p_hold_id and state='reserved' for update;
  if cr.id is null then return 0; end if;
  update public.credit_allocations set reserved_cents=greatest(0,reserved_cents-cr.amount_cents),used_cents=used_cents+cr.amount_cents where id=cr.allocation_id;
  update public.credit_reservations set state='used',booking_id=p_booking_id where id=cr.id;
  return cr.amount_cents;
end; $$;
grant execute on function public.mark_credit_used_for_booking(uuid,uuid) to service_role;

create or replace function public.return_used_credit_for_booking(p_booking_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cr public.credit_reservations%rowtype;
begin
  if auth.role()<>'service_role' and not public.current_is_admin() then raise exception 'Admin/service access required'; end if;
  select * into cr from public.credit_reservations where booking_id=p_booking_id and state='used' for update;
  if cr.id is null then return 0; end if;
  update public.credit_allocations set used_cents=greatest(0,used_cents-cr.amount_cents) where id=cr.allocation_id;
  update public.credit_reservations set state='reversed' where id=cr.id;
  return cr.amount_cents;
end; $$;
grant execute on function public.return_used_credit_for_booking(uuid) to service_role,authenticated;

-- Override successful payment finalisation so sponsor + learner cash always equals the
-- gross service value, while sponsored portions can use a separate platform-fee rate.
create or replace function public.record_successful_paystack_payment(
  p_reference text,p_paystack_transaction_id numeric,p_amount_cents integer,p_gateway_fee_cents integer default 0,
  p_channel text default null,p_paid_at timestamptz default now(),p_gateway_response text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare pt public.payment_transactions%rowtype; r public.booking_reservations%rowtype; b_id uuid; standard_fee_bps integer; sponsored_fee_bps integer:=0; fee_cents integer; earning_cents integer; clearance_hours integer:=24; sponsor_used integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select * into pt from public.payment_transactions where reference=p_reference for update;
  if pt.id is null then return jsonb_build_object('status','unknown_reference'); end if;
  if pt.state in ('success','refund_pending','partially_refunded','refunded') and pt.booking_id is not null then return jsonb_build_object('status','already_finalized','booking_id',pt.booking_id); end if;
  if p_amount_cents<>pt.amount_cents then update public.payment_transactions set state='manual_review',gateway_response='Amount mismatch' where id=pt.id; return jsonb_build_object('status','manual_review','reason','amount_mismatch'); end if;
  select * into r from public.booking_reservations where id=pt.hold_id for update;
  if r.id is null or r.state<>'hold' or r.expires_at is null or r.expires_at<=now() then update public.payment_transactions set state='manual_review',paystack_transaction_id=p_paystack_transaction_id,gateway_response='Paid after protected hold was no longer valid' where id=pt.id; return jsonb_build_object('status','manual_review','reason','reservation_unavailable'); end if;
  update public.booking_reservations set state='booked',expires_at=null where id=r.id;
  insert into public.bookings(reservation_id,learner_user_id,provider_id,service_id,start_at,end_at,price_cents,sponsor_subsidy_cents,learner_for,learner_first_name,learner_grade,learner_note,payment_reference)
  values(r.id,r.learner_user_id,r.provider_id,r.service_id,r.start_at,r.end_at,r.price_cents_snapshot,r.sponsor_subsidy_cents,r.learner_for,r.learner_first_name,r.learner_grade,r.learner_note,p_reference) returning id into b_id;
  sponsor_used:=public.mark_credit_used_for_booking(r.id,b_id);
  standard_fee_bps:=pt.platform_fee_bps_snapshot;
  select coalesce((value#>>'{}')::integer,0) into sponsored_fee_bps from public.platform_settings where key='sponsored_booking_platform_fee_bps';
  fee_cents:=round((pt.amount_cents::numeric*standard_fee_bps)/10000.0 + (sponsor_used::numeric*greatest(0,least(sponsored_fee_bps,10000)))/10000.0)::integer;
  fee_cents:=greatest(0,least(fee_cents,r.price_cents_snapshot)); earning_cents:=r.price_cents_snapshot-fee_cents;
  select coalesce((value#>>'{}')::integer,24) into clearance_hours from public.platform_settings where key='earnings_clearance_hours';
  update public.payment_transactions set booking_id=b_id,state='success',paystack_transaction_id=p_paystack_transaction_id,platform_fee_cents=fee_cents,provider_earning_cents=earning_cents,gateway_fee_cents=coalesce(p_gateway_fee_cents,0),channel=p_channel,paid_at=p_paid_at,gateway_response=p_gateway_response where id=pt.id;
  insert into public.provider_earnings(booking_id,payment_id,provider_id,gross_booking_cents,platform_fee_cents,amount_cents,state,release_after) values(b_id,pt.id,pt.provider_id,r.price_cents_snapshot,fee_cents,earning_cents,'pending',r.end_at+make_interval(hours=>greatest(0,coalesce(clearance_hours,24))));
  insert into public.financial_ledger(booking_id,payment_id,provider_id,category,direction,amount_cents,reference) values
    (b_id,pt.id,pt.provider_id,'customer_payment','credit',pt.amount_cents,p_reference),
    (b_id,pt.id,pt.provider_id,'sponsor_subsidy','credit',sponsor_used,p_reference),
    (b_id,pt.id,pt.provider_id,'platform_fee','credit',fee_cents,p_reference),
    (b_id,pt.id,pt.provider_id,'gateway_fee','debit',coalesce(p_gateway_fee_cents,0),p_reference),
    (b_id,pt.id,pt.provider_id,'provider_earning','debit',earning_cents,p_reference);
  perform public.queue_notification(r.learner_user_id,b_id,'booking_confirmed','You’re booked','Your RealSign booking is confirmed.','/bookings/'||b_id,now(),'confirmed-learner-'||b_id);
  perform public.queue_notification((select user_id from public.provider_profiles where id=r.provider_id),b_id,'provider_new_booking','New booking confirmed','A learner booked one of your available RealSign times.','/bookings/'||b_id,now(),'confirmed-provider-'||b_id);
  return jsonb_build_object('status','success','booking_id',b_id,'provider_earning_cents',earning_cents,'platform_fee_cents',fee_cents,'sponsor_subsidy_cents',sponsor_used);
exception when exclusion_violation then update public.payment_transactions set state='manual_review',gateway_response='Paid transaction conflicted with provider time' where id=pt.id; return jsonb_build_object('status','manual_review','reason','provider_time_conflict');
end; $$;
revoke all on function public.record_successful_paystack_payment(text,numeric,integer,integer,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_successful_paystack_payment(text,numeric,integer,integer,text,timestamptz,text) to service_role;

-- Fully sponsored checkout does not call a payment gateway. The service-role route calls
-- this tightly scoped function after confirming the sponsor reservation is still valid.
create or replace function public.finalize_fully_sponsored_booking(p_hold_id uuid,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; b_id uuid; pt_id uuid; sponsor_used integer; sponsored_fee_bps integer:=0; fee_cents integer; earning_cents integer; clearance_hours integer:=24;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select * into r from public.booking_reservations where id=p_hold_id for update;
  if r.id is null or r.state<>'hold' or r.expires_at<=now() or r.sponsor_subsidy_cents<>r.price_cents_snapshot then raise exception 'Fully sponsored hold is not valid'; end if;
  update public.booking_reservations set state='booked',expires_at=null where id=r.id;
  insert into public.bookings(reservation_id,learner_user_id,provider_id,service_id,start_at,end_at,price_cents,sponsor_subsidy_cents,learner_for,learner_first_name,learner_grade,learner_note,payment_reference)
  values(r.id,r.learner_user_id,r.provider_id,r.service_id,r.start_at,r.end_at,r.price_cents_snapshot,r.sponsor_subsidy_cents,r.learner_for,r.learner_first_name,r.learner_grade,r.learner_note,p_reference) returning id into b_id;
  sponsor_used:=public.mark_credit_used_for_booking(r.id,b_id);
  select coalesce((value#>>'{}')::integer,0) into sponsored_fee_bps from public.platform_settings where key='sponsored_booking_platform_fee_bps';
  fee_cents:=round((sponsor_used::numeric*greatest(0,least(sponsored_fee_bps,10000)))/10000.0)::integer; earning_cents:=r.price_cents_snapshot-fee_cents;
  select coalesce((value#>>'{}')::integer,24) into clearance_hours from public.platform_settings where key='earnings_clearance_hours';
  insert into public.payment_transactions(hold_id,booking_id,learner_user_id,provider_id,reference,amount_cents,platform_fee_bps_snapshot,platform_fee_cents,provider_earning_cents,gateway_fee_cents,state,paid_at,metadata)
  values(r.id,b_id,r.learner_user_id,r.provider_id,p_reference,0,0,fee_cents,earning_cents,0,'success',now(),jsonb_build_object('fully_sponsored',true,'gross_booking_cents',r.price_cents_snapshot,'sponsor_subsidy_cents',sponsor_used)) returning id into pt_id;
  insert into public.provider_earnings(booking_id,payment_id,provider_id,gross_booking_cents,platform_fee_cents,amount_cents,state,release_after) values(b_id,pt_id,r.provider_id,r.price_cents_snapshot,fee_cents,earning_cents,'pending',r.end_at+make_interval(hours=>greatest(0,coalesce(clearance_hours,24))));
  insert into public.financial_ledger(booking_id,payment_id,provider_id,category,direction,amount_cents,reference) values
   (b_id,pt_id,r.provider_id,'sponsor_subsidy','credit',sponsor_used,p_reference),(b_id,pt_id,r.provider_id,'platform_fee','credit',fee_cents,p_reference),(b_id,pt_id,r.provider_id,'provider_earning','debit',earning_cents,p_reference);
  perform public.queue_notification(r.learner_user_id,b_id,'booking_confirmed','You’re booked','Your sponsored RealSign booking is confirmed.','/bookings/'||b_id,now(),'confirmed-learner-'||b_id);
  perform public.queue_notification((select user_id from public.provider_profiles where id=r.provider_id),b_id,'provider_new_booking','New booking confirmed','A learner booked one of your available RealSign times.','/bookings/'||b_id,now(),'confirmed-provider-'||b_id);
  return jsonb_build_object('status','success','booking_id',b_id,'sponsor_subsidy_cents',sponsor_used);
end; $$;
grant execute on function public.finalize_fully_sponsored_booking(uuid,text) to service_role;

-- --------------------------------------------------------------------------
-- Cancellation / rescheduling / no-show helpers
-- --------------------------------------------------------------------------
create or replace function public.cancel_own_booking(p_booking_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; free_hours integer:=24; refund_cash integer:=0; returned_credit integer:=0; provider_user uuid;
begin
  select * into b from public.bookings where id=p_booking_id and learner_user_id=auth.uid() for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if b.state<>'confirmed' then raise exception 'This booking cannot be cancelled'; end if;
  select coalesce((value#>>'{}')::integer,24) into free_hours from public.platform_settings where key='free_cancellation_hours';
  if now()>b.start_at-make_interval(hours=>greatest(0,free_hours)) then raise exception 'Short-notice cancellation is not available; request help or a time change instead'; end if;
  update public.bookings set state='cancelled_by_learner' where id=b.id;
  update public.booking_reservations set state='cancelled' where id=b.reservation_id;
  select coalesce(pt.amount_cents,0) into refund_cash from public.payment_transactions pt where pt.booking_id=b.id and pt.state in ('success','partially_refunded') order by pt.created_at desc limit 1;
  returned_credit:=public.return_used_credit_for_booking(b.id);
  update public.provider_earnings set state='reversed',amount_cents=0,held_reason=null where booking_id=b.id and state in ('pending','available','held');
  insert into public.booking_cancellations(booking_id,cancelled_by,cancelled_role,reason,within_free_window,cash_refund_recommended_cents,sponsor_credit_returned_cents,resolution_state)
  values(b.id,auth.uid(),'learner',p_reason,true,refund_cash,returned_credit,case when refund_cash>0 then 'finance_pending' else 'resolved' end);
  select user_id into provider_user from public.provider_profiles where id=b.provider_id;
  perform public.queue_notification(auth.uid(),b.id,'booking_cancelled','Booking cancelled','Your RealSign booking was cancelled. Any eligible cash refund will be processed separately.','/bookings/'||b.id,now(),'cancel-learner-'||b.id);
  perform public.queue_notification(provider_user,b.id,'booking_cancelled','Booking cancelled','The learner cancelled this booking within the permitted cancellation window.','/bookings/'||b.id,now(),'cancel-provider-'||b.id);
  return jsonb_build_object('cash_refund_recommended_cents',refund_cash,'sponsor_credit_returned_cents',returned_credit);
end; $$;
grant execute on function public.cancel_own_booking(uuid,text) to authenticated;

create or replace function public.provider_cancel_booking(p_booking_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; p_id uuid; learner uuid; refund_cash integer:=0; returned_credit integer:=0;
begin
  select p.id into p_id from public.provider_profiles p where p.user_id=auth.uid();
  select * into b from public.bookings where id=p_booking_id and provider_id=p_id for update;
  if b.id is null or b.state not in ('confirmed','in_session') then raise exception 'Booking cannot be cancelled'; end if;
  learner:=b.learner_user_id;
  update public.bookings set state='cancelled_by_provider' where id=b.id;
  update public.booking_reservations set state='cancelled' where id=b.reservation_id;
  select coalesce(pt.amount_cents,0) into refund_cash from public.payment_transactions pt where pt.booking_id=b.id and pt.state in ('success','partially_refunded') order by pt.created_at desc limit 1;
  returned_credit:=public.return_used_credit_for_booking(b.id);
  update public.provider_earnings set state='reversed',amount_cents=0,held_reason=null where booking_id=b.id and state in ('pending','available','held');
  insert into public.booking_cancellations(booking_id,cancelled_by,cancelled_role,reason,within_free_window,cash_refund_recommended_cents,sponsor_credit_returned_cents,resolution_state)
  values(b.id,auth.uid(),'provider',p_reason,true,refund_cash,returned_credit,case when refund_cash>0 then 'finance_pending' else 'resolved' end);
  perform public.queue_notification(learner,b.id,'booking_cancelled','Provider cancelled booking','Your provider cancelled this booking. Any paid cash amount is eligible for finance resolution.','/bookings/'||b.id,now(),'provider-cancel-learner-'||b.id);
  return jsonb_build_object('cash_refund_recommended_cents',refund_cash,'sponsor_credit_returned_cents',returned_credit);
end; $$;
grant execute on function public.provider_cancel_booking(uuid,text) to authenticated;

create or replace function public.create_reschedule_reservation(p_booking_id uuid,p_new_start_at timestamptz,p_expires timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; s public.provider_services%rowtype; pbs public.provider_booking_settings%rowtype; new_end timestamptz; new_id uuid; local_date date;
begin
  select * into b from public.bookings where id=p_booking_id;
  select * into s from public.provider_services where id=b.service_id;
  select * into pbs from public.provider_booking_settings where provider_id=b.provider_id;
  new_end:=p_new_start_at+make_interval(mins=>s.duration_min); local_date:=(p_new_start_at at time zone pbs.timezone)::date;
  if not exists(select 1 from public.get_service_slots(b.service_id,local_date) x where x.start_at=p_new_start_at and x.end_at=new_end) then raise exception 'That proposed time is no longer available'; end if;
  insert into public.booking_reservations(provider_id,service_id,learner_user_id,start_at,end_at,block_end_at,price_cents_snapshot,sponsor_subsidy_cents,learner_for,learner_first_name,learner_grade,learner_note,state,expires_at)
  values(b.provider_id,b.service_id,b.learner_user_id,p_new_start_at,new_end,new_end+make_interval(mins=>pbs.buffer_min),b.price_cents,b.sponsor_subsidy_cents,b.learner_for,b.learner_first_name,b.learner_grade,b.learner_note,'hold',p_expires) returning id into new_id;
  return new_id;
exception when exclusion_violation then raise exception 'That proposed time has just been reserved';
end; $$;
revoke all on function public.create_reschedule_reservation(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.create_reschedule_reservation(uuid,timestamptz,timestamptz) to service_role;

create or replace function public.request_own_reschedule(p_booking_id uuid,p_new_start_at timestamptz,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; free_hours integer:=24; request_hours integer:=2; request_id uuid; replacement_id uuid; pbs public.provider_booking_settings%rowtype; s public.provider_services%rowtype; new_end timestamptz; old_res uuid; provider_user uuid; auto_ok boolean;
begin
  select * into b from public.bookings where id=p_booking_id and learner_user_id=auth.uid() for update;
  if b.id is null or b.state<>'confirmed' then raise exception 'Booking cannot be rescheduled'; end if;
  if p_new_start_at<=now() then raise exception 'New time must be in the future'; end if;
  select coalesce((value#>>'{}')::integer,24) into free_hours from public.platform_settings where key='free_cancellation_hours';
  select coalesce((value#>>'{}')::integer,2) into request_hours from public.platform_settings where key='short_notice_reschedule_request_hours';
  select * into pbs from public.provider_booking_settings where provider_id=b.provider_id;
  select * into s from public.provider_services where id=b.service_id;
  new_end:=p_new_start_at+make_interval(mins=>s.duration_min); old_res:=b.reservation_id;
  auto_ok:=now()<=b.start_at-make_interval(hours=>greatest(0,free_hours));
  if auto_ok then
    -- Transactionally release old occupancy, validate/insert new occupancy, then move booking.
    update public.booking_reservations set state='cancelled' where id=old_res;
    replacement_id:=public.create_reschedule_reservation(b.id,p_new_start_at,now()+interval '5 minutes');
    update public.booking_reservations set state='booked',expires_at=null where id=replacement_id;
    update public.bookings set reservation_id=replacement_id,start_at=p_new_start_at,end_at=new_end,state='confirmed' where id=b.id;
    insert into public.booking_reschedule_requests(booking_id,requested_by,proposed_start_at,proposed_end_at,state,note,responded_at,replacement_reservation_id,auto_accepted)
    values(b.id,auth.uid(),p_new_start_at,new_end,'accepted',p_note,now(),replacement_id,true) returning id into request_id;
  else
    if now()>=b.start_at then raise exception 'The booking has already started'; end if;
    replacement_id:=public.create_reschedule_reservation(b.id,p_new_start_at,least(b.start_at,now()+make_interval(hours=>greatest(1,request_hours))));
    insert into public.booking_reschedule_requests(booking_id,requested_by,proposed_start_at,proposed_end_at,state,note,expires_at,replacement_reservation_id,auto_accepted)
    values(b.id,auth.uid(),p_new_start_at,new_end,'pending',p_note,least(b.start_at,now()+make_interval(hours=>greatest(1,request_hours))),replacement_id,false) returning id into request_id;
  end if;
  select user_id into provider_user from public.provider_profiles where id=b.provider_id;
  perform public.queue_notification(provider_user,b.id,case when auto_ok then 'booking_changed' else 'reschedule_requested' end,case when auto_ok then 'Booking time changed' else 'Time-change request' end,case when auto_ok then 'The learner changed this booking within the permitted rescheduling window.' else 'The learner has requested a new booking time.' end,'/bookings/'||b.id,now(),'reschedule-provider-'||request_id);
  return jsonb_build_object('request_id',request_id,'auto_accepted',auto_ok,'replacement_reservation_id',replacement_id);
end; $$;
grant execute on function public.request_own_reschedule(uuid,timestamptz,text) to authenticated;

create or replace function public.provider_respond_reschedule(p_request_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rr public.booking_reschedule_requests%rowtype; b public.bookings%rowtype; p_id uuid; learner uuid;
begin
  select id into p_id from public.provider_profiles where user_id=auth.uid();
  select * into rr from public.booking_reschedule_requests where id=p_request_id for update;
  if rr.id is null or rr.state<>'pending' or rr.expires_at<=now() then raise exception 'Request is not active'; end if;
  select * into b from public.bookings where id=rr.booking_id and provider_id=p_id for update;
  if b.id is null then raise exception 'Provider booking access required'; end if;
  learner:=b.learner_user_id;
  if p_accept then
    update public.booking_reservations set state='cancelled' where id=b.reservation_id;
    update public.booking_reservations set state='booked',expires_at=null where id=rr.replacement_reservation_id and state='hold' and expires_at>now();
    if not found then raise exception 'Proposed time is no longer reserved'; end if;
    update public.bookings set reservation_id=rr.replacement_reservation_id,start_at=rr.proposed_start_at,end_at=rr.proposed_end_at,state='confirmed' where id=b.id;
    update public.booking_reschedule_requests set state='accepted',responded_at=now() where id=rr.id;
    perform public.queue_notification(learner,b.id,'reschedule_accepted','Time change accepted','Your provider accepted the new booking time.','/bookings/'||b.id,now(),'reschedule-accepted-'||rr.id);
  else
    update public.booking_reservations set state='released' where id=rr.replacement_reservation_id and state='hold';
    update public.booking_reschedule_requests set state='declined',responded_at=now() where id=rr.id;
    perform public.queue_notification(learner,b.id,'reschedule_declined','Time change declined','Your original booking time remains confirmed.','/bookings/'||b.id,now(),'reschedule-declined-'||rr.id);
  end if;
  return jsonb_build_object('state',case when p_accept then 'accepted' else 'declined' end);
end; $$;
grant execute on function public.provider_respond_reschedule(uuid,boolean) to authenticated;

create or replace function public.report_booking_no_show(p_booking_id uuid,p_missing_role text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; p_user uuid;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  select user_id into p_user from public.provider_profiles where id=b.provider_id;
  if b.id is null or auth.uid() not in (b.learner_user_id,p_user) then raise exception 'Booking access required'; end if;
  if now()<b.end_at then raise exception 'Wait until the appointment has ended before recording a no-show'; end if;
  if p_missing_role='learner' and auth.uid()=p_user then update public.bookings set state='no_show_learner' where id=b.id and state in ('confirmed','in_session');
  elsif p_missing_role='provider' and auth.uid()=b.learner_user_id then update public.bookings set state='no_show_provider' where id=b.id and state in ('confirmed','in_session');
  else raise exception 'Invalid no-show report'; end if;
  update public.provider_earnings set state='held',held_reason='No-show review' where booking_id=b.id and state in ('pending','available');
end; $$;
grant execute on function public.report_booking_no_show(uuid,text) to authenticated;

-- --------------------------------------------------------------------------
-- Help content Admin RPCs
-- --------------------------------------------------------------------------
create or replace function public.admin_upsert_help_content(p_id uuid,p_slug text,p_title text,p_text text,p_video_path text,p_audience text[],p_screen_key text,p_placement_key text,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare out_id uuid;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_id is null then
    insert into public.help_content(slug,title,text_explanation,video_path,audience,screen_key,placement_key,active,created_by,updated_by)
    values(p_slug,p_title,p_text,p_video_path,coalesce(p_audience,array['everyone']::text[]),p_screen_key,p_placement_key,coalesce(p_active,true),auth.uid(),auth.uid()) returning id into out_id;
  else
    update public.help_content set slug=p_slug,title=p_title,text_explanation=p_text,video_path=p_video_path,audience=coalesce(p_audience,audience),screen_key=p_screen_key,placement_key=p_placement_key,active=coalesce(p_active,active),updated_by=auth.uid() where id=p_id returning id into out_id;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when p_id is null then 'help_content_created' else 'help_content_updated' end,'help_content',out_id,jsonb_build_object('slug',p_slug,'active',p_active));
  return out_id;
end; $$;
grant execute on function public.admin_upsert_help_content(uuid,text,text,text,text,text[],text,text,boolean) to authenticated;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table public.user_deaf_verifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.booking_cancellations enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_funds enable row level security;
alter table public.credit_allocations enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.help_content enable row level security;

create policy "user_deaf_self_admin_read" on public.user_deaf_verifications for select to authenticated using(user_id=auth.uid() or public.current_is_admin());
create policy "push_self_manage" on public.push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "notification_preferences_self_manage" on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "notifications_self_read" on public.notifications for select to authenticated using(user_id=auth.uid() or public.current_is_admin());
create policy "cancellations_participants_admin_read" on public.booking_cancellations for select to authenticated using(public.is_booking_participant(booking_id) or public.current_is_admin());
create policy "sponsors_admin_read" on public.sponsors for select to authenticated using(public.current_is_admin());
create policy "funds_admin_read" on public.sponsor_funds for select to authenticated using(public.current_is_admin());
create policy "allocations_user_admin_read" on public.credit_allocations for select to authenticated using(user_id=auth.uid() or (user_id is null and exists(select 1 from public.user_deaf_verifications d where d.user_id=auth.uid() and d.state='approved')) or public.current_is_admin());
create policy "credit_reservations_user_admin_read" on public.credit_reservations for select to authenticated using(user_id=auth.uid() or public.current_is_admin());
create policy "help_active_read" on public.help_content for select to anon,authenticated using(active=true or public.current_is_admin());

-- Sponsor/Admin writes happen through Admin routes/service role; ordinary users cannot mutate funds.

-- Public/non-sensitive help videos live in their own bucket; only Admin/service routes upload.
insert into storage.buckets(id,name,public) values('help-videos','help-videos',true) on conflict(id) do nothing;
create policy "help_videos_public_read" on storage.objects for select to public using(bucket_id='help-videos');
create policy "help_videos_admin_insert" on storage.objects for insert to authenticated with check(bucket_id='help-videos' and public.current_is_admin());
create policy "help_videos_admin_update" on storage.objects for update to authenticated using(bucket_id='help-videos' and public.current_is_admin()) with check(bucket_id='help-videos' and public.current_is_admin());
create policy "help_videos_admin_delete" on storage.objects for delete to authenticated using(bucket_id='help-videos' and public.current_is_admin());

create or replace function public.admin_set_user_deaf_verification(p_user_id uuid,p_state public.verification_state,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  insert into public.user_deaf_verifications(user_id,state,reviewed_at,reviewed_by,internal_note)
  values(p_user_id,p_state,now(),auth.uid(),p_note)
  on conflict(user_id) do update set state=excluded.state,reviewed_at=now(),reviewed_by=auth.uid(),internal_note=p_note;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data,reason) values(auth.uid(),'user_deaf_verification_review','profile',p_user_id,jsonb_build_object('state',p_state),p_note);
end; $$;
grant execute on function public.admin_set_user_deaf_verification(uuid,public.verification_state,text) to authenticated;

create or replace function public.admin_allocate_sponsor_credit(p_fund_id uuid,p_user_id uuid,p_amount_cents integer,p_scope public.credit_scope,p_end_date date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare sf public.sponsor_funds%rowtype; committed integer:=0; remaining integer; allocation_id uuid;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_amount_cents<=0 then raise exception 'Allocation amount must be positive'; end if;
  select * into sf from public.sponsor_funds where id=p_fund_id and state='active' for update;
  if sf.id is null then raise exception 'Active sponsor fund not found'; end if;
  select coalesce(sum(case when ca.active then ca.allocated_cents else ca.used_cents end),0) into committed from public.credit_allocations ca where ca.fund_id=p_fund_id;
  remaining:=sf.programme_cents-committed;
  if p_amount_cents>remaining then raise exception 'Allocation exceeds available sponsor programme funds'; end if;
  insert into public.credit_allocations(fund_id,user_id,scope,allocated_cents,allocation_end_date,created_by)
  values(p_fund_id,p_user_id,p_scope,p_amount_cents,coalesce(p_end_date,sf.allocation_end_date),auth.uid()) returning id into allocation_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'sponsor_credit_allocated','credit_allocation',allocation_id,jsonb_build_object('fund_id',p_fund_id,'user_id',p_user_id,'amount_cents',p_amount_cents,'scope',p_scope));
  return allocation_id;
end; $$;
grant execute on function public.admin_allocate_sponsor_credit(uuid,uuid,integer,public.credit_scope,date) to authenticated;

create or replace function public.reclaim_expired_credit_allocations()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if auth.role()<>'service_role' and not public.current_is_admin() then raise exception 'Admin/service access required'; end if;
  update public.credit_allocations set active=false where active=true and allocation_end_date is not null and allocation_end_date<current_date and reserved_cents=0;
  get diagnostics n=row_count;
  return n;
end; $$;
grant execute on function public.reclaim_expired_credit_allocations() to authenticated,service_role;

-- Holds return reserved sponsor credits instead of orphaning them when checkout is abandoned.
create or replace function public.release_expired_booking_holds()
returns integer language plpgsql security definer set search_path='' as $$
declare rec record; n integer:=0;
begin
  for rec in select br.id from public.booking_reservations br where br.state='hold' and br.expires_at<=now() for update skip locked loop
    perform public.release_reserved_sponsorship(rec.id);
    update public.booking_reservations set state='expired' where id=rec.id and state='hold'; n:=n+1;
  end loop;
  return n;
end; $$;
grant execute on function public.release_expired_booking_holds() to anon,authenticated,service_role;

create or replace function public.release_own_booking_hold(p_hold_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.booking_reservations where id=p_hold_id and learner_user_id=auth.uid() and state='hold') then return; end if;
  perform public.release_reserved_sponsorship(p_hold_id);
  update public.booking_reservations set state='released' where id=p_hold_id and learner_user_id=auth.uid() and state='hold';
end; $$;
grant execute on function public.release_own_booking_hold(uuid) to authenticated;

-- Tighten sponsor allocation scope and monthly subsidy limits.
create or replace function public.admin_allocate_sponsor_credit(p_fund_id uuid,p_user_id uuid,p_amount_cents integer,p_scope public.credit_scope,p_end_date date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare sf public.sponsor_funds%rowtype; committed integer:=0; remaining integer; allocation_id uuid;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_amount_cents<=0 then raise exception 'Allocation amount must be positive'; end if;
  select * into sf from public.sponsor_funds where id=p_fund_id and state='active' for update;
  if sf.id is null then raise exception 'Active sponsor fund not found'; end if;
  if sf.credit_scope<>'any_service' and p_scope<>sf.credit_scope then raise exception 'Allocation scope is broader/different from the sponsor fund'; end if;
  select coalesce(sum(case when ca.active then ca.allocated_cents else ca.used_cents end),0) into committed from public.credit_allocations ca where ca.fund_id=p_fund_id;
  remaining:=sf.programme_cents-committed;
  if p_amount_cents>remaining then raise exception 'Allocation exceeds available sponsor programme funds'; end if;
  insert into public.credit_allocations(fund_id,user_id,scope,allocated_cents,allocation_end_date,created_by)
  values(p_fund_id,p_user_id,p_scope,p_amount_cents,coalesce(p_end_date,sf.allocation_end_date),auth.uid()) returning id into allocation_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'sponsor_credit_allocated','credit_allocation',allocation_id,jsonb_build_object('fund_id',p_fund_id,'user_id',p_user_id,'amount_cents',p_amount_cents,'scope',p_scope));
  return allocation_id;
end; $$;

create or replace function public.reserve_sponsorship_for_own_hold(p_hold_id uuid,p_requested_cents integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.booking_reservations%rowtype; a public.credit_allocations%rowtype; sf public.sponsor_funds%rowtype; available integer; amount integer; deaf_ok boolean; month_used integer:=0; month_remaining integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.booking_reservations where id=p_hold_id and learner_user_id=auth.uid() and state='hold' and expires_at>now() for update;
  if r.id is null then raise exception 'Active checkout hold required'; end if;
  if exists(select 1 from public.payment_transactions where hold_id=r.id and state in ('initialized','pending','success')) then raise exception 'Choose sponsorship before payment starts'; end if;
  if exists(select 1 from public.credit_reservations where hold_id=r.id and state='reserved') then select cr.amount_cents into amount from public.credit_reservations cr where cr.hold_id=r.id and cr.state='reserved'; return jsonb_build_object('subsidy_cents',amount,'cash_due_cents',r.price_cents_snapshot-amount); end if;
  select exists(select 1 from public.user_deaf_verifications d where d.user_id=auth.uid() and d.state='approved') into deaf_ok;
  select ca.* into a from public.credit_allocations ca join public.sponsor_funds f on f.id=ca.fund_id
  where ca.active=true and f.state='active' and (ca.allocation_end_date is null or ca.allocation_end_date>=current_date) and (f.allocation_end_date is null or f.allocation_end_date>=current_date)
    and public.credit_scope_matches_service(ca.scope,r.service_id) and (ca.user_id=auth.uid() or (ca.user_id is null and deaf_ok)) and ca.allocated_cents-ca.reserved_cents-ca.used_cents>0
  order by (ca.user_id=auth.uid()) desc,ca.created_at asc limit 1 for update;
  if a.id is null then return jsonb_build_object('subsidy_cents',0,'cash_due_cents',r.price_cents_snapshot,'reason','no_eligible_credit'); end if;
  select * into sf from public.sponsor_funds where id=a.fund_id;
  select coalesce(sum(cr.amount_cents),0) into month_used from public.credit_reservations cr join public.credit_allocations ca on ca.id=cr.allocation_id
   where ca.fund_id=a.fund_id and cr.user_id=auth.uid() and cr.state='used' and cr.updated_at>=date_trunc('month',now());
  month_remaining:=case when sf.max_per_user_month_cents is null then r.price_cents_snapshot else greatest(0,sf.max_per_user_month_cents-month_used) end;
  available:=a.allocated_cents-a.reserved_cents-a.used_cents;
  amount:=least(r.price_cents_snapshot,available,coalesce(p_requested_cents,r.price_cents_snapshot),coalesce(sf.max_per_booking_cents,r.price_cents_snapshot),month_remaining);
  if amount<=0 then return jsonb_build_object('subsidy_cents',0,'cash_due_cents',r.price_cents_snapshot,'reason','monthly_or_booking_limit_reached'); end if;
  update public.credit_allocations set reserved_cents=reserved_cents+amount where id=a.id;
  insert into public.credit_reservations(allocation_id,hold_id,user_id,amount_cents) values(a.id,r.id,auth.uid(),amount);
  update public.booking_reservations set sponsor_subsidy_cents=amount where id=r.id;
  return jsonb_build_object('subsidy_cents',amount,'cash_due_cents',r.price_cents_snapshot-amount,'allocation_id',a.id);
end; $$;

-- Participant-safe reversal used by cancellation RPCs; the booking must already be in a cancellation state.
create or replace function public.return_used_credit_for_booking(p_booking_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cr public.credit_reservations%rowtype; b public.bookings%rowtype; p_user uuid;
begin
  select * into b from public.bookings where id=p_booking_id;
  select user_id into p_user from public.provider_profiles where id=b.provider_id;
  if auth.role()<>'service_role' and not public.current_is_admin() and not (b.state in ('cancelled_by_learner','cancelled_by_provider') and auth.uid() in (b.learner_user_id,p_user)) then raise exception 'Admin/service or cancelling participant access required'; end if;
  select * into cr from public.credit_reservations where booking_id=p_booking_id and state='used' for update;
  if cr.id is null then return 0; end if;
  update public.credit_allocations set used_cents=greatest(0,used_cents-cr.amount_cents) where id=cr.allocation_id;
  update public.credit_reservations set state='reversed' where id=cr.id;
  return cr.amount_cents;
end; $$;

create or replace function public.release_expired_booking_holds()
returns integer language plpgsql security definer set search_path='' as $$
declare rec record; cr record; n integer:=0;
begin
  for rec in select br.id from public.booking_reservations br where br.state='hold' and br.expires_at<=now() for update skip locked loop
    for cr in select * from public.credit_reservations where hold_id=rec.id and state='reserved' for update loop
      update public.credit_allocations set reserved_cents=greatest(0,reserved_cents-cr.amount_cents) where id=cr.allocation_id;
      update public.credit_reservations set state='released' where id=cr.id;
    end loop;
    update public.booking_reservations set state='expired',sponsor_subsidy_cents=0 where id=rec.id and state='hold'; n:=n+1;
  end loop;
  return n;
end; $$;
