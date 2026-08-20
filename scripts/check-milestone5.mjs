import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const checks=[
 ["Daily dependency",JSON.parse(read("package.json")).dependencies["@daily-co/daily-js"]],
 ["Private room",read("app/api/bookings/[bookingId]/meeting/route.ts").includes('privacy:"private"')],
 ["Token expiry/ejection",read("app/api/bookings/[bookingId]/meeting/route.ts").includes("eject_at_token_exp:true")],
 ["No recording start",read("app/api/bookings/[bookingId]/meeting/route.ts").includes("start_cloud_recording:false")],
 ["Temporary chat table",read("supabase/migrations/0005_meet_messaging_reviews.sql").includes("create table public.booking_messages")],
 ["Both-party completion guard",read("supabase/migrations/0005_meet_messaging_reviews.sql").includes("count(distinct participant_role)=2")],
 ["Review tied to completed booking",read("supabase/migrations/0005_meet_messaging_reviews.sql").includes("b.state='completed'")],
 ["Camera control",read("components/meet/MeetRoom.tsx").includes("setLocalVideo")],
 ["Mic control",read("components/meet/MeetRoom.tsx").includes("setLocalAudio")],
 ["In-call dictionary overlay",read("components/meet/MeetRoom.tsx").includes("dictionary-overlay")],
 ["Technical reporting",read("components/meet/MeetRoom.tsx").includes("video_unclear")],
 ["Quick messages",read("components/meet/BookingChat.tsx").includes("Please sign more slowly")],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)failed++}if(failed)process.exit(1);
