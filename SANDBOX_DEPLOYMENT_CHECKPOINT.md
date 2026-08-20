# RealSign V1 — Live Sandbox Deployment Checkpoint

Date: 20 August 2026

## Supabase

Connected project: **Realsign Tutor Learner APP**
Project ref: `ydrocahagaygvybavihp`
Region: `eu-central-1`
Status at deployment: `ACTIVE_HEALTHY`

All frozen V1 schema layers through Milestone 7 were applied successfully, plus live hardening migrations discovered during real PostgreSQL testing.

### Live database checks passed

- Foundation schema and storage buckets created.
- 12 South African official languages seeded, including SASL as a signed-language modality.
- 61 school-subject records seeded.
- Provider onboarding, verification, Admin approval and payout-readiness chain tested.
- Public provider discovery tested with subject, grade, role and language filtering.
- Availability generation tested using provider timezone `Africa/Johannesburg`.
- 15-minute provider buffer reflected in generated slots.
- Learner identity gate tested.
- Five-minute booking hold tested.
- Database-level provider overlap protection tested: a second learner could not reserve the already-held same slot.
- Payment initialisation path tested against the live database.
- Trusted payment-success finalisation tested with a synthetic Paystack event.
- Booking creation, provider earnings and financial ledger entries verified.
- Provider payout account readiness enforced before marketplace visibility.

### Security improvements made during live testing

1. Fixed an ambiguous RLS policy expression discovered by PostgreSQL.
2. Revoked unintended anonymous execution of non-public `SECURITY DEFINER` RPCs.
3. Fixed `touch_updated_at()` search-path warning.
4. Moved `btree_gist` out of the public schema.
5. Added database-level provider service price-range enforcement.
6. Prevented providers from self-asserting `qualification_verified` on subjects.
7. Added useful foreign-key indexes for likely operational queries.

### Current synthetic sandbox fixture

The database contains deliberately named sandbox-only records for one Admin, one Deaf Tutor and two learners, plus one confirmed synthetic booking. These exist only to exercise RLS and booking/finance rules; there are still **zero real Supabase Auth users**.

## Finance test result

Synthetic booking price: **R220.00**

Using the current development placeholder platform rate of **15%**:

- RealSign platform fee: R33.00
- Provider earning: R187.00
- Simulated gateway fee: R4.50

These values were written to the live financial ledger successfully. The 15% platform fee remains a development placeholder, not a final commercial decision.

## Supabase advisor status

Security blockers found during deployment were addressed. Remaining advisor findings are primarily performance-oriented (for example RLS init-plan optimisation and multiple permissive-policy consolidation) and are appropriate to optimise before a pilot/scale phase. “Unused index” notices are expected on a new database with almost no traffic.

## Vercel

The Vercel account is connected and contains no existing projects. The connected deployment action currently exposes a connector schema mismatch: the backend requires `target`, `name` and `files`, while the surfaced action accepts no arguments. Therefore no deployment was falsely claimed.

The project is prepared for deployment and `.env.sandbox.example` contains the live public Supabase URL and publishable key. Server-only secrets remain intentionally blank.

## External sandbox credentials still required

- Supabase service-role key (server only)
- Paystack **test** secret key
- Daily API key
- RealSASL search endpoint/API key if required
- VAPID public/private keys
- Cron secret
- Transactional-email webhook details if that feature is enabled

Do not send private API keys in ordinary chat text if there is a safer deployment-environment method available.

## Build limitation

A dependency-resolved local Next.js build still could not be run because `npm install` timed out reaching the npm registry from the execution container. Earlier TypeScript syntax/transpilation checks remain valid, but this is not equivalent to a full production build.
