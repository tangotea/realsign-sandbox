import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminProviderActions from "@/components/admin/AdminProviderActions";
import VerificationActions from "@/components/admin/VerificationActions";
import IdentityAdminActions from "@/components/admin/IdentityAdminActions";
import type { VerificationState } from "@/lib/domain";
import { roleLabel, serviceDetailLabel, serviceLabel } from "@/lib/marketplace";

export default async function AdminProviderReviewPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{archived_page?:string}>}){
 const {id}=await params; const {archived_page}=await searchParams; const requestedPage=Number.parseInt(archived_page||"1",10); const archivedPage=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1; const archivedPageSize=20; const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser();
 if(!auth.user)return <main className="admin-main"><h1>Sign in required</h1><Link className="btn" href="/sign-in">Sign in</Link></main>;
 const {data:admin}=await supabase.from("admin_profiles").select("role").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle(); if(!admin)return <main className="admin-main"><h1>Access denied</h1></main>;
 const profileRes=await supabase.from("provider_profiles").select("id,user_id,status,public_display_name,introduction_text,introduction_video_path,created_at").eq("id",id).single();
 const p=profileRes.data; if(!p)return <main className="admin-main"><h1>Provider not found</h1></main>;
 const [rolesRes,verifyRes,identityRes,activeServicesRes,archivedServicesRes,settingsRes]=await Promise.all([
  supabase.from("provider_roles").select("role,approved").eq("provider_id",id),
  supabase.from("verification_records").select("id,type,state,storage_path,submitted_at,internal_note").eq("provider_id",id),
  supabase.from("user_identity_verifications").select("user_id,state,storage_path,submitted_at").eq("user_id",p.user_id).maybeSingle(),
  supabase.from("provider_services").select("id,title,duration_min,price_cents,status,provider_role").eq("provider_id",id).eq("status","active").order("created_at",{ascending:false}),
  supabase.from("provider_services").select("id,title,duration_min,price_cents,status,provider_role",{count:"exact"}).eq("provider_id",id).eq("status","archived").order("updated_at",{ascending:false}).range((archivedPage-1)*archivedPageSize,archivedPage*archivedPageSize-1),
  supabase.from("provider_booking_settings").select("booking_notice_min,buffer_min").eq("provider_id",id).maybeSingle(),
 ]);
 const storageAdmin=createAdminClient();
 const introVideoUrl=p.introduction_video_path&&storageAdmin?(await storageAdmin.storage.from("provider-media").createSignedUrl(p.introduction_video_path,600)).data?.signedUrl||null:null;
 const accountIdentity=identityRes.data;
 const accountIdentityUrl=accountIdentity?.storage_path&&storageAdmin?(await storageAdmin.storage.from("verification-documents").createSignedUrl(accountIdentity.storage_path,600)).data?.signedUrl||null:null;
 const verificationsWithUrls=await Promise.all((verifyRes.data||[]).map(async v=>{
  if(!v.storage_path||!storageAdmin)return {...v,reviewUrl:null};
  const {data}=await storageAdmin.storage.from("verification-documents").createSignedUrl(v.storage_path,600);
  return {...v,reviewUrl:data?.signedUrl||null};
 }));
 const archivedTotal=archivedServicesRes.count||0; const archivedPageCount=Math.max(1,Math.ceil(archivedTotal/archivedPageSize)); const canReview=p.user_id!==auth.user.id;
 const renderService=(s:any,archived=false)=><div className="service-row" key={s.id}><div><strong>{serviceLabel(s)}</strong><small>{s.duration_min} min · {roleLabel(s.provider_role)}</small>{serviceDetailLabel(s)?<small>Outline: {serviceDetailLabel(s)}</small>:null}{archived?<small>Removed from provider services</small>:null}</div><div style={{textAlign:"right"}}>{archived?<span className="status">Removed</span>:null}<strong>R{(s.price_cents/100).toFixed(0)}</strong></div></div>;
 return <div className="admin-main"><div className="row"><div><Link href="/admin/providers" className="muted">← Providers</Link><h1 style={{marginBottom:4}}>{p.public_display_name||"Unnamed applicant"}</h1><p className="muted">Application status: {p.status}</p></div><span className="pill">{admin.role} admin</span></div>
  <div className="admin-review-grid">
   <div className="stack">
    <section className="card"><h2>Profile</h2><p>{p.introduction_text||"No written introduction yet."}</p><div className="tag-row">{(rolesRes.data||[]).map(r=><span className="pill" key={r.role}>{roleLabel(r.role)}</span>)}</div><p className="muted">Intro video: {p.introduction_video_path?"Uploaded ✓":"Not uploaded"}</p>{introVideoUrl?<><p className="notice">Review this video as part of the provider review. There is no separate video approval; use <strong>Approve provider</strong> after reviewing all materials.</p><video className="admin-review-video" controls playsInline preload="metadata" src={introVideoUrl}/></>:p.introduction_video_path?<p className="muted">The uploaded video could not be opened.</p>:null}</section>
    <section className="card"><h2>Account identity verification</h2><p className="muted">This is the account identity check used for learner bookings. It is separate from provider application verification.</p>{accountIdentity?<div className="verification-admin"><div className="admin-verification-file"><div><strong>Identity document</strong><small>{accountIdentity.state.replaceAll("_"," ")}{accountIdentity.submitted_at?` · Submitted ${new Date(accountIdentity.submitted_at).toLocaleDateString()}`:""}</small></div>{accountIdentityUrl?<a className="mini-btn" href={accountIdentityUrl} target="_blank" rel="noreferrer">Open document</a>:accountIdentity.storage_path?<small className="muted">File unavailable</small>:null}</div>{accountIdentity.user_id?<IdentityAdminActions userId={accountIdentity.user_id}/>:null}</div>:<p className="muted">No account identity submission found.</p>}</section>
    <section className="card"><h2>Provider application verification</h2>{verificationsWithUrls.map(v=><div className="verification-admin" key={v.id}><div className="admin-verification-file"><div><strong>{v.type.replaceAll("_"," ")}</strong><small>{v.submitted_at?`Submitted ${new Date(v.submitted_at).toLocaleDateString()}`:"Not submitted"}</small></div>{v.reviewUrl?<a className="mini-btn" href={v.reviewUrl} target="_blank" rel="noreferrer">Open document</a>:v.storage_path?<small className="muted">File unavailable</small>:null}</div><VerificationActions id={v.id} state={v.state as VerificationState}/></div>)}{!verifyRes.data?.length?<p className="muted">No provider verification submissions yet.</p>:null}</section>
    <section className="card"><h2>Current services & rates</h2>{(activeServicesRes.data||[]).map(s=>renderService(s))}{!activeServicesRes.data?.length?<p className="muted">No active services created.</p>:null}{archivedTotal?<><h3>Removed services</h3><p className="muted">Removed services stay here for booking and audit history. They are not visible to learners.</p>{(archivedServicesRes.data||[]).map(s=>renderService(s,true))}<div className="row wrap" style={{marginTop:14}}>{archivedPage>1?<Link className="mini-btn" href={`/admin/providers/${id}?archived_page=${archivedPage-1}`}>← Newer</Link>:null}<span className="muted">Page {Math.min(archivedPage,archivedPageCount)} of {archivedPageCount}</span>{archivedPage<archivedPageCount?<Link className="mini-btn" href={`/admin/providers/${id}?archived_page=${archivedPage+1}`}>Older →</Link>:null}</div></>:null}</section>
    <section className="card"><h2>Booking settings</h2><p>Notice: <strong>{settingsRes.data?.booking_notice_min||120} min</strong></p><p>Break: <strong>{settingsRes.data?.buffer_min||15} min</strong></p></section>
   </div>
   <AdminProviderActions providerId={id} currentStatus={p.status} canReview={canReview}/>
  </div>
 </div>;
}
