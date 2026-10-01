import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage(){
  const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if(!configured)return <main className="main"><section className="card"><h1>Admin setup required</h1><p>Add the Supabase environment variables before Admin access can be evaluated.</p><Link href="/" className="btn secondary">Back to RealSign</Link></section></main>;
  const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return <main className="main"><section className="card"><h1>Admin sign-in required</h1><p>This area is restricted.</p><Link href="/sign-in" className="btn">Sign in</Link></section></main>;
  const {data:admin}=await supabase.from("admin_profiles").select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle(); if(!admin)return <main className="main"><section className="card"><h1>Access denied</h1><p>Your account does not have RealSign Admin permission.</p><Link href="/" className="btn secondary">Return home</Link></section></main>;
  const [{count:pendingProviders},{count:pendingVerification},{count:approvedProviders},{count:activeHolds},{count:confirmedBookings}]=await Promise.all([
    supabase.from("provider_profiles").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("verification_records").select("id",{count:"exact",head:true}).eq("state","pending"),
    supabase.from("provider_profiles").select("id",{count:"exact",head:true}).eq("status","approved"),
    supabase.from("booking_reservations").select("id",{count:"exact",head:true}).eq("state","hold").gt("expires_at",new Date().toISOString()),
    supabase.from("bookings").select("id",{count:"exact",head:true}).eq("state","confirmed"),
  ]);
  return <div className="admin-shell"><main className="admin-main"><div className="row"><div><h1 style={{marginBottom:4}}>Overview</h1><div className="muted">What needs your attention?</div></div><span className="pill">{admin.role} admin</span></div><section className="stats" style={{marginTop:24}}><Link href="/admin/providers" className="card stat"><strong>{pendingProviders||0}</strong><span>Provider approvals</span></Link><Link href="/admin/providers" className="card stat"><strong>{pendingVerification||0}</strong><span>Verification items</span></Link><div className="card stat"><strong>{approvedProviders||0}</strong><span>Approved providers</span></div><div className="card stat"><strong>{activeHolds||0}</strong><span>Active checkout holds</span></div><div className="card stat"><strong>{confirmedBookings||0}</strong><span>Confirmed bookings</span></div></section><section className="admin-actions"><h2>Quick actions</h2><nav className="workspace-shortcuts"><Link href="/admin/users">Find a person</Link><Link href="/admin/providers">Review applications</Link><Link href="/admin/payouts">Manage payouts</Link><Link href="/admin/reviews">Review reports</Link><Link href="/admin/help">Edit help content</Link></nav></section></main></div>;
}
