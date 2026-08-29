import Link from "next/link";

export default async function AuthConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = error === "confirmation";

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/">←</Link>
        <strong>RealSign Account</strong>
        <span />
      </header>
      <main className="main">
        <section className="card">
          <h1 style={{ margin: 0 }}>{failed ? "Email confirmation" : "Email confirmed"}</h1>
          {failed ? (
            <div className="auth-error" role="alert">
              <strong>We could not confirm this email link.</strong>
              <span>The link may have expired or already been used. You can try signing in or request a new confirmation email.</span>
            </div>
          ) : (
            <div className="auth-success" role="status">
              <strong>Your email was confirmed successfully.</strong>
              <span>Your RealSign account is ready. Continue to RealSign to use your account.</span>
            </div>
          )}
          <div className="row wrap" style={{ marginTop: 16 }}>
            <Link className="btn" href={failed ? "/sign-in" : "/profile"}>{failed ? "Go to sign in" : "Continue to RealSign"}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
