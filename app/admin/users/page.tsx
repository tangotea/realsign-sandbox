import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import UserManagement, { type AdminUser } from "@/components/admin/UserManagement";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return <main className="main"><Link href="/sign-in">Sign in</Link></main>;

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!admin) return <main className="main"><h1>Access denied</h1></main>;

  const service = createAdminClient();
  if (!service) return <main className="main"><h1>Admin setup incomplete</h1><p>Server configuration is missing.</p></main>;

  const [{ data: authUserPage, error: usersError }, { data: profiles }, { data: providers }, { data: roles }, { data: identities }, { data: deaf }] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    service.from("profiles").select("id,display_name,first_name,last_name,created_at,account_state"),
    service.from("provider_profiles").select("user_id,status"),
    service.from("user_roles").select("user_id,role"),
    service.from("user_identity_verifications").select("user_id,state,storage_path"),
    service.from("user_deaf_verifications").select("user_id,state"),
  ]);

  if (usersError) return <main className="main"><h1>Unable to load users</h1><p>{usersError.message}</p></main>;
  const authUsers = authUserPage?.users || [];

  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const providerMap = new Map((providers || []).map((provider: any) => [provider.user_id, provider]));
  const roleMap = new Map<string, string[]>();
  for (const role of roles || []) roleMap.set(role.user_id, [...(roleMap.get(role.user_id) || []), role.role]);
  const deafMap = new Map((deaf || []).map((item: any) => [item.user_id, item.state]));
  const identityMap = new Map<string, { state: string; reviewUrl: string | null }>();
  await Promise.all((identities || []).map(async (item: any) => {
    const signed = item.storage_path
      ? (await service.storage.from("verification-documents").createSignedUrl(item.storage_path, 600)).data?.signedUrl || null
      : null;
    identityMap.set(item.user_id, { state: item.state || "not_submitted", reviewUrl: signed });
  }));

  const users: AdminUser[] = (authUsers || []).map((user: any) => {
    const profile = profileMap.get(user.id);
    const provider = providerMap.get(user.id);
    const identity = identityMap.get(user.id);
    const name = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.user_metadata?.display_name || "Unnamed user";
    return {
      id: user.id,
      name,
      email: user.email || "",
      createdAt: profile?.created_at || user.created_at,
      accountState: profile?.account_state || "active",
      roles: roleMap.get(user.id) || [],
      identityState: identity?.state || "not_submitted",
      deafState: deafMap.get(user.id) || "not_submitted",
      reviewUrl: identity?.reviewUrl || null,
      isProvider: Boolean(provider) || (roleMap.get(user.id) || []).includes("provider"),
      providerStatus: provider?.status || null,
    };
  });

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">REALSIGN ADMIN</div>
        <nav>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/providers">Providers</Link>
        </nav>
      </aside>
      <main className="admin-main">
        <h1>Users &amp; identity</h1>
        <p className="muted">Search accounts, review identity status, and manage account access. Archive keeps history; block prevents access and future signup with the same email.</p>
        <UserManagement users={users} currentUserId={auth.user.id} />
      </main>
    </div>
  );
}
