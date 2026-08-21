import Link from "next/link";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import { MarketplaceProvider, money, roleLabel } from "@/lib/marketplace";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const subject = q.subject || null;
  const language = q.language || null;
  const role = q.role || null;
  const { data, error } = await supabase.rpc("search_marketplace_providers", {
    p_subject_id: subject,
    p_grade: null,
    p_language_code: language,
    p_role: role,
    p_limit: 30,
  });
  const providers = (data || []) as MarketplaceProvider[];
  const { data: languages } = await supabase.from("languages").select("code,name").eq("active",true).order("display_order");

  return <div className="shell"><header className="topbar"><Link href={subject?"/subjects":"/"}>←</Link><strong>{q.subjectName || "Find a provider"}</strong><button className="help-btn" aria-label="Open SASL help">?</button></header>
    <main className="main">
      <section className="hero"><h1>{q.subjectName || "RealSign providers"}</h1><p>Only approved providers and active services are shown.</p></section>
      <form className="market-filters" method="get">
        {subject ? <input type="hidden" name="subject" value={subject}/> : null}
        {q.subjectName ? <input type="hidden" name="subjectName" value={q.subjectName}/> : null}
        <label>Provider type<select className="field" name="role" defaultValue={role || ""}><option value="">Tutor or teacher</option><option value="deaf_tutor">Deaf Tutor</option><option value="qualified_deaf_teacher">Deaf Teacher</option></select></label>
        <label>Language<select className="field" name="language" defaultValue={language || ""}><option value="">Any language</option>{(languages||[]).map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <button className="btn secondary">Update results</button>
      </form>
      {error ? <p className="notice">Marketplace could not load: {error.message}</p> : null}
      <div className="stack marketplace-list">{providers.map(p=><article className="card provider-card" key={p.provider_id}>
        <div className="provider-avatar">▶</div>
        <div className="provider-card-body"><h2>{p.public_display_name}</h2>
          <div className="tag-row">{p.roles.map(r=><span className="pill" key={r}>{roleLabel(r)}</span>)}</div>
          {p.languages.length ? <p><strong>Languages I use:</strong> {p.languages.join(" · ")}</p> : null}
          <p><strong>{p.sample_service_title}</strong><br/>{p.sample_duration_min} min · from {money(p.min_price_cents)}</p>
          <div className="row wrap"><Link className="btn" href={`/providers/${p.provider_id}`}>View profile</Link><Link className="btn secondary" href={`/providers/${p.provider_id}/book?service=${p.sample_service_id}`}>View times</Link></div>
        </div>
      </article>)}</div>
      {!providers.length && !error ? <section className="card"><h2>No providers yet</h2><p>Try another language/provider type or check again as RealSign providers are approved.</p></section> : null}
    </main><AppNav /></div>;
}
