# RealSign V1 — Milestone 6 Checkpoint

## Completed in this checkpoint

### Visual push notifications
- Web Push subscription storage per device.
- Service worker handles visible notifications and notification-click navigation.
- User reminder preferences for 24 hours, 1 hour and 10 minutes before a booking.
- Notification queue supports booking confirmation, new provider bookings, booking changes/cancellations, reschedule decisions and reminder events.
- Scheduled dispatch route protected by `CRON_SECRET`.
- Device vibration/haptics are requested through the notification payload where supported; RealSign does not override the user's phone settings.

### Cancellation, rescheduling and no-shows
- Default free cancellation/direct-reschedule window: 24 hours, Admin configurable.
- Learner cancellation inside the restricted window is refused by the standard cancellation action; support/technical exception handling remains available separately.
- Provider cancellation can be recorded at any time and flags the learner cash portion for refund resolution.
- Eligible cancellations immediately return used sponsored credit to the originating allocation/fund.
- Direct learner rescheduling outside the restricted window is atomic and preserves double-booking protection.
- Short-notice rescheduling creates a protected proposed slot; the original booking remains confirmed until the provider accepts.
- Provider can accept/decline the request.
- Learner/provider can record the opposite party as a no-show only after the scheduled appointment has ended.
- Provider earnings are held/reversed as appropriate rather than silently released during cancellations/no-show review.

### Deaf Access / sponsorship credits
- Sponsor records and sponsor funds.
- Configurable RealSign sponsorship administration fee (development default 7.5%).
- Programme funds remain separate from the administration fee.
- Credit scopes: interpreter only, tutor/teacher only, or any eligible RealSign service.
- Admin can allocate to one user, a selected group, or the General Deaf Access Pool.
- General-pool eligibility requires an approved user-level Deaf verification.
- Optional fund caps per booking and per user/month.
- Individual allocation end dates return unused capacity to the originating fund rather than converting it into RealSign income.
- Credits are non-transferable booking subsidies, not cash wallets.
- Checkout can reserve eligible sponsored credit before payment starts.
- Partially sponsored booking: Paystack receives only the learner cash portion.
- Fully sponsored booking: no payment-gateway transaction is required.
- Provider earnings are based on the full service value, while the sponsored portion can use a separate configurable booking-fee rate (default 0 because sponsorship administration is charged at fund creation).
- Abandoned/expired checkout holds release reserved sponsor credit.

### User Deaf Access verification
- Added a private learner/user Deaf-verification record distinct from provider verification.
- Admin can approve/reopen user Deaf Access eligibility.
- This is not automatically exposed as a public profile badge.

### Admin SASL Help Video Manager
- Admin can upload and replace public/non-sensitive SASL help videos.
- Help content includes title, text explanation, audience, screen and placement key.
- Contextual boxed `[ ? ]` control opens the help explanation without leaving the current screen.
- `/help` collects all active help content into one place.
- Help video changes do not require a new app release.

### Admin rules
- Super Admin UI now controls cancellation hours, short-notice request hold duration, checkout hold, early video-room access, wrap-up period and post-session chat duration.
- Rule changes are written to the audit log.

### Finance safety fixes
- Booking cancellation state is preserved when a Paystack refund later becomes processed; payment state can become refunded without overwriting `cancelled_by_learner` / `cancelled_by_provider`.
- Eligible cancellation sponsor credit and customer cash are handled independently.

## New migration

`supabase/migrations/0006_notifications_access_changes_help.sql`

Apply migrations in numeric order (`0001` through `0006`).

## New deployment environment variables

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@realsign.example
CRON_SECRET=
```

`web-push` is now a project dependency.

## Scheduled notification job

The project exposes:

`POST /api/jobs/notifications/dispatch`

with:

`Authorization: Bearer <CRON_SECRET>`

Run it on a recurring schedule (for example every five minutes). It:
1. enqueues booking reminders that are due;
2. reclaims expired credit allocations where safe;
3. sends queued Web Push notifications;
4. disables expired browser subscriptions when the push service reports them gone.

Hosted Supabase supports Cron/pg_cron and scheduled Edge Function/HTTP patterns, or the deployed web host may invoke the route using its own scheduler.

## Intentionally not live yet

- Email delivery provider is not chosen. The notification model already contains email preferences, but V1 email sending still needs a transactional email provider before production.
- No real sponsor money should be accepted until the RealSign legal/accounting treatment of sponsorship funds/credits is reviewed.
- Identity and Deaf verification are still development/Admin workflows pending the final South African KYC/verification provider and policy.
- The SQL migration has not been executed against the user's live Supabase instance in this environment.
- Push delivery has not been exercised against a deployed HTTPS origin/VAPID key pair in this environment.

## Validation performed here

- `scripts/check-milestone6.mjs`: all targeted Milestone 6 assertions pass.
- TypeScript/TSX syntax transpilation: 101 source files parsed without syntax errors.
- Static Milestone 6 prototype local HTTP smoke test: passed.
- `npm install` was attempted but timed out while accessing the npm registry, so a full dependency-resolved Next.js production build could not be run here.

## Next build milestone

Milestone 7 should focus on launch hardening and remaining operational workflows: interpreter Request-to-Book/in-person assignments, review/report moderation, sponsor reporting/export, technical credit resolution, transactional email, platform statistics, audit-log UI, privacy/retention automation, and end-to-end sandbox testing against a real Supabase/Paystack/Daily deployment.
