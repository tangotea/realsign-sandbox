"use client";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VerificationState } from "@/lib/domain";

export default function VerificationActions({id,state}:{id:string;state:VerificationState}){
 const supabase=useMemo(()=>createClient(),[]); const [message,setMessage]=useState("");
 async function set(next:VerificationState){const {error}=await supabase.rpc("admin_review_verification",{p_verification_id:id,p_state:next,p_note:null}); if(error)setMessage(error.message); else {setMessage(`${next.replaceAll("_"," ")} ✓`); window.location.reload();}}
 return <div className="row wrap"><span className={`status ${state==="approved"?"approved":""}`}>{state.replaceAll("_"," ")}</span><button className="mini-btn" onClick={()=>set("approved")}>Approve</button><button className="mini-btn" onClick={()=>set("needs_information")}>Need info</button><button className="mini-btn" onClick={()=>set("rejected")}>Reject</button>{message?<small>{message}</small>:null}</div>
}
