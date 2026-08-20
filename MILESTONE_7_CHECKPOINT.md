# RealSign V1 — Milestone 7 Checkpoint

## Status

Milestone 7 launch-hardening scaffold is complete and packaged. It extends Milestone 6 without replacing the booking, finance, video, sponsorship or notification architecture.

## Added in this milestone

### Interpreter Request-to-Book
- `interpreter_requests` with pending / accepted / declined / expired / awaiting-payment / confirmed lifecycle.
- Remote and in-person modes.
- Location required for in-person requests.
- Identity verification required before a learner can request.
- Provider acceptance creates a database-protected checkout reservation using the same provider overlap exclusion constraint as ordinary bookings.
- Provider decline creates no booking and no charge.
- Request expiry and accepted-payment hold expiry.
- Provider request inbox at `/provider/requests`.
- Learner request state appears in `/bookings`.
- Public interpreter profiles can expose both Remote Times and Request In Person where the service supports both.

### Technical dispute resolution
- `technical_resolutions` record.
- Admin `Issue technical credit` action on booking investigation.
- RealSign system technical-credit fund reuses the existing non-transferable credit engine.
- Technical credits therefore behave as booking subsidies, not cash wallets.

### Review moderation
- `review_reports`.
- Provider/participant report RPC.
- Admin Reviews & Reports screen.
- Keep / hide / remove-private-information controls.
- Audit log entry for moderation actions.

### Sponsorship impact
- `sponsor_fund_impact()` aggregate report.
- Users supported, bookings funded, service hours, used/available fund values.
- Existing Sponsor Admin screen now surfaces aggregate impact.

### Admin statistics
- `/admin/statistics`.
- 30-day booking/completion/technical counts.
- Active/pending providers.
- Gross booking value.
- Review average.
- Most-booked service summary.

### Transactional email queue
- `outbound_emails` queue.
- Confirmation/change email trigger for bookings.
- Interpreter-request and accepted-request emails.
- Protected scheduled dispatch route.
- Account email resolved with privileged server auth lookup; no cross-user email exposure.
- Provider-neutral webhook adapter configured via environment variables.

### Privacy retention
- Approved provider Deaf/identity evidence gets a configurable deletion date.
- Approved user-level Deaf evidence gets the same default deletion-date handling.
- Protected retention route deletes due private Storage objects and then clears the path.
- Verification result and audit history remain.

### Test/readiness tooling
- `scripts/check-milestone7.mjs`.
- `scripts/live-smoke.mjs` (read-only connectivity test).
- `E2E_TEST_PLAN.md` covering identity, RLS, booking races, Request-to-Book, payment idempotency, video/reconnect, reviews, notifications, sponsorship and retention.
- `prototype/milestone7.html`.

## Security decisions preserved

- Provider self-approval remains impossible.
- Learner identity is required before a booking or interpreter request can reserve time.
- Interpreter acceptance cannot bypass the database provider-time overlap constraint.
- Technical credit is non-transferable and non-withdrawable.
- Provider cannot delete a negative review.
- Transactional email queue helper is not executable by ordinary authenticated clients.
- Privileged account-email lookup and private-file deletion run server-side only.
- Sponsor impact reporting remains aggregate.
- Sensitive evidence is removed by exact private object path, not by public URLs.

## Validation performed

- Milestone 5 assertions: PASS.
- Milestone 6 assertions: PASS.
- Milestone 7 assertions: PASS.
- TypeScript/TSX syntax transpilation: 118/118 PASS.
- SQL function delimiter/security string checks: PASS.
- Milestone 7 prototype local HTTP smoke: PASS.

## Not yet validated here

A full dependency-resolved Next.js production build was not possible because `npm install` timed out against the npm registry in this environment.

The following require actual credentials/project infrastructure:

- applying migrations 0001–0007 to Supabase/Postgres;
- live RLS tests against real users/roles;
- real concurrent database race test;
- Paystack sandbox checkout/webhook/refund/payout tests;
- Daily test-room/token/reconnect tests;
- actual transactional-email transport;
- scheduled notification/email/retention jobs;
- RealSASL live search endpoint/database adapter.

## Recommended next step

Move from feature development to **sandbox deployment and acceptance testing**:

1. create/connect the actual Supabase project;
2. apply migrations 0001–0007;
3. configure Paystack sandbox and Daily test credentials;
4. configure transactional email webhook and cron secret;
5. seed one Admin, learner, Deaf Tutor, qualified teacher and interpreter;
6. run `E2E_TEST_PLAN.md` end-to-end;
7. only after those tests, start branding/polish and pilot-user testing.
