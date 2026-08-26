import Link from "next/link";
import Image from "next/image";
import AppNav from "@/components/AppNav";
import AuthAction from "@/components/AuthAction";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand brand-lockup"><Image src="/realsign-logo.png" width={30} height={30} alt="" priority />REALSIGN</div>
        <AuthAction initialSignedIn={Boolean(auth.user)} />
      </header>

      <main className="main">
        <section className="hero">
          <h1>Find. Book. Pay. Meet.</h1>
          <p>Deaf tutors and SASL interpreters.</p>
        </section>

        <div className="row" style={{marginTop: 14}}>
          <strong>What is RealSign?</strong>
          <button className="help-btn" aria-label="What is RealSign help">?</button>
        </div>

        <section className="stack" aria-label="Choose a service">
          <Link className="card choice" href="/learn">
            <div className="icon">🤟</div>
            <div><h2>Learn Sign Language</h2></div>
          </Link>
          <Link className="card choice" href="/interpreter">
            <div className="icon">👐</div>
            <div><h2>Video Call SASL Interpreting</h2></div>
          </Link>
          <Link className="card choice provider-choice" href="/provider">
            <div className="icon">＋</div>
            <div><h2>Offer a Service</h2><p>Apply as a SASL tutor or interpreter.</p></div>
          </Link>
        </section>
      </main>
      <AppNav />
    </div>
  );
}
