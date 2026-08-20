// Read-only credential/connectivity smoke test. No bookings, charges, rooms or payouts are created.
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
let failed=0;for(const k of required){if(!process.env[k]){console.error('MISSING',k);failed++}}
async function probe(name,url,init={}){try{const r=await fetch(url,init);console.log(name,r.status,r.ok?'OK':'REACHABLE');return true}catch(e){console.error(name,'FAILED',e.message);failed++;return false}}
if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)await probe('Supabase',`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}});
if(process.env.PAYSTACK_SECRET_KEY)await probe('Paystack','https://api.paystack.co/bank?country=south%20africa',{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`}});else console.log('SKIP Paystack: PAYSTACK_SECRET_KEY not set');
if(process.env.DAILY_API_KEY)await probe('Daily','https://api.daily.co/v1/rooms?limit=1',{headers:{Authorization:`Bearer ${process.env.DAILY_API_KEY}`}});else console.log('SKIP Daily: DAILY_API_KEY not set');
if(failed)process.exit(1);
