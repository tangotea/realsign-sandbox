# RealSign V1 — Milestone 3 Checkpoint

## Completed

Milestone 3 adds the learner marketplace and the server-authoritative booking engine.

### Learner marketplace
- School phase → subject browsing.
- SASL learning doorway into the marketplace.
- Interpreter doorway into the shared marketplace.
- Public search returns approved providers and active services only.
- Provider filtering by provider role and `Languages I use`.
- Public provider profile includes approved roles, languages, subjects, active services, prices and booking rules.
- Approved provider introduction videos can be served through a short-lived signed-media redirect when `SUPABASE_SERVICE_ROLE_KEY` is configured server-side.

### Availability and booking rules
- Provider timezone added (default `Africa/Johannesburg`).
- Slots are generated in PostgreSQL from recurring availability + extra availability - blocked periods.
- Provider booking notice is enforced by the slot function.
- Provider session buffer is enforced by the slot function and reservation record.
- Checkout holds expire after the Admin-configured `checkout_hold_min` value (default 5 minutes).
- Expired holds are released before a new hold is attempted.

### Double-booking protection
- A single `booking_reservations` table owns both temporary holds and booked provider time.
- PostgreSQL `btree_gist` exclusion constraint prevents overlapping active reservations for the same provider.
- Race conditions are therefore rejected by the database rather than trusting browser state.

### Identity protection
- New learner identity verification state record.
- `create_booking_hold` requires learner identity state `approved`.
- Learners cannot self-set `approved`.
- Admin test/review action can approve/reject/request more information until the production KYC webhook is connected.

### Booking/payment boundary
- The learner can select a genuine slot and create a five-minute checkout hold.
- `finalize_booking_from_hold` creates the real booking only from a valid hold.
- Finalisation is revoked from public/authenticated users and restricted to the Supabase `service_role`, ready for a trusted payment webhook in Milestone 4.
- No fake payment-success button was added.

## Security decisions
- Public discovery functions are `security definer` but deliberately return only approved public marketplace information.
- Full verification documents remain outside the public marketplace.
- Provider-media signing requires a server-only service-role key and only works for approved provider profiles.
- Booking reservations/bookings are readable only by the learner, the booked provider or Admin.

## Validation performed
- All current TS/TSX source files were syntax-transpiled with TypeScript 5.8.3: zero syntax-error files.
- Targeted assertions confirmed the exclusion constraint, identity gate, notice/buffer logic, service-role booking finalisation and approved-provider filtering are present.
- A live Supabase migration execution could not be performed in this container because no PostgreSQL/Supabase instance is attached.
- As with earlier checkpoints, a full Next.js dependency build cannot be guaranteed until dependencies are installed in an environment with npm registry access.

## Milestone 4 boundary
Milestone 4 should connect real sandbox payments and provider earnings/payout setup. A successful payment webhook will call the trusted booking finalisation function; a failed/abandoned payment leaves or releases the checkout hold.
