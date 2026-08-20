import webpush from "web-push";

let configured=false;
function configure(){
  if(configured)return;
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT||"mailto:admin@realsign.example";
  if(!publicKey||!privateKey)throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(subject,publicKey,privateKey); configured=true;
}
export async function sendPush(subscription:{endpoint:string;p256dh:string;auth_key:string},payload:{title:string;body:string;url?:string;tag?:string}){
  configure();
  return webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},JSON.stringify(payload),{TTL:3600,urgency:"high"});
}
