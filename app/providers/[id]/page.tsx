import Link from "next/link";
import { notFound } from "next/navigation";
import AppNav from "@/components/AppNav";
import BookingPicker from "@/components/booking/BookingPicker";
import { createClient } from "@/lib/supabase/server";
import { PublicProvider, languageLabel, money, roleLabel } from "@/lib/marketplace";import ReportReviewButton from "@/components/meet/ReportReviewButton";

export default async function ProviderProfilePage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_provider", { p_provider_id: id });
  if (!data) notFound();
  const p = data as PublicProvider;
  const visibleRoles = p.roles.filter(r => r.role === "deaf_tutor" || r.role === "deaf tutor" || r.role === "interpreter");
  const visibleServices = p.services.filter(s => s.provider_role === "deaf_tutor" || s.provider_role === "deaf tutor" || s.provider_role === "interpreter");
  const bookableServices = visibleServices.filter(s => s.remote);
  const bookableService = bookableServices[0];
  const { data: reviewData } = await supabase.rpc("get_public_provider_reviews", { p_provider_id: id, p_limit: 8 });
  return <div className="shell"><header className="topbar"><Link href="/marketplace">←</Link><strong>{p.display_name}</strong><button className="help-btn" aria-label="Open SASL help">?</button></header>
    <main className="main">
      <section className="provider-profile-head">
        {p.introduction_video_path ? <video className="profile-video" controls preload="metadata" src={`/api/provider-media/${p.id}`} /> : <div className="video-placeholder">Introduction video</div>}
        <h1>{p.display_name}</h1>
        <div className="tag-row">{visibleRoles.map(r=><span className="pill" key={r.role}>{roleLabel(r.role)}</span>)}</div>
        <div className="verification-badges">{p.verification_badges?.includes("identity")?<span>🪪 Identity Verified <button className="help-btn mini" aria-label="Identity Verified help">?</button></span>:null}{p.verification_badges?.includes("deaf")?<span>🤟 Deaf Verified <button className="help-btn mini" aria-label="Deaf Verified help">?</button></span>:null}{p.verification_badges?.includes("teacher_qualification")?<span>🎓 Teacher Qualification Verified <button className="help-btn mini" aria-label="Teacher qualification help">?</button></span>:null}{p.verification_badges?.includes("interpreter_assessment")?<span>👐 Interpreter Verified <button className="help-btn mini" aria-label="Interpreter Verified help">?</button></span>:null}</div>
      </section>
      <section className="card"><h2>About me</h2><p>{p.introduction_text || "This provider has not added written introduction text yet."}</p><h3>Languages I use</h3><p>{p.languages.map(l=>languageLabel(l.name)).join(" · ") || "Not listed"}</p></section>
      <section className="card"><h2>Subjects</h2><div className="tag-row">{p.subjects.map(s=><span className="pill" key={s.id}>{s.name}{s.qualification_verified?" ✓":""}</span>)}</div></section>
      <section className="card"><h2>Services</h2><div className="service-list">{visibleServices.map(s=><div className="service-row" key={s.id}><div><strong>{s.title}</strong><small>{s.duration_min} minutes · {roleLabel(s.provider_role)}</small></div><div className="service-action"><strong>{money(s.price_cents)}</strong>{s.provider_role==="interpreter"&&s.in_person?<Link className="mini-btn" href={`/providers/${p.id}/request`}>Request in person</Link>:null}</div></div>)}</div></section>
      {bookableService ? <BookingPicker provider={p} service={bookableService} services={bookableServices} /> : null}
      <section className="card"><h2>Reviews</h2><p><strong>⭐ {reviewData?.average || 0}</strong> · {reviewData?.count || 0} verified reviews</p><div className="stack compact">{(reviewData?.reviews||[]).map((r:any,i:number)=><div className="service-row" key={i}><div><strong>{"★".repeat(r.stars)}{"☆".repeat(5-r.stars)}</strong><small>{(r.tags||[]).join(" · ")}</small>{r.comment?<p>{r.comment}</p>:null}{r.id?<ReportReviewButton reviewId={r.id}/>:null}</div></div>)}</div></section>{p.booking_settings ? <p className="muted">Requires at least {p.booking_settings.booking_notice_min >= 60 ? `${p.booking_settings.booking_notice_min/60} hour${p.booking_settings.booking_notice_min===60?"":"s"}` : `${p.booking_settings.booking_notice_min} minutes`} notice · {p.booking_settings.buffer_min}-minute minimum break between sessions.</p> : null}
    </main><AppNav /></div>;
}
