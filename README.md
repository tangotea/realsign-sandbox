# RealSign V1 — Milestone 6

RealSign is a Deaf-first marketplace PWA connecting learners with Deaf Tutors, Qualified Deaf Teachers and SASL Interpreters. This checkpoint includes the foundation, provider marketplace, learner booking engine, Paystack-ready payments/payouts, private Daily video sessions, temporary booking chat, notifications, sponsorship/access credits, cancellation/rescheduling/no-shows and Admin-managed SASL help.

## Stack

- Next.js + TypeScript PWA
- Supabase/PostgreSQL/Auth/Storage/RLS
- Paystack sandbox/live adapter for customer payments, refunds and South African provider payouts
- Daily custom video-call client
- Web Push (`web-push`) for visual device reminders
- RealSASL text-search adapter

## Apply database migrations

Run in order:

1. `supabase/migrations/0001_foundation.sql`
2. `supabase/migrations/0002_provider_marketplace.sql`
3. `supabase/migrations/0003_learner_marketplace_booking.sql`
4. `supabase/migrations/0004_payments_provider_earnings.sql`
5. `supabase/migrations/0005_meet_messaging_reviews.sql`
6. `supabase/migrations/0006_notifications_access_changes_help.sql`

## Environment

Copy `.env.example` to `.env.local` and provide the relevant values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000

DAILY_API_KEY=

REALSASL_SEARCH_ENDPOINT=
REALSASL_SEARCH_API_KEY=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@realsign.example
CRON_SECRET=
```

Server-only secrets must never use the `NEXT_PUBLIC_` prefix.

## Install and run

```bash
npm install
npm run dev
```

The current working environment timed out while reaching the npm registry, so the full dependency-resolved Next.js build has not been run here. TypeScript/TSX syntax transpilation and targeted Milestone checks were run instead.

## First Admin

Do not expose Admin signup publicly. Create the first Admin using trusted SQL/service-role access after the user has registered normally:

```sql
insert into public.admin_profiles(user_id, role)
values ('YOUR-AUTH-USER-UUID', 'super');

