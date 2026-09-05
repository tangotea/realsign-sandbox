import Link from "next/link";
import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import { MarketplaceProvider, languageLabel, money, roleLabel, serviceLabel } from "@/lib/marketplace";
import HelpButton from "@/components/help/HelpButton";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const subject = q.subject || null;
  const language = q.language || null;
  const requestedRole = q.role || null;
  const role = requestedRole === "deaf_tutor" || requestedRole === "interpreter" ? requestedRole : null;
  if (!role) redirect("/");
  const roleLocked = Boolean(role);
  const pageTitle = q.subjectName || (role === "deaf_tutor" ? "Learn Sign Language" : "Interpreters");
  const selectedGrade = q.grade ? Number(q.grade) : null;
  const grade = Number.isInteger(selectedGrade) ? selectedGrade : null;
  const { data, error } = await supabase.rpc("search_marketplace_providers", {
    p_subject_id: subject,
    p_grade: grade,
    p_language_code: language,
    p_role: role,
    p_limit: 30,
  });
  const providers = ((data || []) as MarketplaceProvider[]).filter(p => role ? p.roles.some(r => r === role || (role === "deaf_tutor" && r === "deaf tutor")) : p.roles.some(r => r === "deaf_tutor" || r === "deaf tutor" || r === "interpreter"));
  const { data: auth } = await supabase.auth.getUser();
  const { data: ownProvider } = auth.user ? await supabase.from("provider_profiles").select("id").eq("user_id", auth.user.id).maybeSingle() : { data: null };
  const ownProviderId = ownProvider?.id || null;
  const { data: languages } = await supabase.from("languages").select("code,name").eq("active",true).order("display_order");

  return <div className="shell"><header className="topbar"><Link href="/">←</Link><strong>{pageTitle}</strong><span /></header>
    <main className="main">
      <section className="hero"><div className="page-heading"><div><h1>{pageTitle}</h1><p>Only approved providers and active services are shown.</p></div><HelpButton slug="marketplace" label="Marketplace help" size="regular" fallbackText="Choose a language and review approved provider profiles. Open a profile to see services, prices and available booking times." /></div></section>
      <form className="market-filters" method="get">
        {subject ? <input type="hidden" name="subject" value={subject}/> : null}
        {q.subjectName ? <input type="hidden" name="subjectName" value={q.subjectName}/> : null}
        {grade ? <input type="hidden" name="grade" value={String(grade)}/> : null}
        {roleLocked ? <><input type="hidden" name="role" value={role}/><label>Provider type<div className="field readonly-field">{roleLabel(role)}</div></label></> : null}
        <label>Language<select className="field" name="language" defaultValue={language || ""}><option value="">Any language</option>{(languages||[]).filter(l=>role!=="interpreter"||l.code!=="sasl").map(l=><option key={l.code} value={l.code}>{languageLabel(l.name, role)}</option>)}</select></label>
        <button className="btn secondary">Update results</button>
      </form>
      {error ? <p className="notice">Marketplace could not load: {error.message}</p> : null}
      <div className="stack marketplace-list">{providers.map(p=>{const isOwnProvider=p.provider_id===ownProviderId;return <article className="card provider-card" key={p.provider_id}>
        <div className="provider-avatar">▶</div>
        <div className="provider-card-body"><h2>{p.public_display_name}</h2>
          <div className="tag-row">{p.roles.filter(r => role ? (r === role || (role === "deaf_tutor" && r === "deaf tutor")) : (r === "deaf_tutor" || r === "deaf tutor" || r === "interpreter")).map(r=><span className="pill" key={r}>{roleLabel(r)}</span>)}{isOwnProvider?<span className="pill">Your provider profile</span>:null}</div>
          {p.languages.length ? <p><strong>Languages I use:</strong> {p.languages.map(language => languageLabel(language, role)).filter(Boolean).join(" · ")}</p> : null}
          <p><strong>{serviceLabel(role)}</strong><br/>{p.sample_duration_min} min · from {money(p.min_price_cents)}</p>
          {isOwnProvider?<p className="notice"><strong>This is your provider profile.</strong> You cannot book yourself.</p>:null}
          <div className="row wrap"><Link className="btn" href={`/providers/${p.provider_id}${role ? `?role=${role}` : ""}`}>{isOwnProvider?"View your profile":"View profile"}</Link>{!isOwnProvider?<Link className="btn secondary" href={`/providers/${p.provider_id}/book?service=${p.sample_service_id}`}>View times</Link>:null}</div>
        </div>
      </article>})}</div>
      {!providers.length && !error ? <section className="card"><h2>No providers yet</h2><p>Try another language or check again as RealSign providers are approved.</p></section> : null}
    </main><AppNav /></div>;
}
