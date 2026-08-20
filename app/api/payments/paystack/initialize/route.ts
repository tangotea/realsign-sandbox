import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paystackRequest, paymentReference } from "@/lib/paystack";

export async function POST(request: Request) {
  let prepared:any=null;
  const admin=createAdminClient();
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.email) return NextResponse.json({ error: "Sign in with an email address first." }, { status: 401 });
    const { holdId } = await request.json();
    if (!holdId) return NextResponse.json({ error: "Missing checkout hold." }, { status: 400 });

    const reference = paymentReference();
    const { data, error } = await supabase.rpc("prepare_own_booking_payment", { p_hold_id: holdId, p_reference: reference });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    prepared=data;
    if (prepared?.checkout_url) return NextResponse.json({ authorizationUrl: prepared.checkout_url, reference: prepared.reference });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const response = await paystackRequest<{status:boolean;data:{authorization_url:string;access_code:string;reference:string}}>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: auth.user.email,
        amount: String(prepared.amount_cents),
        currency: "ZAR",
        reference: prepared.reference,
        callback_url: `${appUrl}/payments/callback`,
        metadata: JSON.stringify({ realSignHoldId: holdId, realSignPaymentId: prepared.payment_id }),
      }),
    });

    if (!admin) throw new Error("Supabase service role is not configured");
    await admin.from("payment_transactions").update({state:"pending",checkout_url:response.data.authorization_url,access_code:response.data.access_code}).eq("id",prepared.payment_id);
    return NextResponse.json({ authorizationUrl: response.data.authorization_url, reference: response.data.reference });
  } catch (error: any) {
    if(admin&&prepared?.payment_id){
      await admin.from("payment_transactions").update({state:"failed",gateway_response:error?.message||"Payment initialization failed"}).eq("id",prepared.payment_id);
      const {data:payment}=await admin.from("payment_transactions").select("hold_id").eq("id",prepared.payment_id).maybeSingle();
      if(payment?.hold_id) await admin.from("booking_reservations").update({expires_at:new Date(Date.now()+2*60000).toISOString()}).eq("id",payment.hold_id).eq("state","hold");
    }
    return NextResponse.json({ error: error?.message || "Unable to start payment." }, { status: 500 });
  }
}
