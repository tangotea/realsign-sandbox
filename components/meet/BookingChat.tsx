"use client";
import {useCallback,useEffect,useState} from "react";

const QUICK=["Please repeat","Please sign more slowly","I don't understand","Please type the word"];
export default function BookingChat({bookingId,currentUserId}:{bookingId:string;currentUserId:string}){
 const [messages,setMessages]=useState<any[]>([]),[text,setText]=useState(""),[open,setOpen]=useState(true),[expanded,setExpanded]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{const r=await fetch(`/api/bookings/${bookingId}/messages`,{cache:"no-store"});if(!r.ok)return;const j=await r.json();setMessages(j.messages||[]);setOpen(j.open!==false)},[bookingId]);
 useEffect(()=>{load();const t=setInterval(load,2500);return()=>clearInterval(t)},[load]);
 async function send(body:string,isQuickMessage=false){if(!body.trim()||!open)return;setError("");const r=await fetch(`/api/bookings/${bookingId}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body,isQuickMessage})});const j=await r.json().catch(()=>({}));if(!r.ok){setError(j.error||"Unable to send message");return}setText("");setExpanded(true);await load()}
 const last=messages[messages.length-1];
 return <section className="call-chat">
   {last&&!expanded?<button className="chat-latest" onClick={()=>setExpanded(true)}><strong>💬 {last.sender_user_id===currentUserId?"You":last.sender_name||"Other person"}:</strong> {last.body}</button>:null}
   {expanded?<div className="chat-history">{messages.map(m=><div className={`chat-bubble ${m.sender_user_id===currentUserId?"mine":""}`} key={m.id}><strong>{m.sender_user_id===currentUserId?"You":m.sender_name||"Other person"}</strong><span>{m.body}</span></div>)}{!messages.length?<p className="muted">Use chat when a sign, word or instruction is unclear.</p>:null}</div>:null}
   <div className="chat-compose"><input className="field" aria-label="Type a message" placeholder={open?"💬 Type a message…":"This booking conversation has closed."} value={text} disabled={!open} onFocus={()=>setExpanded(true)} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();send(text)}}}/><button className="mini-btn" disabled={!open||!text.trim()} onClick={()=>send(text)}>Send</button><button className="mini-btn" onClick={()=>setExpanded(v=>!v)}>{expanded?"Hide":"Chat"}</button></div>
   {expanded&&open?<div className="quick-message-row">{QUICK.map(q=><button className="pill quick" key={q} onClick={()=>send(q,true)}>{q}</button>)}</div>:null}
   {error?<p className="notice">{error}</p>:null}
 </section>
}
