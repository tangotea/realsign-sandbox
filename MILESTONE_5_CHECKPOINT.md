# RealSign V1 — Milestone 5 Checkpoint

## Status
Milestone 5 adds the **Meet + Messaging + Reviews** layer to the Milestone 4 marketplace/payment scaffold.

## Included
- Daily custom-call dependency and server-side Daily REST adapter.
- Private Daily room creation per booking.
- Meeting tokens scoped to the room, user, join window and two-minute wrap-up window.
- No RealSign recording workflow; cloud recording is not started and recording UI is disabled in meeting tokens.
- 15-minute default pre-session join window, Admin-configurable through `platform_settings`.
- Waiting-room browser camera preview with face/hands/upper-body guidance.
- Large sign-first video layout with camera and microphone toggles.
- Daily automatic network reconnection support plus manual rejoin path after an ejection/leave.
- Network interruption/quality event logging.
- Booking-linked temporary text chat below the video.
- Quick messages: repeat, sign more slowly, do not understand, type the word.
- Text-only RealSASL search adapter and in-call dictionary overlay; it never needs to navigate away from the call.
- Configurable 5-minute / 2-minute / final wrap-up timer behaviour.
- Technical-problem timestamp reporting without a refund button.
- Session participation metadata for Admin dispute investigation.
- Normal completion requires both learner and provider to have joined.
- Learner reviews only from completed bookings.
- Provider private post-session reports, including no-show and technical issues.
- Public provider review aggregate/output.
- Admin booking inspection page showing participant and technical timelines.
- Provider dashboard now shows upcoming bookings with direct Manage Booking access.

## New database migration
`supabase/migrations/0005_meet_messaging_reviews.sql`

Important new tables:
- `video_sessions`
- `video_session_participants`
- `booking_messages`
- `technical_events`
- `booking_reviews`
- `provider_session_reports`

## New environment variables
```env
DAILY_API_KEY=
REALSASL_SEARCH_ENDPOINT=
REALSASL_SEARCH_API_KEY=
```

`REALSASL_SEARCH_ENDPOINT` is deliberately an adapter boundary. The app is ready to call a RealSASL-owned text-search endpoint, but no RealSASL API/database credentials were supplied in this build environment, so the production dictionary data connection is not yet live.

## Validation performed
- All 76 TypeScript/TSX files passed TypeScript `transpileModule` syntax parsing.
- `scripts/check-milestone5.mjs` passed all targeted Milestone 5 assertions.
- Security checks in the migration enforce participant-only chat/video metadata access and completed-booking-only learner reviews.
- Normal booking completion requires both participant roles to have joined, preventing a lone learner/provider from completing a no-show session and accidentally releasing normal earnings.
- `npm install` was attempted again but timed out against the npm registry in this environment, so a full Next.js dependency build remains unexecuted here.
- Live Daily, Supabase and RealSASL API execution requires actual credentials and applied database migrations.

## Visual prototype
Open `prototype/milestone5.html` for a no-install snapshot of the sign-first call screen.

## Next milestone
Milestone 6 should focus on **notifications + sponsorship/access credits + cancellation/reschedule/no-show operations + Help Video Manager**, followed by launch hardening and live sandbox integration tests.
