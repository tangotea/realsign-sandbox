import Link from "next/link";
import { verifyAndFinalizePayment } from "@/lib/paystack";

export default async function PaymentCallback({searchParams}:{searchParams:Promise<{reference?:string}>}){
  const {reference}=await searchParams;
  if(!reference)return <main className="main"><section className="card"><h1>Payment status</h1><p>No payment reference was supplied.</p><Link className="btn" href="/bookings">Bookings</Link></section></main>;
  try{
    const result=await verifyAndFinalizePayment(reference);
    if(result.status==="success"||result.status==="already_finalized") return <main className="main"><section className="card"><h1>You're booked ✓</h1><p>Your payment was verified and the booking is confirmed.</p><Link className="btn" href="/bookings">View booking</Link></section></main>;
    if(result.status==="manual_review") return <main className="main"><section className="card"><h1>Payment received</h1><p>Your payment needs a RealSign review before the booking can be confirmed. You will not be asked to pay again.</p><Link className="btn secondary" href="/bookings">View bookings</Link></section></main>;
    return <main className="main"><section className="card"><h1>Payment is still processing</h1><p>RealSign has not yet received a successful payment confirmation.</p><Link className="btn" href="/bookings">Bookings</Link></section></main>;
  }catch(error:any){return <main className="main"><section className="card"><h1>We couldn't confirm the payment yet</h1><p>{error?.message||"Please check your bookings shortly."}</p><Link className="btn" href="/bookings">Bookings</Link></section></main>}
}
