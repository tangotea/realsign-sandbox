import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin(){
 const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return {supabase,allowed:false};
 const {data:admin}=await supabase.from("admin_profiles").select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle(); return {supabase,allowed:Boolean(admin)};
}
export default async function AdminProvidersPage(){
 const {supabase,allowed}=await requireAdmin(); if(!allowed)return <main className="admin-main"><h1>Access denied</h1><Link href="/sign-in" className="btn">Admin sign in</Link></main>;
 const {data:providers}=await supabase.from("provider_profiles").select("id,status,public_display_name,user_id,created_at").order("created_at",{ascending:false});
 const ids=(providers||[]).map(p=>p.id); const {data:roles}=ids.length?await supabase.from("provider_roles").select("provider_id,role").in("provider_id",ids):{data:[]};
 const {data:verifications}=ids.length?await supabase.from("verification_records").select("provider_id,type,state").in("provider_id",ids):{data:[]};
 return <div className="admin-main"><div className="row"><div><h1>Provider applications</h1><p className="muted">Review SASL Tutors and SASL Interpreters.</p></div><Link href="/admin" className="btn secondary">Dashboard</Link></div><div className="admin-table" style={{marginTop:20}}>{(providers||[]).map(p=>{const r=(roles||[]).filter(x=>x.provider_id===p.id&&(x.role==="deaf_tutor"||x.role==="interpreter")); const v=(verifications||[]).filter(x=>x.provider_id===p.id);return <Link href={`/admin/providers/${p.id}`} className="admin-row" key={p.id}><div><strong>{p.public_display_name||"Unnamed applicant"}</strong><small>{r.length?r.map(x=>x.role.replaceAll("_"," ")).join(" · "):"No role selected"}</small></div><div><span className={`status ${p.status==="approved"?"approved":""}`}>{p.status}</span><small>{v.filter(x=>x.state==="pending").length} verification item(s) pending</small></div><strong>Review →</strong></Link>})}{!providers?.length?<div className="card">No provider applications yet.</div>:null}</div></div>;
}
