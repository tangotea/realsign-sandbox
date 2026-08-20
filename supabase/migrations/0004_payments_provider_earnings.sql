-- RealSign V1 / Milestone 4
-- Paystack payment lifecycle, immutable finance events, provider payout setup,
-- pending/available earnings, weekly payout batches and refunds.

create type public.payment_state as enum (
  'initialized','pending','success','failed','abandoned','refund_pending',
  'partially_refunded','refunded','manual_review'
);
create type public.earning_state as enum ('pending','available','held','payout_scheduled','paid','reversed');
create type public.payout_account_state as enum ('not_started','pending_validation','verified','failed','security_hold');
create type public.payout_batch_state as enum ('draft','submitted','processing','paid','partially_failed','failed');
create type public.payout_item_state as enum ('scheduled','submitted','processing','paid','failed','reversed');
create type public.refund_state as enum ('pending','processing','needs_attention','processed','failed');
create type public.ledger_direction as enum ('credit','debit');

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.booking_reservations(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  learner_user_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  reference text not null unique,
  paystack_transaction_id numeric(20,0),
  currency text not null default 'ZAR' check(currency='ZAR'),
  amount_cents integer not null check(amount_cents >= 0),
  platform_fee_bps_snapshot integer not null check(platform_fee_bps_snapshot between 0 and 10000),
  platform_fee_cents integer,
  provider_earning_cents integer,
  gateway_fee_cents integer,
  state public.payment_state not null default 'initialized',
  checkout_url text,
  access_code text,
  channel text,
  paid_at timestamptz,
  gateway_response text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payment_transactions_touch_updated_at before update on public.payment_transactions
for each row execute function public.touch_updated_at();
create unique index payment_transactions_one_active_per_hold
on public.payment_transactions(hold_id)
where state in ('initialized','pending','success','refund_pending','partially_refunded');
create index payment_transactions_booking_idx on public.payment_transactions(booking_id);
create index payment_transactions_provider_idx on public.payment_transactions(provider_id,created_at desc);

create table public.financial_ledger (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings(id) on delete set null,
  payment_id uuid references public.payment_transactions(id) on delete set null,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  category text not null check(category in (
    'customer_payment','platform_fee','gateway_fee','provider_earning','refund','provider_payout','payout_fee','manual_adjustment'
  )),
  direction public.ledger_direction not null,
  amount_cents integer not null check(amount_cents >= 0),
  currency text not null default 'ZAR' check(currency='ZAR'),
  reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index financial_ledger_booking_idx on public.financial_ledger(booking_id,created_at);
create index financial_ledger_provider_idx on public.financial_ledger(provider_id,created_at desc);

create table public.provider_earnings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  payment_id uuid not null unique references public.payment_transactions(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  gross_booking_cents integer not null check(gross_booking_cents >= 0),
  platform_fee_cents integer not null check(platform_fee_cents >= 0),
  amount_cents integer not null check(amount_cents >= 0),
  state public.earning_state not null default 'pending',
  release_after timestamptz not null,
  held_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger provider_earnings_touch_updated_at before update on public.provider_earnings
for each row execute function public.touch_updated_at();
create index provider_earnings_provider_state_idx on public.provider_earnings(provider_id,state,release_after);

create table public.provider_payout_accounts (
  provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
  state public.payout_account_state not null default 'not_started',
  recipient_code text unique,
  bank_code text,
  bank_name text,
  account_name text,
  account_type text check(account_type in ('personal','business')),
  account_last4 text,
  validation_metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  security_hold_until timestamptz,
  changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger provider_payout_accounts_touch_updated_at before update on public.provider_payout_accounts
for each row execute function public.touch_updated_at();

create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  state public.payout_batch_state not null default 'draft',
  currency text not null default 'ZAR' check(currency='ZAR'),
  total_cents integer not null default 0 check(total_cents >= 0),
  provider_count integer not null default 0 check(provider_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payout_batches_touch_updated_at before update on public.payout_batches
for each row execute function public.touch_updated_at();

create table public.payout_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  payout_account_provider_id uuid not null references public.provider_payout_accounts(provider_id) on delete restrict,
  reference text not null unique,
  recipient_code text not null,
  amount_cents integer not null check(amount_cents > 0),
  state public.payout_item_state not null default 'scheduled',
  transfer_code text,
  gateway_status text,
  failure_reason text,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id,provider_id)
);
create trigger payout_items_touch_updated_at before update on public.payout_items
for each row execute function public.touch_updated_at();
create index payout_items_batch_state_idx on public.payout_items(batch_id,state);

create table public.payout_item_earnings (
  payout_item_id uuid not null references public.payout_items(id) on delete cascade,
  earning_id uuid not null unique references public.provider_earnings(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(payout_item_id,earning_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payment_transactions(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  amount_cents integer not null check(amount_cents > 0),
  provider_liability_cents integer not null default 0 check(provider_liability_cents >= 0),
  platform_liability_cents integer not null default 0 check(platform_liability_cents >= 0),
  state public.refund_state not null default 'pending',
  paystack_refund_id numeric(20,0),
  reason text,
  initiated_by uuid references public.profiles(id) on delete set null,
  gateway_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(provider_liability_cents + platform_liability_cents <= amount_cents)
);
create trigger refunds_touch_updated_at before update on public.refunds
for each row execute function public.touch_updated_at();
create index refunds_payment_idx on public.refunds(payment_id,state);

insert into public.platform_settings(key,value) values
 ('standard_platform_fee_bps','1500'::jsonb),
 ('payment_pending_hold_min','20'::jsonb),
 ('earnings_clearance_hours','24'::jsonb),
 ('payout_security_hold_hours','24'::jsonb),
 ('weekly_payout_weekday','5'::jsonb)
on conflict(key) do nothing;

-- Payment preparation remains user-authenticated but price/fees come only from trusted DB state.
create or replace function public.prepare_own_booking_payment(p_hold_id uuid,p_reference text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.booking_reservations%rowtype;
  existing public.payment_transactions%rowtype;
  fee_bps integer := 1500;
  pending_min integer := 20;
  p_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reference is null or length(p_reference) < 16 then raise exception 'Invalid payment reference'; end if;

  select * into r from public.booking_reservations where id=p_hold_id and learner_user_id=auth.uid() for update;
  if r.id is null then raise exception 'Checkout hold not found'; end if;
  if r.state <> 'hold' or r.expires_at is null or r.expires_at <= now() then raise exception 'Checkout hold has expired'; end if;

  select * into existing from public.payment_transactions
  where hold_id=r.id and state in ('initialized','pending','success','refund_pending','partially_refunded')
  order by created_at desc limit 1;
  if existing.id is not null then
    return jsonb_build_object('payment_id',existing.id,'reference',existing.reference,'amount_cents',existing.amount_cents,'checkout_url',existing.checkout_url,'state',existing.state);
  end if;

  select coalesce((value #>> '{}')::integer,1500) into fee_bps from public.platform_settings where key='standard_platform_fee_bps';
  select coalesce((value #>> '{}')::integer,20) into pending_min from public.platform_settings where key='payment_pending_hold_min';
  fee_bps := greatest(0,least(coalesce(fee_bps,1500),10000));
  pending_min := greatest(5,coalesce(pending_min,20));

  -- The original 5-minute hold is the time to START checkout. Once payment starts,
  -- keep the same slot protected during the configured payment window.
  update public.booking_reservations set expires_at=now()+make_interval(mins=>pending_min) where id=r.id;

  insert into public.payment_transactions(hold_id,learner_user_id,provider_id,reference,amount_cents,platform_fee_bps_snapshot,state,metadata)
  values(r.id,r.learner_user_id,r.provider_id,p_reference,r.price_cents_snapshot,fee_bps,'initialized',jsonb_build_object('service_id',r.service_id))
  returning id into p_id;

  return jsonb_build_object('payment_id',p_id,'reference',p_reference,'amount_cents',r.price_cents_snapshot,'state','initialized');
end;
$$;
grant execute on function public.prepare_own_booking_payment(uuid,text) to authenticated;

create or replace function public.record_successful_paystack_payment(
  p_reference text,
  p_paystack_transaction_id numeric,
  p_amount_cents integer,
  p_gateway_fee_cents integer default 0,
  p_channel text default null,
  p_paid_at timestamptz default now(),
  p_gateway_response text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  pt public.payment_transactions%rowtype;
  r public.booking_reservations%rowtype;
  b_id uuid;
  fee_cents integer;
  earning_cents integer;
  clearance_hours integer := 24;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into pt from public.payment_transactions where reference=p_reference for update;
  if pt.id is null then return jsonb_build_object('status','unknown_reference'); end if;
  if pt.state in ('success','refund_pending','partially_refunded','refunded') and pt.booking_id is not null then
    return jsonb_build_object('status','already_finalized','booking_id',pt.booking_id);
  end if;
  if p_amount_cents <> pt.amount_cents then
    update public.payment_transactions set state='manual_review',gateway_response='Amount mismatch' where id=pt.id;
    return jsonb_build_object('status','manual_review','reason','amount_mismatch');
  end if;

  select * into r from public.booking_reservations where id=pt.hold_id for update;
  if r.id is null or r.state <> 'hold' or r.expires_at is null or r.expires_at <= now() then
    update public.payment_transactions set state='manual_review',paystack_transaction_id=p_paystack_transaction_id,gateway_fee_cents=coalesce(p_gateway_fee_cents,0),paid_at=p_paid_at,gateway_response='Paid after protected hold was no longer valid' where id=pt.id;
    return jsonb_build_object('status','manual_review','reason','reservation_unavailable');
  end if;

  -- Update the reservation first. Its existing exclusion constraint remains the final overlap guard.
  update public.booking_reservations set state='booked',expires_at=null where id=r.id;
  insert into public.bookings(reservation_id,learner_user_id,provider_id,service_id,start_at,end_at,price_cents,learner_for,learner_first_name,learner_grade,learner_note,payment_reference)
  values(r.id,r.learner_user_id,r.provider_id,r.service_id,r.start_at,r.end_at,r.price_cents_snapshot,r.learner_for,r.learner_first_name,r.learner_grade,r.learner_note,p_reference)
  returning id into b_id;

  fee_cents := round((pt.amount_cents::numeric * pt.platform_fee_bps_snapshot::numeric)/10000.0)::integer;
  fee_cents := greatest(0,least(fee_cents,pt.amount_cents));
  earning_cents := pt.amount_cents-fee_cents;
  select coalesce((value #>> '{}')::integer,24) into clearance_hours from public.platform_settings where key='earnings_clearance_hours';

  update public.payment_transactions
  set booking_id=b_id,state='success',paystack_transaction_id=p_paystack_transaction_id,
      platform_fee_cents=fee_cents,provider_earning_cents=earning_cents,gateway_fee_cents=coalesce(p_gateway_fee_cents,0),
      channel=p_channel,paid_at=p_paid_at,gateway_response=p_gateway_response
  where id=pt.id;

  insert into public.provider_earnings(booking_id,payment_id,provider_id,gross_booking_cents,platform_fee_cents,amount_cents,state,release_after)
  values(b_id,pt.id,pt.provider_id,pt.amount_cents,fee_cents,earning_cents,'pending',r.end_at+make_interval(hours=>greatest(0,coalesce(clearance_hours,24))));

  insert into public.financial_ledger(booking_id,payment_id,provider_id,category,direction,amount_cents,reference) values
   (b_id,pt.id,pt.provider_id,'customer_payment','credit',pt.amount_cents,p_reference),
   (b_id,pt.id,pt.provider_id,'platform_fee','credit',fee_cents,p_reference),
   (b_id,pt.id,pt.provider_id,'gateway_fee','debit',coalesce(p_gateway_fee_cents,0),p_reference),
   (b_id,pt.id,pt.provider_id,'provider_earning','debit',earning_cents,p_reference);

  return jsonb_build_object('status','success','booking_id',b_id,'provider_earning_cents',earning_cents,'platform_fee_cents',fee_cents);
exception when exclusion_violation then
  update public.payment_transactions set state='manual_review',gateway_response='Paid transaction conflicted with provider time' where id=pt.id;
  return jsonb_build_object('status','manual_review','reason','provider_time_conflict');
end;
$$;
revoke all on function public.record_successful_paystack_payment(text,numeric,integer,integer,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_successful_paystack_payment(text,numeric,integer,integer,text,timestamptz,text) to service_role;

create or replace function public.release_provider_earnings()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare n integer;
begin
  -- Service role or finance/super Admin may run this. Only completed, undisputed bookings clear.
  if auth.role()<>'service_role' and not exists(select 1 from public.admin_profiles a where a.user_id=auth.uid() and a.is_active=true and a.role in ('super','finance')) then raise exception 'Finance Admin access required'; end if;
  update public.provider_earnings pe
  set state='available'
  from public.bookings b
  where pe.booking_id=b.id and pe.state='pending' and pe.release_after<=now() and b.state='completed';
  get diagnostics n=row_count;
  return n;
end;
$$;
grant execute on function public.release_provider_earnings() to service_role,authenticated;

create or replace function public.refresh_payout_batch_state(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare total_count integer; paid_count integer; failed_count integer; active_count integer;
begin
  if auth.role()<>'service_role' and not exists(select 1 from public.admin_profiles a where a.user_id=auth.uid() and a.is_active=true and a.role in ('super','finance')) then raise exception 'Finance Admin access required'; end if;
  select count(*),count(*) filter(where state='paid'),count(*) filter(where state in ('failed','reversed')),count(*) filter(where state in ('scheduled','submitted','processing'))
  into total_count,paid_count,failed_count,active_count from public.payout_items where batch_id=p_batch_id;
  update public.payout_batches set state=case
    when total_count=0 then 'draft'::public.payout_batch_state
    when paid_count=total_count then 'paid'::public.payout_batch_state
    when active_count>0 then 'processing'::public.payout_batch_state
    when failed_count>0 and paid_count>0 then 'partially_failed'::public.payout_batch_state
    else 'failed'::public.payout_batch_state end,
    completed_at=case when active_count=0 and total_count>0 then now() else null end
  where id=p_batch_id;
end;
$$;
grant execute on function public.refresh_payout_batch_state(uuid) to service_role,authenticated;

-- RLS -----------------------------------------------------------------------
alter table public.payment_transactions enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.provider_earnings enable row level security;
alter table public.provider_payout_accounts enable row level security;
alter table public.payout_batches enable row level security;
alter table public.payout_items enable row level security;
alter table public.payout_item_earnings enable row level security;
alter table public.refunds enable row level security;

create policy "payments_participants_admin_read" on public.payment_transactions for select to authenticated using(
  learner_user_id=auth.uid()
  or exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid())
  or public.current_is_admin()
);
create policy "ledger_provider_admin_read" on public.financial_ledger for select to authenticated using(
  (provider_id is not null and exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()))
  or public.current_is_admin()
);
create policy "earnings_provider_admin_read" on public.provider_earnings for select to authenticated using(
  exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.current_is_admin()
);
create policy "payout_account_provider_admin_read" on public.provider_payout_accounts for select to authenticated using(
  exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.current_is_admin()
);
create policy "payout_batches_admin_read" on public.payout_batches for select to authenticated using(public.current_is_admin());
create policy "payout_items_provider_admin_read" on public.payout_items for select to authenticated using(
  exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.current_is_admin()
);
create policy "payout_item_earnings_provider_admin_read" on public.payout_item_earnings for select to authenticated using(
  exists(select 1 from public.payout_items pi join public.provider_profiles p on p.id=pi.provider_id where pi.id=payout_item_id and p.user_id=auth.uid()) or public.current_is_admin()
);
create policy "refunds_participants_admin_read" on public.refunds for select to authenticated using(
  exists(select 1 from public.bookings b join public.provider_profiles p on p.id=b.provider_id where b.id=booking_id and (b.learner_user_id=auth.uid() or p.user_id=auth.uid()))
  or public.current_is_admin()
);

-- No ordinary client receives INSERT/UPDATE policies for money-moving tables.
-- All writes happen through trusted server routes/service-role code or tightly scoped RPCs.

-- Providers are not discoverable/bookable until payout setup is complete.
-- A temporary security hold after changing bank details pauses payouts, not new bookings.
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
language sql stable security definer set search_path=''
as $$
  with eligible as (
    select distinct p.id
    from public.provider_profiles p
    join public.provider_roles pr on pr.provider_id=p.id and pr.approved=true
    join public.provider_services s on s.provider_id=p.id and s.status='active'
    join public.provider_payout_accounts ppa on ppa.provider_id=p.id and ppa.recipient_code is not null and ppa.state in ('verified','security_hold')
    left join public.provider_subjects ps on ps.provider_id=p.id
    where p.status='approved'
      and (p_role is null or pr.role=p_role)
      and (p_subject_id is null or s.subject_id=p_subject_id or ps.subject_id=p_subject_id)
      and (p_grade is null or ((s.min_grade is null or s.min_grade<=p_grade) and (s.max_grade is null or s.max_grade>=p_grade)) or ((ps.min_grade is null or ps.min_grade<=p_grade) and (ps.max_grade is null or ps.max_grade>=p_grade)))
      and (p_language_code is null or exists(select 1 from public.user_languages ul join public.languages l on l.id=ul.language_id where ul.user_id=p.user_id and l.code=p_language_code and l.active=true))
  ), service_pick as (
    select distinct on (s.provider_id) s.provider_id,s.id,s.title,s.duration_min,s.price_cents
    from public.provider_services s join eligible e on e.id=s.provider_id
    where s.status='active' and (p_subject_id is null or s.subject_id=p_subject_id)
      and (p_grade is null or ((s.min_grade is null or s.min_grade<=p_grade) and (s.max_grade is null or s.max_grade>=p_grade)))
    order by s.provider_id,s.price_cents asc,s.duration_min asc,s.created_at asc
  )
  select p.id,coalesce(nullif(p.public_display_name,''),'RealSign Provider'),p.introduction_text,p.introduction_video_path,
    array(select distinct replace(pr.role::text,'_',' ') from public.provider_roles pr where pr.provider_id=p.id and pr.approved=true order by 1),
    array(select l.name from public.user_languages ul join public.languages l on l.id=ul.language_id where ul.user_id=p.user_id and l.active=true order by l.display_order),
    array(select distinct sub.name from public.provider_subjects ps join public.subjects sub on sub.id=ps.subject_id where ps.provider_id=p.id and sub.active=true order by 1),
    sp.price_cents,sp.id,sp.title,sp.duration_min
  from eligible e join public.provider_profiles p on p.id=e.id join service_pick sp on sp.provider_id=p.id
  order by sp.price_cents asc,p.public_display_name asc
  limit greatest(1,least(coalesce(p_limit,30),100));
$$;
grant execute on function public.search_marketplace_providers(uuid,smallint,text,public.provider_role_type,integer) to anon,authenticated;

create or replace function public.get_service_slots(p_service_id uuid,p_date date)
returns table(start_at timestamptz,end_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare v_provider uuid;v_duration integer;v_notice integer;v_buffer integer;v_timezone text;v_date_blocked boolean;
begin
  select s.provider_id,s.duration_min,pbs.booking_notice_min,pbs.buffer_min,pbs.timezone into v_provider,v_duration,v_notice,v_buffer,v_timezone
  from public.provider_services s
  join public.provider_profiles p on p.id=s.provider_id and p.status='approved'
  join public.provider_booking_settings pbs on pbs.provider_id=s.provider_id
  join public.provider_payout_accounts ppa on ppa.provider_id=s.provider_id and ppa.recipient_code is not null and ppa.state in ('verified','security_hold')
  where s.id=p_service_id and s.status='active';
  if v_provider is null then return; end if;
  select exists(select 1 from public.availability_exceptions ae where ae.provider_id=v_provider and ae.date=p_date and ae.type='blocked' and ae.start_time is null and ae.end_time is null) into v_date_blocked;
  if v_date_blocked then return; end if;
  return query
  with windows as (
    select ar.start_time,ar.end_time from public.availability_rules ar where ar.provider_id=v_provider and ar.active=true and ar.weekday=extract(dow from p_date)::smallint
    union all select ae.start_time,ae.end_time from public.availability_exceptions ae where ae.provider_id=v_provider and ae.date=p_date and ae.type='extra' and ae.start_time is not null and ae.end_time is not null
  ), candidates as (
    select gs as slot_start,gs+make_interval(mins=>v_duration) as slot_end
    from windows w cross join lateral generate_series(
      ((p_date::text||' '||w.start_time::text)::timestamp at time zone v_timezone),
      ((p_date::text||' '||w.end_time::text)::timestamp at time zone v_timezone)-make_interval(mins=>v_duration),
      make_interval(mins=>v_duration+v_buffer)) gs
  )
  select distinct c.slot_start,c.slot_end from candidates c
  where c.slot_start>=now()+make_interval(mins=>v_notice)
    and not exists(select 1 from public.availability_exceptions ae where ae.provider_id=v_provider and ae.date=p_date and ae.type='blocked' and ae.start_time is not null and ae.end_time is not null and tstzrange(c.slot_start,c.slot_end,'[)')&&tstzrange(((p_date::text||' '||ae.start_time::text)::timestamp at time zone v_timezone),((p_date::text||' '||ae.end_time::text)::timestamp at time zone v_timezone),'[)'))
    and not exists(select 1 from public.booking_reservations br where br.provider_id=v_provider and (br.state='booked' or (br.state='hold' and br.expires_at>now())) and tstzrange(c.slot_start,c.slot_end+make_interval(mins=>v_buffer),'[)')&&tstzrange(br.start_at,br.block_end_at,'[)'))
  order by c.slot_start;
end;
$$;
grant execute on function public.get_service_slots(uuid,date) to anon,authenticated;
