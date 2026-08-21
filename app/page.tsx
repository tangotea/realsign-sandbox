import Link from "next/link";
import AppNav from "@/components/AppNav";

export default function Home() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">REALSIGN</div>
        <Link className="btn secondary" href="/sign-in">Sign in</Link>
      </header>

      <main className="main">
        <section className="hero">
          <h1>Find. Book. Pay. Meet.</h1>
          <p>Deaf tutors, Deaf teachers and SASL interpreters.</p>
        </section>

        <div className="row" style={{marginTop: 14}}>
          <strong>What is RealSign?</strong>
          <button className="help-btn" aria-label="What is RealSign help">?</button>
        </div>

        <section className="stack" aria-label="Choose a service">
          <Link className="card choice" href="/learn">
            <div className="icon">🤟</div>
            <div><h2>Learn Sign Language</h2><p>Find a Deaf SASL tutor or teacher.</p></div>
          </Link>
          <Link className="card choice" href="/subjects">
            <div className="icon">📚</div>
            <div><h2>School Help</h2><p>Find Grade 10, 11 or 12 school support.</p></div>
          </Link>
          <Link className="card choice" href="/interpreter">
            <div className="icon">👐</div>
            <div><h2>Find an Interpreter</h2><p>Remote or in-person SASL interpreting.</p></div>
          </Link>
        </section>

        <div style={{marginTop: 24, textAlign: "center"}}>
          <Link href="/provider"><strong>I want to offer a service</strong></Link>
        </div>
      </main>
      <AppNav />
    </div>
  );
}
