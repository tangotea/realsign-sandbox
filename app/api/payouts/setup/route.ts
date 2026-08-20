import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paystackRequest } from "@/lib/paystack";

export async function POST(request:Request){
  const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Sign in required"},{status:401});
  const {data:provider}=await supabase.from("provider_profiles").select("id,status").eq("user_id",auth.user.id).maybeSingle();
  if(!provider||provider.status!=="approved")return NextResponse.json({error:"Provider approval is required before payout setup."},{status:403});
  try{
    const body=await request.json();
    const {bankCode,bankName,accountName,accountNumber,accountType,documentType,documentNumber}=body;
    if(!bankCode||!bankName||!accountName||!accountNumber||!accountType||!documentType||!documentNumber)return NextResponse.json({error:"Complete all payout verification fields."},{status:400});
    if(!["personal","business"].includes(accountType))return NextResponse.json({error:"Invalid account type."},{status:400});
    if(!["identityNumber","passportNumber","businessRegistrationNumber"].includes(documentType))return NextResponse.json({error:"Invalid identity document type."},{status:400});
    if(accountType==="business"&&documentType!=="businessRegistrationNumber")return NextResponse.json({error:"Business bank accounts require a business registration number."},{status:400});
    if(accountType==="personal"&&documentType==="businessRegistrationNumber")return NextResponse.json({error:"Personal bank accounts require a South African ID or passport number."},{status:400});

    const validation=await paystackRequest<{status:boolean;data:any}>("/bank/validate",{method:"POST",body:JSON.stringify({bank_code:bankCode,country_code:"ZA",account_number:accountNumber,account_name:accountName,account_type:accountType,document_type:documentType,document_number:documentNumber})});
    if(!validation.data?.verified||!validation.data?.accountAcceptsCredits)return NextResponse.json({error:validation.data?.verificationMessage||"The bank account could not be verified for payouts."},{status:400});

    const recipient=await paystackRequest<{status:boolean;data:any}>("/transferrecipient",{method:"POST",body:JSON.stringify({type:"basa",name:accountName,account_number:accountNumber,bank_code:bankCode,currency:"ZAR"})});
    const admin=createAdminClient(); if(!admin)throw new Error("Supabase service role is not configured");
    const {data:existing}=await admin.from("provider_payout_accounts").select("recipient_code,account_last4").eq("provider_id",provider.id).maybeSingle();
    const {data:setting}=await admin.from("platform_settings").select("value").eq("key","payout_security_hold_hours").maybeSingle();
    const holdHours=Math.max(0,Number(setting?.value??24));
    const changed=Boolean(existing?.recipient_code&&existing.recipient_code!==recipient.data.recipient_code);
    const securityHoldUntil=changed?new Date(Date.now()+holdHours*3600000).toISOString():null;
    const state=changed&&holdHours>0?"security_hold":"verified";
    const payload={provider_id:provider.id,state,recipient_code:recipient.data.recipient_code,bank_code:bankCode,bank_name:bankName,account_name:accountName,account_type:accountType,account_last4:String(accountNumber).slice(-4),validation_metadata:{verified:true,accountAcceptsCredits:validation.data.accountAcceptsCredits,accountHolderMatch:validation.data.accountHolderMatch,accountOpen:validation.data.accountOpen},verified_at:new Date().toISOString(),security_hold_until:securityHoldUntil,changed_at:changed?new Date().toISOString():null};
    const {error}=await admin.from("provider_payout_accounts").upsert(payload,{onConflict:"provider_id"}); if(error)throw error;
    await admin.from("audit_log").insert({actor_user_id:auth.user.id,action:changed?"provider_payout_account_changed":"provider_payout_account_verified",entity_type:"provider_profile",entity_id:provider.id,after_data:{bank_name:bankName,account_last4:String(accountNumber).slice(-4),state,security_hold_until:securityHoldUntil}});
    return NextResponse.json({ok:true,state,bankName,accountLast4:String(accountNumber).slice(-4),securityHoldUntil});
  }catch(error:any){return NextResponse.json({error:error.message||"Unable to verify payout account."},{status:500})}
}
