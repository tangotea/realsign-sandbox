# RealSign V1 — Milestone 2 Checkpoint

## Marketplace decisions now implemented

1. One user can apply as Deaf Tutor, Qualified Deaf Teacher, Interpreter, or multiple appropriate roles.
2. Provider approval is controlled by RealSign Admin; applicants cannot self-approve by direct database requests.
3. Deaf verification, teacher qualification and interpreter evidence/assessment are independent verification records.
4. Sensitive verification files use private storage and never become public profile data.
5. Provider onboarding includes `Languages I use` with SASL as a distinct modality.
6. South African school subjects are stored centrally and linked to providers rather than typed as uncontrolled profile text.
7. Services are separate from subjects and include duration, provider role and price.
8. Provider prices are validated against Admin-configurable rate ranges.
9. Standard V1 tutoring durations are 30, 45 and 60 minutes.
10. RealSign enforces at least 60 minutes' booking notice; providers may require more.
11. RealSign enforces at least 15 minutes between sessions; providers may choose more.
12. Providers publish weekly availability; unavailable time does not require them to wait for a booking.
13. Provider intro videos and written introductions are part of the application.
14. AI profile-writing assistance remains provider-controlled and is represented by an integration hook, not automatic rewriting.
15. Admin can review providers, verification states, subjects, services, rates and booking settings in one workspace.
16. Provider and verification approval decisions are written to the Admin audit log.

## Deliberately deferred

- live KYC/identity vendor
- actual interpreter random-passage assessment generator/recording workflow
- payout bank-account collection and Paystack recipient creation
- public learner search/results pages backed by provider data
- real slot generation and double-booking locks
- payments
- Daily video rooms/chat
- push subscriptions
- RealSASL live search adapter
- sponsorship ledger

## Milestone 3 begins with

The learner marketplace and booking engine: search approved providers by service/grade/subject/language, calculate valid slots from availability + notice + buffer, then create atomic temporary booking holds so double bookings are impossible.
