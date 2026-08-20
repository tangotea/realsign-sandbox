"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminProviderActions({providerId,currentStatus}:{providerId:string;currentStatus:string}){
  const supabase=useMemo(()=>createClient(),[]); const [message,setMessage]=useState(""); const [reason,setReason]=useState("");
  async function review(status:"approved"|"rejected"|"pending"|"suspended"){
    setMessage("Saving…"); const {error}=await supabase.rpc("admin_review_provider",{p_provider_id:providerId,p_status:status,p_reason:reason||null});
    if(error){setMessage(error.message);return;} setMessage(`Provider ${status} ✓`); window.location.reload();
  }
  return <section className="card"><h2>Admin decision</h2><p>Current status: <strong>{currentStatus}</strong></p><label>Internal reason / note<textarea className="field" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Optional, but recommended for rejection or suspension"/></label><div className="row wrap"><button className="btn" onClick={()=>review("approved")}>Approve provider</button><button className="btn secondary" onClick={()=>review("pending")}>Request / keep pending</button><button className="btn danger" onClick={()=>review("rejected")}>Reject</button>{currentStatus==="approved"?<button className="btn danger" onClick={()=>review("suspended")}>Suspend</button>:null}</div>{message?<p className="muted" aria-live="polite">{message}</p>:null}</section>
}
