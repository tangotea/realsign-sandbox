import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paystackRequest } from "@/lib/paystack";

export async function GET(){
  const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Sign in required"},{status:401});
  try{
    const result=await paystackRequest<{status:boolean;data:any[]}>("/bank?currency=ZAR&enabled_for_verification=true",{method:"GET"});
    const banks=(result.data||[]).filter((b:any)=>b.active!==false&&b.type==="basa").map((b:any)=>({name:b.name,code:b.code,supportedTypes:b.supported_types||["personal"]}));
    return NextResponse.json({banks});
  }catch(error:any){return NextResponse.json({error:error.message||"Unable to load banks"},{status:500})}
}
