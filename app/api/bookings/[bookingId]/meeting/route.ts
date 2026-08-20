import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {dailyRequest,unixSeconds} from "@/lib/daily";

export async function POST(_request:Request,{params}:{params:Promise<{bookingId:string}>}){
  const {bookingId}=await params; const supabase=await createClient(); const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Sign in required"},{status:401});
  const admin=createAdminClient(); if(!admin)return NextResponse.json({error:"Server is not configured"},{status:503});
  try{
    const {data:b,error}=await admin.from("bookings").select("id,reference,state,start_at,end_at,learner_user_id,provider_id,provider_profiles(user_id,public_display_name)").eq("id",bookingId).single(); if(error||!b)throw new Error("Booking not found");
    const provider=(b.provider_profiles as any); const isLearner=b.learner_user_id===auth.user.id; const isProvider=provider?.user_id===auth.user.id;
    if(!isLearner&&!isProvider)return NextResponse.json({error:"Booking access required"},{status:403});
    if(!["confirmed","in_session"].includes(b.state))return NextResponse.json({error:"This session is not open."},{status:409});
    const [{data:joinSetting},{data:wrapSetting},{data:userProfile}]=await Promise.all([
      admin.from("platform_settings").select("value").eq("key","video_join_early_min").maybeSingle(),
      admin.from("platform_settings").select("value").eq("key","video_wrap_up_min").maybeSingle(),
      admin.from("profiles").select("display_name,first_name").eq("id",auth.user.id).maybeSingle()
    ]);
    const joinEarly=Math.max(0,Number(joinSetting?.value??15)); const wrap=Math.max(0,Number(wrapSetting?.value??2)); const now=Date.now(); const start=new Date(b.start_at).getTime(); const end=new Date(b.end_at).getTime();
    if(now<start-joinEarly*60000)return NextResponse.json({error:`Session opens ${joinEarly} minutes before the booking.`,opensAt:new Date(start-joinEarly*60000).toISOString()},{status:425});
    if(now>end+wrap*60000)return NextResponse.json({error:"This session has ended."},{status:410});
    let {data:session}=await admin.from("video_sessions").select("id,provider_room_name,provider_room_url,state").eq("booking_id",bookingId).maybeSingle();
    if(!session){
      const roomName=`rs-${bookingId.replaceAll("-","")}`.slice(0,50); const roomExp=Math.floor((end+(wrap+10)*60000)/1000);
      let room:any; try{room=await dailyRequest<any>("/rooms",{method:"POST",body:JSON.stringify({name:roomName,privacy:"private",properties:{exp:roomExp,max_participants:2,enable_chat:false,start_video_off:false,start_audio_off:false,eject_at_room_exp:true}})});}catch{room=await dailyRequest<any>(`/rooms/${roomName}`,{method:"GET"});}
      const ins=await admin.from("video_sessions").insert({booking_id:bookingId,provider_room_name:room.name,provider_room_url:room.url,state:"waiting"}).select("id,provider_room_name,provider_room_url,state").single(); if(ins.error)throw ins.error; session=ins.data;
    }
    const displayName=userProfile?.display_name||userProfile?.first_name||(isProvider?provider?.public_display_name:"RealSign learner");
    const token=await dailyRequest<any>("/meeting-tokens",{method:"POST",body:JSON.stringify({properties:{room_name:session.provider_room_name,nbf:Math.floor((start-joinEarly*60000)/1000),exp:Math.floor((end+wrap*60000)/1000),eject_at_token_exp:true,is_owner:false,user_name:displayName,user_id:auth.user.id,enable_screenshare:false,enable_recording_ui:false,start_cloud_recording:false}})});
    await supabase.rpc("mark_booking_in_session",{p_booking_id:bookingId});
    return NextResponse.json({roomUrl:session.provider_room_url,token:token.token,booking:{id:b.id,reference:b.reference,startAt:b.start_at,endAt:b.end_at,wrapUpMinutes:wrap},participantRole:isProvider?"provider":"learner",displayName});
  }catch(e:any){return NextResponse.json({error:e.message||"Unable to open session"},{status:500})}
}