insert into public.user_roles(user_id, role)
values ('YOUR-AUTH-USER-UUID', 'admin')
on conflict do nothing;
```

## Milestone 6: notifications

The service worker handles Web Push and notification-click navigation. Users can enable push per device and choose the 24-hour, 1-hour and 10-minute reminders.

Schedule:

```text
POST /api/jobs/notifications/dispatch
Authorization: Bearer <CRON_SECRET>
```

on a recurring schedule such as every five minutes. Supabase Cron/pg_cron + an HTTP/Edge Function pattern or the deployed web host's scheduler can invoke it.

Push notifications are visual. The notification payload requests vibration where supported, but the user's phone/browser settings remain authoritative.

Transactional email sending is intentionally not connected yet; choose an email provider before production.

## Milestone 6: cancellation and rescheduling

Default development values (Admin configurable):

- Free cancellation/direct reschedule: 24 hours before start
- Short-notice change: provider approval required
- Proposed short-notice slot is temporarily protected while awaiting response
- Original booking stays confirmed until the provider accepts
- Provider cancellation makes the learner's eligible cash amount available for refund resolution
- Sponsored credits used by an eligible cancellation return to their originating allocation/fund
- No-show can be reported only after the appointment ends

Rules are edited at `/admin/rules` and changes are audit logged.

## Milestone 6: sponsorship / Deaf Access credits

Admin can create sponsor funds and allocate non-transferable RealSign booking subsidies to:

- one specific user;
- a selected group;
- the General Deaf Access Pool.

Scopes:

- interpreter only;
- tutor/teacher only;
- any eligible RealSign service.

General-pool use requires user-level Deaf verification. Specific allocations are deliberate Admin allocations.

Checkout reserves eligible credit before payment begins. Partial sponsorship reduces the cash amount sent to Paystack. A fully sponsored booking is finalised without a payment-gateway charge.

The seeded sponsorship administration fee is **7.5% only as a development default** and is configurable. It is not a final commercial recommendation.

Sponsored credits are not cash wallets: users cannot withdraw, transfer or sell them.

## Milestone 6: SASL Help Video Manager

`/admin/help` lets Admin upload/replace a short SASL help video and matching text. Contextual boxed `[ ? ]` controls can open this content without navigating away. `/help` shows the active help library.

Help videos are treated as public/non-sensitive content and use a dedicated public `help-videos` storage bucket. Verification/audiology/identity documents remain private.

## Core security rules

- Admin is enforced server/database-side, not by hidden navigation.
- Providers cannot self-approve.
- Public verification badges derive from actual approved verification records.
- Learner identity verification is required before reserving a booking.
- Database exclusion constraints prevent provider-time double bookings.
- Payment success is finalised only from trusted server/service-role flows.
- Full bank-account details are not stored/displayed in normal RealSign records where the payment provider can hold them.
- Daily call rooms are private and time-limited; RealSign does not record lesson/interpreting video by default.
- Booking chat is booking-scoped and temporary.
- Sponsor credits are reserved/used/released through ledger-like records rather than a mutable cash balance.
- Sensitive Admin actions are audit logged.

## Current validation

```bash
node scripts/check-milestone6.mjs
```

passes the targeted Milestone 6 assertions.

A TypeScript/TSX parser pass also succeeds across 101 source files.

See `MILESTONE_6_CHECKPOINT.md` for exact scope and remaining deployment limitations.

## Milestone 7: launch hardening

Milestone 7 adds the remaining operational layers around the core V1 marketplace:

### Interpreter Request-to-Book

- Approved interpreter services may be remote, in-person, or both.
- Simple remote availability can still use Instant Booking.
- In-person/specialist assignments can use Request-to-Book.
- The learner must already be identity verified to submit a request.
- The interpreter sees the requested date/time, mode, location and limited context.
- Accepting a request creates a real protected booking reservation; it does **not** bypass the double-booking constraint.
- The learner is notified to confirm/pay only after acceptance.
- Declined/expired requests do not create a confirmed booking.
- Request and payment-hold expiry periods are Admin-configurable platform settings.

### Technical resolutions

Admin can issue a non-transferable RealSign technical credit against a disputed/failed booking. It reuses the existing credit allocation/reservation engine instead of introducing a separate cash wallet. Credits can therefore be reserved at checkout, released when appropriate and audited.

### Review/report moderation

- Providers can report a review but cannot delete it.
- Admin can keep, hide or redact private information from a reported review.
- Moderation actions are audit logged.
- Public provider review output includes only published reviews.

### Sponsor impact and statistics

Admin now has:

- sponsor impact totals (used funds, users supported, bookings funded, service hours);
- a launch-focused Statistics page with bookings, completions, technical failures, active providers, gross booking value and review average;
- aggregate reporting only—sponsor impact screens do not expose confidential appointment content.

### Transactional email hooks

`outbound_emails` is a provider-neutral queue. Booking confirmation/change and interpreter-request events enqueue templates. The scheduled dispatcher resolves the account email server-side and posts to the configured transactional-email webhook.

Required environment variables:

```env
TRANSACTIONAL_EMAIL_WEBHOOK_URL=
TRANSACTIONAL_EMAIL_WEBHOOK_SECRET=
CRON_SECRET=
```

The email transport is deliberately replaceable; RealSign does not expose one participant's email address to the other participant.

### Privacy / verification retention

Approved Deaf/identity evidence receives a configurable retention-delete date (development default: 30 days). A protected retention worker:

1. asks the database which private verification objects are due;
2. deletes those exact objects from the private `verification-documents` bucket;
3. clears the stored object path while retaining the verification result/audit history.

Teacher qualification/interpreter assessment evidence is not automatically placed on the same short retention schedule by this migration; Admin/legal policy can set an appropriate retention period separately.

### Sandbox test harness

```bash
npm run check:m7
npm run smoke:live
```

`smoke:live` is read-only and checks credential/connectivity readiness for Supabase, Paystack and Daily without creating bookings, charges, rooms or payouts.

See `E2E_TEST_PLAN.md` for the full sandbox scenario list before launch.

## Milestone 7 validation

- Milestone 5 regression assertions: pass.
- Milestone 6 regression assertions: pass.
- Milestone 7 targeted assertions: pass.
- TypeScript/TSX syntax transpilation: **118 / 118 pass**.
- Milestone 7 prototype local HTTP smoke: pass.
- SQL migration structural checks: pass (balanced function delimiters and expected security assertions).
- Full `npm install` / dependency-resolved Next.js production build: **not completed in this environment because npm registry installation timed out**.
- The SQL migrations still need to be applied and exercised against the actual Supabase project before launch.
