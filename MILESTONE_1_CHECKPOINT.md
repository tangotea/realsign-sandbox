# RealSign V1 — Milestone 1 Checkpoint

## Frozen foundation decisions implemented

- One RealSign PWA for learners and providers.
- Separate protected Admin route on the same shared backend.
- Users may browse before signing in.
- One account may hold multiple roles over time.
- New accounts receive the learner role by default; users cannot self-assign Admin.
- `Languages I use` supports multiple selections and models SASL distinctly from spoken/written languages.
- All 12 South African official languages are seeded.
- Provider profile shell is separate from the private user account.
- Verification and provider media storage buckets are private.
- Row Level Security is the primary data-access boundary.
- Admin actions have a dedicated audit-log mechanism.
- PWA manifest and service worker are included.
- Boxed `[ ? ]` is the help-control pattern.

## Milestone 2 starts with

1. Provider applications and provider-role records.
2. Deaf / teacher / interpreter verification records and review states.
3. South African school phases and subject catalogue.
4. Provider subjects, services, durations and RealSign-approved rate ranges.
5. Availability, exceptions, minimum 60-minute booking notice, provider-selected longer notice.
6. 15-minute minimum session buffer, provider-selectable longer buffer.
7. Introduction video and AI-assisted introduction text workflow.
8. Admin provider-approval workspace.
