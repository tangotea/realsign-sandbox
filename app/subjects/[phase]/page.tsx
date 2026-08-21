import Link from "next/link";
import { notFound } from "next/navigation";
import AppNav from "@/components/AppNav";
import { PHASES } from "@/lib/marketplace";
import { createClient } from "@/lib/supabase/server";

export default async function PhaseSubjectsPage({ params }: { params: Promise<{ phase: string }> }) {
  const { phase } = await params;
  const config = PHASES.find(p => p.slug === phase);
  if (!config) notFound();
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("id,name,phase,min_grade,max_grade").eq("active", true).or(`phase.eq.${config.db},code.eq.sasl-r12`).order("display_order");
  return <div className="shell">
    <header className="topbar"><Link href="/subjects">←</Link><strong>{config.label}</strong><button className="help-btn" aria-label="Open SASL help">?</button></header>
    <main className="main">
      <section className="hero"><h1>What subject?</h1><p>Choose what the Grade {config.grade} learner needs help with.</p></section>
      <div className="stack compact">{(subjects || []).map(s=><Link className="card subject-link" key={s.id} href={`/marketplace?subject=${s.id}&subjectName=${encodeURIComponent(s.name)}&grade=${config.grade}`}><strong>{s.name}</strong><span>Find tutors and teachers →</span></Link>)}</div>
    </main><AppNav />
  </div>;
}
