# RealSign V1 — Sandbox End-to-End Test Plan

Run after migrations 0001–0007 are applied and Supabase, Paystack and Daily sandbox/test credentials are configured.

## Identity and permissions
- Learner can browse without sign-in.
- Unverified learner cannot create a booking hold or interpreter request.
- Provider cannot self-approve verification/application state.
- Non-admin cannot read Admin finance, verification, sponsor or moderation data.
- Support Admin cannot perform finance-only operations.

## Marketplace and booking
- Search by grade, subject and `Languages I use` returns approved providers only.
- Provider notice period removes near-term slots.
- 15-minute minimum buffer is applied.
- Two concurrent requests for the same slot result in exactly one protected hold.
- Abandoned checkout hold expires and becomes bookable again.

## Interpreter Request-to-Book
- In-person request requires a location.
- Request reaches only the selected interpreter.
- Decline leaves no booking/charge.
- Accept creates one protected checkout reservation.
- Conflicting provider time causes acceptance to fail safely.
- Unpaid accepted request expires when its checkout hold expires.
- Successful payment converts the request to confirmed.

## Payments and credits
- Paystack sandbox success creates one booking and one financial-ledger outcome.
- Duplicate Paystack webhook does not double-credit/debit.
- Sponsored credit is reserved, used only on completion/booking finalisation and released when appropriate.
- Fully sponsored checkout does not create a zero-value gateway transaction.
- Admin technical credit appears as a non-transferable booking subsidy and can be applied at checkout.
- Refund does not duplicate provider earning reversals.

## Video and messaging
- Only learner and provider can obtain Daily room access.
- Both can rejoin after a network drop.
- Chat is booking-linked and closes under the configured rule.
- RealSASL dictionary overlay does not navigate away from the call.
- Session cannot normally complete without both participants having joined.

## Reviews, reports and safety
- Only completed verified bookings can create a review.
- Provider can report a review but cannot delete it.
- Admin can keep, hide or redact private information from a reported review.
- Provider private learner report is not public.

## Notifications and email
- Push queue generates 24h / 1h / 10m reminders once each.
- Critical booking changes queue immediate notifications.
- Transactional email worker resolves auth email server-side and sends through configured transport.
- No email address is exposed to the other booking participant.

## Sponsorship reporting
- Specific-user, group and general-pool allocations remain bounded by fund programme balance.
- Individual unused allocations return/reclaim according to fund rules.
- Sponsor impact totals agree with used credit-reservation records.
- Sponsor reports contain aggregate impact only, not confidential appointment detail.

## Privacy retention
- Approved Deaf evidence receives a retention-delete date.
- Retention job removes due objects from the private verification bucket and clears the storage path.
- Public profile continues to show only the verification badge after evidence deletion.

## Launch checks
- Install PWA on Android and iOS Safari-supported flow where applicable.
- Test keyboard, screen scaling, low bandwidth and loss/recovery of network.
- Confirm no critical action relies on sound only.
- Confirm `[ ? ]` help opens SASL content without losing current screen context.
