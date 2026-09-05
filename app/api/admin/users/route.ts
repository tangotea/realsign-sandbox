import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AccountAction = "archive" | "restore" | "block" | "unblock" | "delete";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };

  const { data: admin } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };

  const service = createAdminClient();
  if (!service) return { error: NextResponse.json({ error: "Server not configured" }, { status: 500 }) };
  return { actor: auth.user, service };
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const { actor, service } = access;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "") as AccountAction;
  const userId = String(body.userId || "");
  const reason = String(body.reason || "Admin account management action").trim().slice(0, 500);

  if (!["archive", "restore", "block", "unblock", "delete"].includes(action)) {
    return NextResponse.json({ error: "Unknown account action" }, { status: 400 });
  }
  if (!isUuid(userId)) return NextResponse.json({ error: "Valid user ID required" }, { status: 400 });
  if (action !== "archive" && userId === actor.id) {
    return NextResponse.json({ error: "You cannot block, unblock or remove your own admin account here" }, { status: 400 });
  }

  const { data: target, error: targetError } = await service
    .from("profiles")
    .select("id,account_state")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "User was not found" }, { status: 404 });

  const { data: authTarget, error: authTargetError } = await service.auth.admin.getUserById(userId);
  if (authTargetError || !authTarget.user) {
    return NextResponse.json({ error: authTargetError?.message || "User was not found" }, { status: 404 });
  }

  if (action === "delete") {
    const { data: targetAdmin } = await service
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (targetAdmin) {
      const { count } = await service.from("admin_profiles").select("user_id", { count: "exact", head: true }).eq("is_active", true);
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "The last active admin account cannot be removed" }, { status: 409 });
      }
    }

    await service.from("audit_log").insert({
      actor_user_id: actor.id,
      action: "user_deleted",
      entity_type: "user",
      entity_id: userId,
      before_data: { email: authTarget.user.email || null, account_state: target.account_state },
      reason,
    });

    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json(
        { error: "This user cannot be removed because account history still references it. Archive or block the account instead." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, action });
  }

  if (action === "archive" || action === "restore") {
    const nextState = action === "archive" ? "archived" : "active";
    const { error } = await service
      .from("profiles")
      .update({
        account_state: nextState,
        archived_at: action === "archive" ? new Date().toISOString() : null,
        account_state_reason: reason,
      })
      .eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await service.from("audit_log").insert({
      actor_user_id: actor.id,
      action: action === "archive" ? "user_archived" : "user_restored",
      entity_type: "user",
      entity_id: userId,
      after_data: { account_state: nextState },
      reason,
    });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "block") {
    const email = normalizeEmail(authTarget.user.email || "");
    if (!email) return NextResponse.json({ error: "This account has no email address to block" }, { status: 409 });

    const { error: blockError } = await service.from("account_blocks").insert({
      user_id: userId,
      email_normalized: email,
      reason,
      created_by: actor.id,
    });
    if (blockError) {
      if (blockError.code === "23505") return NextResponse.json({ error: "This account is already blocked" }, { status: 409 });
      return NextResponse.json({ error: blockError.message }, { status: 500 });
    }

    const { error: profileError } = await service
      .from("profiles")
      .update({
        account_state: "blocked",
        blocked_at: new Date().toISOString(),
        blocked_by: actor.id,
        account_state_reason: reason,
      })
      .eq("id", userId);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    const { error: banError } = await service.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });
    await service.from("audit_log").insert({
      actor_user_id: actor.id,
      action: "user_blocked",
      entity_type: "user",
      entity_id: userId,
      after_data: { account_state: "blocked", email_blocked: true },
      reason,
    });
    return NextResponse.json({ ok: true, action });
  }

  const { error: unbanError } = await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (unbanError) return NextResponse.json({ error: unbanError.message }, { status: 500 });
  const { error: restoreError } = await service
    .from("profiles")
    .update({ account_state: "active", blocked_at: null, blocked_by: null, account_state_reason: reason })
    .eq("id", userId);
  if (restoreError) return NextResponse.json({ error: restoreError.message }, { status: 500 });
  const { error: blockLiftError } = await service
    .from("account_blocks")
    .update({ lifted_at: new Date().toISOString(), lifted_by: actor.id })
    .eq("user_id", userId)
    .is("lifted_at", null);
  if (blockLiftError) return NextResponse.json({ error: blockLiftError.message }, { status: 500 });
  await service.from("audit_log").insert({
    actor_user_id: actor.id,
    action: "user_unblocked",
    entity_type: "user",
    entity_id: userId,
    after_data: { account_state: "active", email_blocked: false },
    reason,
  });
  return NextResponse.json({ ok: true, action });
}
