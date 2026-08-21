import Link from "next/link";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: sasl } = await supabase.from("subjects").select("id").eq("code","sasl-r12").maybeSingle();
  const href = sasl?.id ? `/marketplace?subject=${sasl.id}&subjectName=SASL` : "/marketplace";
  return <div className="shell"><header className="topbar"><Link href="/">←</Link><strong>Learn Sign Language</strong><button className="help-btn" aria-label="Open SASL help">?</button></header><main className="main">
    <section className="hero"><h1>How would you like help?</h1><p>V1 connects you with people. Structured RealSASL lessons can be added later.</p></section>
    <div className="stack">
      <Link className="card choice" href={href}><div className="icon">🤟</div><div><h2>Conversation & Practice</h2><p>Find Deaf tutors for SASL practice.</p></div></Link>
      <Link className="card choice" href={href}><div className="icon">🎓</div><div><h2>SASL Tutoring</h2><p>Find Deaf tutors or Deaf teachers.</p></div></Link>
    </div>
  </main><AppNav /></div>;
}
