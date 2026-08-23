import Link from "next/link";
import ResetPasswordPanel from "@/components/ResetPasswordPanel";

export default function ResetPasswordPage() {
  return (
    <div className="shell">
      <header className="topbar"><Link href="/sign-in">←</Link><strong>Reset password</strong><span /></header>
      <main className="main"><ResetPasswordPanel /></main>
    </div>
  );
}
