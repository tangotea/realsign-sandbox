"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminProviderActions({providerId,currentStatus,canReview}:{providerId:string;currentStatus:string;canReview:boolean}){
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter(); const [message,setMessage]=useState(""); const [messageType,setMessageType]=useState<"success"|"error"|"info">("info"); const [reason,setReason]=useState(""); const [busy,setBusy]=useState(false);
  if(!canReview)return <section className="card"><h2>Admin decision</h2><p className="notice">This is your own provider application. Use a separate provider account for testing so an admin cannot approve or reject their own application.</p></section>;
  async function review(status:"approved"|"rejected"|"pending"|"suspended"){
    setBusy(true); setMessage("Saving…"); setMessageType("info"); const {error}=await supabase.rpc("admin_review_provider",{p_provider_id:providerId,p_status:status,p_reason:reason||null});
    if(error){setBusy(false);setMessage(error.message);setMessageType("error");return;} if(status==="approved"){router.push("/admin/providers?approved=1");return;} setBusy(false); setMessage(`Provider ${status} updated.`); setMessageType("success"); router.refresh();
  }
  return <section className="card"><h2>Admin decision</h2><p>Current status: <strong>{currentStatus}</strong></p>{currentStatus==="approved"?<p className="admin-success"><strong>Provider already approved.</strong> No further approval is needed.</p>:null}<label>Internal reason / note<textarea className="field" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Optional, but recommended for rejection or suspension"/></label><div className="row wrap"><button className="btn" disabled={busy||currentStatus==="approved"} onClick={()=>review("approved")}>{currentStatus==="approved"?"Already approved":"Approve provider"}</button><button className="btn secondary" disabled={busy} onClick={()=>review("pending")}>Request / keep pending</button><button className="btn danger" disabled={busy} onClick={()=>review("rejected")}>Reject</button>{currentStatus==="approved"?<button className="btn danger" disabled={busy} onClick={()=>review("suspended")}>Suspend</button>:null}</div>{message?<p className={messageType==="success"?"admin-success":messageType==="error"?"service-feedback error":"muted"} aria-live="polite">{message}</p>:null}</section>
}
