-- RealSign V1 / Milestone 7
-- Interpreter request-to-book, technical-resolution credits, moderation,
-- sponsor impact/statistics, transactional-email queue, privacy retention jobs.

create type public.interpreter_request_state as enum ('pending','accepted','declined','expired','cancelled','awaiting_payment','confirmed');
create type public.moderation_action as enum ('keep','hide','restore','remove_private_information','warn_reviewer');
create type public.outbound_email_state as enum ('queued','sent','failed','skipped');

create table public.interpreter_requests (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  service_id uuid not null references public.provider_services(id) on delete restrict,
  mode text not null check(mode in ('remote','in_person')),
  requested_start_at timestamptz not null,
  requested_end_at timestamptz not null,
  location_text text,
  context_category text not null default 'general',
  note text check(note is null or char_length(note)<=1500),
  state public.interpreter_request_state not null default 'pending',
  expires_at timestamptz not null default (now()+interval '6 hours'),
  replacement_reservation_id uuid references public.booking_reservations(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(requested_end_at>requested_start_at),
  check((mode='remote') or nullif(trim(location_text),'') is not null)
);
create trigger interpreter_requests_touch_updated_at before update on public.interpreter_requests for each row execute function public.touch_updated_at();
create index interpreter_requests_provider_idx on public.interpreter_requests(provider_id,state,requested_start_at);
create index interpreter_requests_learner_idx on public.interpreter_requests(learner_user_id,created_at desc);

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.booking_reviews(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  detail text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution public.moderation_action,
  created_at timestamptz not null default now(),
  unique(review_id,reported_by)
);

create table public.technical_resolutions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  learner_user_id uuid not null references public.profiles(id) on delete restrict,
  resolution_type text not null check(resolution_type in ('none','credit','partial_refund','full_refund','manual_review')),
  amount_cents integer not null default 0 check(amount_cents>=0),
  note text,
  issued_credit_allocation_id uuid references public.credit_allocations(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Transactional email is provider-neutral: a scheduled worker resolves the user's auth email
-- and posts this template/payload to the configured email transport.
create table public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  template_key text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  state public.outbound_email_state not null default 'queued',
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index outbound_emails_due_idx on public.outbound_emails(state,scheduled_for);

-- Internal RealSign technical-resolution fund. It reuses the existing credit engine so
-- technical credits behave exactly like non-transferable booking subsidies.
insert into public.sponsors(name,active)
select 'RealSign Technical Resolution',true
where not exists(select 1 from public.sponsors where name='RealSign Technical Resolution');

insert into public.sponsor_funds(sponsor_id,name,original_contribution_cents,admin_fee_bps,admin_fee_cents,programme_cents,credit_scope,state,notes)
select s.id,'RealSign Technical Credits',1,0,0,1,'any_service','active','System-managed technical resolution fund; programme balance is increased only when Admin issues a technical credit.'
from public.sponsors s
where s.name='RealSign Technical Resolution'
and not exists(select 1 from public.sponsor_funds f where f.name='RealSign Technical Credits');

create or replace function public.create_interpreter_request(
  p_provider_id uuid,p_service_id uuid,p_mode text,p_start timestamptz,p_location text default null,p_context text default 'general',p_note text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare svc public.provider_services%rowtype; out_id uuid; provider_user uuid; expiry_hours integer:=6;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from public.user_identity_verifications i where i.user_id=auth.uid() and i.state='approved') then raise exception 'Identity verification is required'; end if;
  select * into svc from public.provider_services where id=p_service_id and provider_id=p_provider_id and provider_role='interpreter' and status='active';
  if svc.id is null then raise exception 'Interpreter service not found'; end if;
  if p_mode='remote' and not svc.remote then raise exception 'This service is not remote'; end if;
  if p_mode='in_person' and not svc.in_person then raise exception 'This service is not in person'; end if;
  if p_start<=now() then raise exception 'Choose a future time'; end if;
  select coalesce((value#>>'{}')::integer,6) into expiry_hours from public.platform_settings where key='interpreter_request_expiry_hours';
  insert into public.interpreter_requests(learner_user_id,provider_id,service_id,mode,requested_start_at,requested_end_at,location_text,context_category,note,expires_at)
  values(auth.uid(),p_provider_id,p_service_id,p_mode,p_start,p_start+make_interval(mins=>svc.duration_min),nullif(trim(p_location),''),coalesce(nullif(trim(p_context),''),'general'),nullif(trim(p_note),''),now()+make_interval(hours=>greatest(1,expiry_hours))) returning id into out_id;
  select user_id into provider_user from public.provider_profiles where id=p_provider_id;
  perform public.queue_notification(provider_user,null,'system','New interpreting request','A learner sent you an interpreting request.','/provider/requests',now(),'interpreter-request-'||out_id);
  insert into public.outbound_emails(user_id,template_key,subject,payload,dedupe_key)
  values(provider_user,'interpreter_request','New RealSign interpreting request',jsonb_build_object('request_id',out_id),'email-interpreter-request-'||out_id);
  return out_id;
end; $$;
grant execute on function public.create_interpreter_request(uuid,uuid,text,timestamptz,text,text,text) to authenticated;

create or replace function public.respond_interpreter_request(p_request_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.interpreter_requests%rowtype; pbs public.provider_booking_settings%rowtype; svc public.provider_services%rowtype; provider_user uuid; hold_id uuid; hold_exp timestamptz; payment_hours integer:=24;
begin
  select ir.* into r from public.interpreter_requests ir where ir.id=p_request_id for update;
  if r.id is null or r.state<>'pending' then raise exception 'Request is no longer pending'; end if;
  select user_id into provider_user from public.provider_profiles where id=r.provider_id;
  if provider_user<>auth.uid() then raise exception 'Provider access required'; end if;
  if r.expires_at<=now() then update public.interpreter_requests set state='expired' where id=r.id; raise exception 'Request expired'; end if;
  if not p_accept then
    update public.interpreter_requests set state='declined',responded_at=now() where id=r.id;
    perform public.queue_notification(r.learner_user_id,null,'system','Interpreter request declined','This interpreter is not available for the requested assignment.','/bookings',now(),'interpreter-declined-'||r.id);
    return jsonb_build_object('state','declined');
  end if;
  select * into svc from public.provider_services where id=r.service_id;
  select * into pbs from public.provider_booking_settings where provider_id=r.provider_id;
  select coalesce((value#>>'{}')::integer,24) into payment_hours from public.platform_settings where key='interpreter_payment_hold_hours';
  hold_exp:=now()+make_interval(hours=>greatest(1,payment_hours));
  insert into public.booking_reservations(provider_id,service_id,learner_user_id,start_at,end_at,block_end_at,price_cents_snapshot,state,expires_at,learner_note)
  values(r.provider_id,r.service_id,r.learner_user_id,r.requested_start_at,r.requested_end_at,r.requested_end_at+make_interval(mins=>coalesce(pbs.buffer_min,15)),svc.price_cents,'hold',hold_exp,r.note)
  returning id into hold_id;
  update public.interpreter_requests set state='awaiting_payment',replacement_reservation_id=hold_id,responded_at=now() where id=r.id;
  perform public.queue_notification(r.learner_user_id,null,'system','Interpreter accepted','Your interpreter accepted the request. Confirm payment to secure the booking.','/checkout/'||hold_id,now(),'interpreter-accepted-'||r.id);
  insert into public.outbound_emails(user_id,template_key,subject,payload,dedupe_key)
  values(r.learner_user_id,'interpreter_accepted','Your RealSign interpreter accepted',jsonb_build_object('request_id',r.id,'hold_id',hold_id),'email-interpreter-accepted-'||r.id);
  return jsonb_build_object('state','awaiting_payment','hold_id',hold_id,'expires_at',hold_exp);
exception when exclusion_violation then
  raise exception 'That time now conflicts with another provider booking';
end; $$;
grant execute on function public.respond_interpreter_request(uuid,boolean) to authenticated;

create or replace function public.expire_interpreter_requests()
returns integer language plpgsql security definer set search_path='' as $$ declare n integer; begin
  if auth.role()<>'service_role' and not public.current_is_admin() then raise exception 'Admin/service access required'; end if;
  update public.interpreter_requests set state='expired' where state='pending' and expires_at<=now(); get diagnostics n=row_count; return n;
end $$;
grant execute on function public.expire_interpreter_requests() to service_role,authenticated;

create or replace function public.admin_issue_technical_credit(p_booking_id uuid,p_amount_cents integer,p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.bookings%rowtype; f_id uuid; a_id uuid;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_amount_cents<=0 then raise exception 'Credit must be positive'; end if;
  select * into b from public.bookings where id=p_booking_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  select f.id into f_id from public.sponsor_funds f join public.sponsors s on s.id=f.sponsor_id where f.name='RealSign Technical Credits' and s.name='RealSign Technical Resolution' for update;
  update public.sponsor_funds set original_contribution_cents=original_contribution_cents+p_amount_cents,programme_cents=programme_cents+p_amount_cents where id=f_id;
  insert into public.credit_allocations(fund_id,user_id,scope,allocated_cents,created_by)
  values(f_id,b.learner_user_id,'any_service',p_amount_cents,auth.uid()) returning id into a_id;
  insert into public.technical_resolutions(booking_id,learner_user_id,resolution_type,amount_cents,note,issued_credit_allocation_id,created_by)
  values(b.id,b.learner_user_id,'credit',p_amount_cents,p_note,a_id,auth.uid());
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data,reason)
  values(auth.uid(),'technical_credit_issued','booking',b.id,jsonb_build_object('amount_cents',p_amount_cents,'allocation_id',a_id),p_note);
  perform public.queue_notification(b.learner_user_id,b.id,'system','RealSign credit issued','A booking credit has been added to your account.','/bookings/'||b.id,now(),'technical-credit-'||a_id);
  return a_id;
end $$;
grant execute on function public.admin_issue_technical_credit(uuid,integer,text) to authenticated;

create or replace function public.report_review(p_review_id uuid,p_reason text,p_detail text default null)
returns uuid language plpgsql security definer set search_path='' as $$ declare out_id uuid; begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from public.booking_reviews r join public.provider_profiles p on p.id=r.provider_id where r.id=p_review_id and (r.learner_user_id=auth.uid() or p.user_id=auth.uid())) then raise exception 'Review access required'; end if;
  insert into public.review_reports(review_id,reported_by,reason,detail) values(p_review_id,auth.uid(),p_reason,p_detail)
  on conflict(review_id,reported_by) do update set reason=excluded.reason,detail=excluded.detail,created_at=now() returning id into out_id;
  update public.booking_reviews set moderation_state='flagged' where id=p_review_id and moderation_state='published';
  return out_id;
end $$;
grant execute on function public.report_review(uuid,text,text) to authenticated;

create or replace function public.admin_moderate_review(p_review_id uuid,p_action public.moderation_action,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  if p_action='keep' or p_action='restore' then update public.booking_reviews set moderation_state='published' where id=p_review_id;
  elsif p_action in ('hide','remove_private_information') then update public.booking_reviews set moderation_state='hidden',comment=case when p_action='remove_private_information' then '[Private information removed by RealSign]' else comment end where id=p_review_id;
  elsif p_action='warn_reviewer' then null;
  end if;
  update public.review_reports set resolved_at=now(),resolved_by=auth.uid(),resolution=p_action where review_id=p_review_id and resolved_at is null;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data,reason) values(auth.uid(),'review_moderated','booking_review',p_review_id,jsonb_build_object('action',p_action),p_note);
end $$;
grant execute on function public.admin_moderate_review(uuid,public.moderation_action,text) to authenticated;

create or replace function public.sponsor_fund_impact(p_fund_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.sponsor_funds%rowtype; allocated integer; reserved integer; used integer; users_n integer; bookings_n integer; hours numeric;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  select * into f from public.sponsor_funds where id=p_fund_id;
  select coalesce(sum(allocated_cents),0),coalesce(sum(reserved_cents),0),coalesce(sum(used_cents),0),count(distinct user_id) filter(where user_id is not null)
  into allocated,reserved,used,users_n from public.credit_allocations where fund_id=p_fund_id;
  select count(distinct cr.booking_id),coalesce(sum(extract(epoch from (b.end_at-b.start_at))/3600.0),0)
  into bookings_n,hours from public.credit_reservations cr join public.credit_allocations ca on ca.id=cr.allocation_id join public.bookings b on b.id=cr.booking_id where ca.fund_id=p_fund_id and cr.state='used';
  return jsonb_build_object('original_contribution_cents',f.original_contribution_cents,'programme_cents',f.programme_cents,'allocated_cents',allocated,'reserved_cents',reserved,'used_cents',used,'available_cents',greatest(0,f.programme_cents-allocated),'users_supported',users_n,'bookings_funded',bookings_n,'service_hours',round(hours,1));
end $$;
grant execute on function public.sponsor_fund_impact(uuid) to authenticated;

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.current_is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'bookings_total',(select count(*) from public.bookings),
    'bookings_30d',(select count(*) from public.bookings where created_at>=now()-interval '30 days'),
    'completed_30d',(select count(*) from public.bookings where state='completed' and end_at>=now()-interval '30 days'),
    'technical_30d',(select count(*) from public.bookings where state='technical_failure' and end_at>=now()-interval '30 days'),
    'active_providers',(select count(*) from public.provider_profiles where status='approved'),
    'pending_providers',(select count(*) from public.provider_profiles where status='pending'),
    'interpreter_requests_pending',(select count(*) from public.interpreter_requests where state='pending'),
    'gross_booking_cents_30d',(select coalesce(sum(price_cents),0) from public.bookings where created_at>=now()-interval '30 days'),
    'review_average',(select coalesce(round(avg(stars)::numeric,2),0) from public.booking_reviews where moderation_state='published')
  ) into result; return result;
end $$;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- Queue email alongside high-value booking notifications. Existing push remains source-of-truth for real-time alerts.
create or replace function public.queue_booking_email(p_user_id uuid,p_booking_id uuid,p_template text,p_subject text,p_payload jsonb,p_dedupe text)
returns uuid language plpgsql security definer set search_path='' as $$ declare out_id uuid; begin
  insert into public.outbound_emails(user_id,booking_id,template_key,subject,payload,dedupe_key)
  values(p_user_id,p_booking_id,p_template,p_subject,coalesce(p_payload,'{}'::jsonb),p_dedupe)
  on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id into out_id; return out_id;
end $$;
grant execute on function public.queue_booking_email(uuid,uuid,text,text,jsonb,text) to service_role,authenticated;

-- Returns metadata only; the server job deletes private Storage objects then clears these fields.
create or replace function public.verification_files_due_for_deletion()
returns table(source_type text,record_id uuid,bucket_id text,storage_path text) language sql stable security definer set search_path='' as $$
  select 'provider_verification',v.id,'verification-documents',v.storage_path from public.verification_records v where v.storage_path is not null and v.retention_delete_after is not null and v.retention_delete_after<=now()
  union all
  select 'user_deaf',u.user_id,'verification-documents',u.storage_path from public.user_deaf_verifications u where u.storage_path is not null and u.retention_delete_after is not null and u.retention_delete_after<=now();
$$;
grant execute on function public.verification_files_due_for_deletion() to service_role;

alter table public.interpreter_requests enable row level security;
alter table public.review_reports enable row level security;
alter table public.technical_resolutions enable row level security;
alter table public.outbound_emails enable row level security;
create policy "interpreter_requests_participants_admin_read" on public.interpreter_requests for select to authenticated using(learner_user_id=auth.uid() or exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.current_is_admin());
create policy "review_reports_own_admin_read" on public.review_reports for select to authenticated using(reported_by=auth.uid() or public.current_is_admin());
create policy "technical_resolutions_user_admin_read" on public.technical_resolutions for select to authenticated using(learner_user_id=auth.uid() or public.current_is_admin());
create policy "outbound_emails_admin_read" on public.outbound_emails for select to authenticated using(public.current_is_admin());

-- Useful launch defaults; Admin may change these later.
insert into public.platform_settings(key,value) values
('interpreter_request_expiry_hours','6'::jsonb),
('interpreter_payment_hold_hours','24'::jsonb),
('verification_retention_days','30'::jsonb)
on conflict(key) do nothing;

-- Include review ids in public aggregate so an authenticated participant can report a review.
create or replace function public.get_public_provider_reviews(p_provider_id uuid, p_limit integer default 10)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'average',coalesce(round(avg(stars)::numeric,1),0),
   'count',count(*),
   'reviews',coalesce(jsonb_agg(jsonb_build_object('id',id,'stars',stars,'tags',tags,'comment',comment,'created_at',created_at) order by created_at desc) filter(where rn<=greatest(1,least(coalesce(p_limit,10),30))),'[]'::jsonb)
 )
 from (select r.*,row_number() over(order by created_at desc) rn from public.booking_reviews r where provider_id=p_provider_id and moderation_state='published') q;
$$;
grant execute on function public.get_public_provider_reviews(uuid,integer) to anon,authenticated;

create or replace function public.booking_email_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare provider_user uuid; provider_name text;
begin
  select user_id,public_display_name into provider_user,provider_name from public.provider_profiles where id=new.provider_id;
  if tg_op='INSERT' then
    perform public.queue_booking_email(new.learner_user_id,new.id,'booking_confirmed','Your RealSign booking is confirmed',jsonb_build_object('booking_id',new.id,'reference',new.reference,'start_at',new.start_at,'provider_name',provider_name),'booking-confirmed-learner-'||new.id);
    perform public.queue_booking_email(provider_user,new.id,'provider_new_booking','New RealSign booking',jsonb_build_object('booking_id',new.id,'reference',new.reference,'start_at',new.start_at),'booking-confirmed-provider-'||new.id);
  elsif old.state is distinct from new.state or old.start_at is distinct from new.start_at then
    perform public.queue_booking_email(new.learner_user_id,new.id,'booking_changed','Your RealSign booking changed',jsonb_build_object('booking_id',new.id,'reference',new.reference,'state',new.state,'start_at',new.start_at),'booking-change-learner-'||new.id||'-'||extract(epoch from new.updated_at)::bigint);
    perform public.queue_booking_email(provider_user,new.id,'booking_changed','A RealSign booking changed',jsonb_build_object('booking_id',new.id,'reference',new.reference,'state',new.state,'start_at',new.start_at),'booking-change-provider-'||new.id||'-'||extract(epoch from new.updated_at)::bigint);
  end if;
  return new;
end $$;
drop trigger if exists bookings_transactional_email on public.bookings;
create trigger bookings_transactional_email after insert or update of state,start_at on public.bookings for each row execute function public.booking_email_trigger();

create or replace function public.interpreter_request_booking_sync()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.interpreter_requests set state='confirmed',updated_at=now()
  where replacement_reservation_id=new.reservation_id and state='awaiting_payment';
  return new;
end $$;
drop trigger if exists interpreter_request_booking_confirmed on public.bookings;
create trigger interpreter_request_booking_confirmed after insert on public.bookings for each row execute function public.interpreter_request_booking_sync();

create or replace function public.expire_interpreter_requests()
returns integer language plpgsql security definer set search_path='' as $$ declare n1 integer:=0;n2 integer:=0; begin
  if auth.role()<>'service_role' and not public.current_is_admin() then raise exception 'Admin/service access required'; end if;
  update public.interpreter_requests set state='expired' where state='pending' and expires_at<=now(); get diagnostics n1=row_count;
  update public.interpreter_requests ir set state='expired' from public.booking_reservations br where ir.replacement_reservation_id=br.id and ir.state='awaiting_payment' and (br.state in ('expired','released','cancelled') or br.expires_at<=now()); get diagnostics n2=row_count;
  return n1+n2;
end $$;
grant execute on function public.expire_interpreter_requests() to service_role,authenticated;

revoke all on function public.queue_booking_email(uuid,uuid,text,text,jsonb,text) from public,authenticated;
grant execute on function public.queue_booking_email(uuid,uuid,text,text,jsonb,text) to service_role;

-- Apply the default privacy-retention period automatically to approved Deaf/identity evidence.
create or replace function public.apply_provider_verification_retention()
returns trigger language plpgsql security definer set search_path='' as $$ declare days_n integer:=30; begin
  if new.state='approved' and new.type in ('deaf','identity') and new.storage_path is not null and new.retention_delete_after is null then
    select coalesce((value#>>'{}')::integer,30) into days_n from public.platform_settings where key='verification_retention_days';
    new.retention_delete_after:=now()+make_interval(days=>greatest(1,days_n));
  end if; return new;
end $$;
drop trigger if exists provider_verification_retention on public.verification_records;
create trigger provider_verification_retention before update of state on public.verification_records for each row execute function public.apply_provider_verification_retention();

create or replace function public.apply_user_deaf_retention()
returns trigger language plpgsql security definer set search_path='' as $$ declare days_n integer:=30; begin
  if new.state='approved' and new.storage_path is not null and new.retention_delete_after is null then
    select coalesce((value#>>'{}')::integer,30) into days_n from public.platform_settings where key='verification_retention_days';
    new.retention_delete_after:=now()+make_interval(days=>greatest(1,days_n));
  end if; return new;
end $$;
drop trigger if exists user_deaf_verification_retention on public.user_deaf_verifications;
create trigger user_deaf_verification_retention before update of state on public.user_deaf_verifications for each row execute function public.apply_user_deaf_retention();
