import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminNavigation from "@/components/admin/AdminNavigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return <main className="main"><h1>Admin unavailable</h1><p>Admin configuration is incomplete.</p></main>;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return <main className="main"><h1>Admin sign in</h1><Link className="btn" href="/sign-in?next=%2Fadmin">Sign in</Link></main>;
  const { data: admin } = await supabase.from("admin_profiles").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
  if (!admin) return <main className="main"><h1>Access denied</h1><Link href="/">Return to RealSign</Link></main>;
  return <div className="admin-workspace"><AdminNavigation />{children}</div>;
}

