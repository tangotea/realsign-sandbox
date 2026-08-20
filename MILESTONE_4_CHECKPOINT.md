# RealSign V1 — Milestone 4 Checkpoint

## Implemented

- Paystack redirect checkout initialised only from the trusted server.
- Five-minute booking hold remains the window to **start** checkout; payment initialisation extends the same protected hold using `payment_pending_hold_min` (default placeholder: 20 minutes).
- Paystack webhook verifies the `x-paystack-signature` HMAC-SHA512 signature.
- Successful payments are re-verified with Paystack before RealSign finalises a booking.
- Amount and ZAR currency checks occur before value is delivered.
- Idempotent payment finalisation creates:
  - confirmed booking
  - payment transaction
  - provider pending earning
  - immutable finance-event ledger entries
- RealSign platform fee is snapshotted per transaction. Placeholder default is 15% (`1500` basis points) and **must be set deliberately before launch**.
- Gateway fee is recorded separately from the RealSign platform fee.
- Provider earnings states: Pending → Available → Payout Scheduled → Paid, with Held/Reversed safeguards.
- Earnings only become Available after the booking is `completed`, its clearance period has passed, and no dispute/refund hold applies.
- Provider payout setup:
  - South African verification-capable bank list from Paystack
  - Paystack `/bank/validate`
  - Paystack `basa` transfer-recipient creation
  - only masked account last four digits + recipient code retained in the RealSign payout table
  - identity/document number used for bank verification is not stored in the payout table
  - changing bank details triggers a configurable security hold (default placeholder: 24 hours)
- Weekly payout batching using Paystack bulk transfers (V1 UI caps a batch at 100 providers).
- Transfer webhooks update payout items and provider earning states.
- Admin Payments view separates customer payment, RealSign fee, gateway cost and provider earning.
- Admin Payouts view shows available earnings and payout batches.
- Full/partial Paystack refunds for payments that have not yet been paid out to the provider.
- Refund webhooks update transaction/refund status and adjust provider payable earnings proportionally.
- Finance actions require Super or Finance Admin permissions.

## New migration

Apply after Milestones 1–3:

`supabase/migrations/0004_payments_provider_earnings.sql`

## New environment variables

```env
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Keep the Paystack secret key server-only.

## Paystack dashboard setup

Use the RealSign webhook endpoint:

`https://YOUR-DOMAIN/api/payments/paystack/webhook`

Paystack transfer/bulk payout use may require transfer approval configuration suitable for API-driven payouts. Confirm the account's South African transfer capability before live launch.

## Important V1 finance assumptions

- Advertised provider service price is treated as the customer's all-inclusive booking price.
- Provider earning = booking price minus RealSign platform fee.
- Paystack/gateway cost is recorded against RealSign separately; it does not silently reduce the provider's agreed earning.
- The 15% standard platform fee in the seed is **illustrative only**, not a final business decision.
- Weekly payout cadence is the V1 operating default; the schema supports future cadence changes.
- Automatic refunds are blocked once the provider earning has entered payout scheduling or has been paid. Those cases require manual finance review in a later dispute/recovery workflow.

## Validation status

- TypeScript/TSX parser-level syntax check: passed (no parser diagnostics).
- Targeted Milestone 4 finance/security assertions: passed.
- `npm install` / full Next.js production build: not completed because npm registry installation timed out in this environment.
- Live Supabase migration execution and Paystack sandbox calls require project/API credentials and were not run here.

## Validation still required against live services

- Apply migrations to a real Supabase/Postgres project.
- Run Paystack test-mode checkout end-to-end.
- Configure a public webhook URL; localhost cannot receive Paystack webhooks directly.
- Test duplicate webhook delivery and callback/webhook race idempotency.
- Test a payment that finishes after its protected payment window; it must go to `manual_review`, not steal a new booking.
- Test South African account validation with supported test/live data.
- Confirm bulk transfer approval configuration for the merchant account.
- Test refund pending/processed/failed events.

## Next milestone

**Milestone 5 — Meet + Messaging**

- Daily private video rooms
- waiting room and camera framing check
- automatic reconnect + Rejoin Session
- booking-linked temporary chat below video
- Quick Messages
- RealSASL text search inside the session
- 5-minute / 2-minute / final countdown
- 2-minute wrap-up grace
- technical event logging
- post-session completion and reviews
