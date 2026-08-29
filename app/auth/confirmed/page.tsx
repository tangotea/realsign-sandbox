import Link from "next/link";
import EmailConfirmationPanel from "@/components/EmailConfirmationPanel";

export default function AuthConfirmedPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/">←</Link>
        <strong>RealSign Account</strong>
        <span />
      </header>
      <main className="main">
        <EmailConfirmationPanel />
      </main>
    </div>
  );
}
