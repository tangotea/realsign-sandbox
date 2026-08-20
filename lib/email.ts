export async function sendTransactionalEmail(input:{to:string;subject:string;template:string;payload:any}){
 const url=process.env.TRANSACTIONAL_EMAIL_WEBHOOK_URL;const secret=process.env.TRANSACTIONAL_EMAIL_WEBHOOK_SECRET;
 if(!url)throw new Error('TRANSACTIONAL_EMAIL_WEBHOOK_URL is not configured');
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(secret?{'authorization':`Bearer ${secret}`}:{})},body:JSON.stringify(input)});if(!r.ok)throw new Error(`Email transport returned ${r.status}`);return r.json().catch(()=>({ok:true}))
}
