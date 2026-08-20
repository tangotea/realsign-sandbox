import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminProviderActions from "@/components/admin/AdminProviderActions";
import VerificationActions from "@/components/admin/VerificationActions";
import type { VerificationState } from "@/lib/domain";

export default async function AdminProviderReviewPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser();
 if(!auth.user)return <main className="admin-main"><h1>Sign in required</h1><Link className="btn" href="/sign-in">Sign in</Link></main>;
 const {data:admin}=await supabase.from("admin_profiles").select("role").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle(); if(!admin)return <main className="admin-main"><h1>Access denied</h1></main>;
 const [profileRes,rolesRes,verifyRes,subjectsRes,servicesRes,settingsRes]=await Promise.all([
  supabase.from("provider_profiles").select("id,user_id,status,public_display_name,introduction_text,introduction_video_path,created_at").eq("id",id).single(),
  supabase.from("provider_roles").select("role,approved").eq("provider_id",id),
  supabase.from("verification_records").select("id,type,state,storage_path,submitted_at,internal_note").eq("provider_id",id),
  supabase.from("provider_subjects").select("subject_id,homework_help,general_tutoring,exam_preparation,qualification_verified,subjects(name,phase)").eq("provider_id",id),
  supabase.from("provider_services").select("id,title,duration_min,price_cents,status,provider_role").eq("provider_id",id),
  supabase.from("provider_booking_settings").select("booking_notice_min,buffer_min").eq("provider_id",id).maybeSingle(),
 ]);
 const p=profileRes.data; if(!p)return <main className="admin-main"><h1>Provider not found</h1></main>;
 return <div className="admin-main"><div className="row"><div><Link href="/admin/providers" className="muted">← Providers</Link><h1 style={{marginBottom:4}}>{p.public_display_name||"Unnamed applicant"}</h1><p className="muted">Application status: {p.status}</p></div><span className="pill">{admin.role} admin</span></div>
  <div className="admin-review-grid">
   <div className="stack">
    <section className="card"><h2>Profile</h2><p>{p.introduction_text||"No written introduction yet."}</p><div className="tag-row">{(rolesRes.data||[]).map(r=><span className="pill" key={r.role}>{r.role.replaceAll("_"," ")}</span>)}</div><p className="muted">Intro video: {p.introduction_video_path?"Uploaded ✓":"Not uploaded"}</p></section>
    <section className="card"><h2>Verification</h2>{(verifyRes.data||[]).map(v=><div className="verification-admin" key={v.id}><div><strong>{v.type.replaceAll("_"," ")}</strong><small>{v.submitted_at?`Submitted ${new Date(v.submitted_at).toLocaleDateString()}`:"Not submitted"}</small></div><VerificationActions id={v.id} state={v.state as VerificationState}/></div>)}{!verifyRes.data?.length?<p className="muted">No verification submissions yet.</p>:null}</section>
    <section className="card"><h2>Subjects</h2><div className="tag-row">{(subjectsRes.data||[]).map((s:any)=><span className="pill" key={s.subject_id}>{s.subjects?.name||"Subject"} · {s.subjects?.phase||""}</span>)}</div></section>
    <section className="card"><h2>Services & rates</h2>{(servicesRes.data||[]).map(s=><div className="service-row" key={s.id}><div><strong>{s.title}</strong><small>{s.duration_min} min · {s.provider_role.replaceAll("_"," ")}</small></div><strong>R{(s.price_cents/100).toFixed(0)}</strong></div>)}{!servicesRes.data?.length?<p className="muted">No services created.</p>:null}</section>
    <section className="card"><h2>Booking settings</h2><p>Notice: <strong>{settingsRes.data?.booking_notice_min||120} min</strong></p><p>Break: <strong>{settingsRes.data?.buffer_min||15} min</strong></p></section>
   </div>
   <AdminProviderActions providerId={id} currentStatus={p.status}/>
  </div>
 </div>;
}
