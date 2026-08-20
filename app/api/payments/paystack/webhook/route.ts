import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndFinalizePayment, verifyPaystackSignature } from "@/lib/paystack";

async function refreshBatchForItem(admin:any,itemId:string){
  const {data:item}=await admin.from("payout_items").select("batch_id").eq("id",itemId).maybeSingle();
  if(item?.batch_id) await admin.rpc("refresh_payout_batch_state",{p_batch_id:item.batch_id});
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"))) return new NextResponse("Invalid signature", { status: 401 });
  let event:any;
  try { event = JSON.parse(raw); } catch { return new NextResponse("Invalid JSON", { status: 400 }); }
  const admin = createAdminClient();
  if (!admin) return new NextResponse("Server not configured", { status: 500 });

  try {
    if (event.event === "charge.success" && event.data?.reference) {
      await verifyAndFinalizePayment(event.data.reference);
    }

    if (["refund.pending","refund.processing","refund.needs-attention","refund.failed","refund.processed"].includes(event.event)) {
      const map:any={"refund.pending":"pending","refund.processing":"processing","refund.needs-attention":"needs_attention","refund.failed":"failed","refund.processed":"processed"};
      const refundId=event.data?.id != null ? String(event.data.id) : null;
      if(refundId){
        const {data:refund}=await admin.from("refunds").select("id,payment_id,booking_id,amount_cents,provider_liability_cents,state").eq("paystack_refund_id",refundId).maybeSingle();
        if(refund){
          const previousRefundState=refund.state;
          await admin.from("refunds").update({state:map[event.event],gateway_message:event.data?.reason||event.data?.status||null,processed_at:event.event==="refund.processed"?new Date().toISOString():null}).eq("id",refund.id);
          if(event.event==="refund.failed"){
            const {data:processed}=await admin.from("refunds").select("amount_cents").eq("payment_id",refund.payment_id).eq("state","processed");
            const {data:payment}=await admin.from("payment_transactions").select("amount_cents").eq("id",refund.payment_id).single();
            const refunded=(processed||[]).reduce((s:number,r:any)=>s+r.amount_cents,0);
            await admin.from("payment_transactions").update({state:refunded>0?"partially_refunded":"success"}).eq("id",refund.payment_id);
            const {data:earning}=await admin.from("provider_earnings").select("id,amount_cents,release_after,booking_id").eq("payment_id",refund.payment_id).maybeSingle();
            if(earning){const {data:booking}=await admin.from("bookings").select("state").eq("id",earning.booking_id).single();const next=booking.state==="completed"&&new Date(earning.release_after)<=new Date()?"available":"pending";await admin.from("provider_earnings").update({state:next,held_reason:null}).eq("id",earning.id)}
          }
          if(event.event==="refund.processed"&&previousRefundState!=="processed"){
            const {data:payment}=await admin.from("payment_transactions").select("id,amount_cents,provider_earning_cents").eq("id",refund.payment_id).single();
            const {data:processed}=await admin.from("refunds").select("amount_cents").eq("payment_id",refund.payment_id).eq("state","processed");
            const refunded=(processed||[]).reduce((s:number,r:any)=>s+r.amount_cents,0);
            const finalPaymentState=refunded>=payment.amount_cents?"refunded":"partially_refunded";
            await admin.from("payment_transactions").update({state:finalPaymentState}).eq("id",refund.payment_id);
            const {data:currentBooking}=await admin.from("bookings").select("state").eq("id",refund.booking_id).single();if(!["cancelled_by_learner","cancelled_by_provider","no_show_learner","no_show_provider"].includes(currentBooking?.state))await admin.from("bookings").update({state:finalPaymentState}).eq("id",refund.booking_id);
            const {data:earning}=await admin.from("provider_earnings").select("id,amount_cents,release_after,booking_id").eq("payment_id",refund.payment_id).maybeSingle();
            if(earning){
              const remaining=Math.max(0,earning.amount_cents-refund.provider_liability_cents);
              const {data:booking}=await admin.from("bookings").select("state").eq("id",earning.booking_id).single();
              let state:any="pending";
              if(remaining===0) state="reversed";
              else if(booking.state==="completed"&&new Date(earning.release_after)<=new Date()) state="available";
              await admin.from("provider_earnings").update({amount_cents:remaining,state,held_reason:null}).eq("id",earning.id);
            }
            await admin.from("financial_ledger").insert({booking_id:refund.booking_id,payment_id:refund.payment_id,category:"refund",direction:"debit",amount_cents:refund.amount_cents,reference:`refund-${refund.id}`});
          }
        }
      }
    }

    if (["transfer.success","transfer.failed","transfer.reversed"].includes(event.event) && event.data?.reference) {
      const {data:item}=await admin.from("payout_items").select("id,batch_id,provider_id,amount_cents,state").eq("reference",event.data.reference).maybeSingle();
      if(item){
        const nextState=event.event==="transfer.success"?"paid":event.event==="transfer.reversed"?"reversed":"failed";
        const wasPaid=item.state==="paid";
        await admin.from("payout_items").update({state:nextState,transfer_code:event.data?.transfer_code||null,gateway_status:event.data?.status||null,failure_reason:event.data?.failures?JSON.stringify(event.data.failures):null,paid_at:nextState==="paid"?new Date().toISOString():null}).eq("id",item.id);
        const {data:links}=await admin.from("payout_item_earnings").select("earning_id").eq("payout_item_id",item.id);
        const ids=(links||[]).map((x:any)=>x.earning_id);
        if(ids.length){
          if(nextState==="paid") await admin.from("provider_earnings").update({state:"paid",paid_at:new Date().toISOString()}).in("id",ids);
          else await admin.from("provider_earnings").update({state:"available",paid_at:null}).in("id",ids);
        }
        if(nextState==="paid"&&!wasPaid) await admin.from("financial_ledger").insert({provider_id:item.provider_id,category:"provider_payout",direction:"debit",amount_cents:item.amount_cents,reference:event.data.reference});
        await refreshBatchForItem(admin,item.id);
      }
    }
  } catch (error) {
    console.error("Paystack webhook processing error", error);
    // Paystack retries failed webhook deliveries. Returning 500 prevents silent loss.
    return new NextResponse("Webhook processing failed", { status: 500 });
  }

  return new NextResponse("OK", { status: 200 });
}
