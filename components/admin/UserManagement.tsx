"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AccountState = "active" | "archived" | "blocked";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  accountState: AccountState;
  roles: string[];
  identityState: string;
  deafState: string;
  reviewUrl: string | null;
  isProvider: boolean;
  providerStatus: string | null;
};

const tabs = [
  ["all", "All users"],
  ["learner", "Learners"],
  ["provider", "Providers"],
  ["archived", "Archived"],
  ["blocked", "Blocked"],
] as const;

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default function UserManagement({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !query || [user.name, user.email, user.id].some((value) => value.toLowerCase().includes(query));
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "learner" && user.roles.includes("learner") && user.accountState === "active") ||
        (activeTab === "provider" && user.isProvider && user.accountState === "active") ||
        (activeTab === "archived" && user.accountState === "archived") ||
        (activeTab === "blocked" && user.accountState === "blocked");
      return matchesSearch && matchesTab;
    });
  }, [activeTab, search, users]);

  async function runAction(action: "archive" | "restore" | "block" | "unblock" | "delete", user: AdminUser) {
    const prompts = {
      archive: `Archive ${user.name}? Their history will be kept, but they will no longer appear as an active account.`,
      restore: `Restore ${user.name} and make the account active again?`,
      block: `Block ${user.name}? They will be unable to use this account and this email cannot be used to register again.`,
      unblock: `Unblock ${user.name} and allow the account to sign in again?`,
      delete: `You are about to remove ${user.name} from the system. Are you sure you want to do that? Removing a user from the system does not prevent them from registering later again.`,
    } as const;
    if (!window.confirm(prompts[action])) return;

    setBusyId(user.id);
    setMessage(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId: user.id }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage({ text: result.error || "The account action could not be completed.", kind: "error" });
      return;
    }
    setMessage({ text: action === "delete" ? "User removed." : `User ${action}d.`, kind: "success" });
    router.refresh();
  }

  return (
    <>
      <section className="admin-user-controls" aria-label="User filters">
        <label className="admin-search">
          <span>Search users</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or user ID" />
        </label>
        <div className="admin-tabs" role="tablist" aria-label="User groups">
          {tabs.map(([value, text]) => (
            <button key={value} className={activeTab === value ? "admin-tab active" : "admin-tab"} onClick={() => setActiveTab(value)} role="tab" aria-selected={activeTab === value}>
              {text}
            </button>
          ))}
        </div>
      </section>
      {message ? <p className={`inline-feedback ${message.kind}`} aria-live="polite">{message.text}</p> : null}
      <p className="muted admin-result-count">Showing {visibleUsers.length} of {users.length} loaded users.</p>
      <div className="admin-table user-management-table">
        {visibleUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const busy = busyId === user.id;
          return (
            <article className="admin-row admin-user-row" key={user.id}>
              <div className="admin-user-summary">
                <div className="row wrap compact-gap">
                  <strong>{user.name}</strong>
                  <span className={`status ${user.accountState}`}>{label(user.accountState)}</span>
                  {user.isProvider ? <span className="status">Provider</span> : <span className="status">Learner</span>}
                </div>
                <small>{user.email || "No email address"}</small>
                <small>{user.id}</small>
                <small>Joined {new Date(user.createdAt).toLocaleDateString()}</small>
              </div>
              <div className="admin-user-review">
                <span className="status">ID: {label(user.identityState || "not started")}</span>
                {user.deafState !== "not_submitted" ? <span className="status">Deaf verification: {label(user.deafState)}</span> : null}
                {user.providerStatus ? <span className="status">Provider: {label(user.providerStatus)}</span> : null}
                {user.reviewUrl ? <a className="mini-btn" href={user.reviewUrl} target="_blank" rel="noreferrer">Open ID document</a> : null}
              </div>
              <div className="admin-user-actions">
                {isSelf ? <small className="muted">Your account</small> : null}
                {!isSelf && user.accountState === "active" ? <button className="mini-btn" disabled={busy} onClick={() => runAction("archive", user)}>Archive</button> : null}
                {!isSelf && user.accountState === "archived" ? <button className="mini-btn" disabled={busy} onClick={() => runAction("restore", user)}>Restore</button> : null}
                {!isSelf && user.accountState !== "blocked" ? <button className="mini-btn" disabled={busy} onClick={() => runAction("block", user)}>Block</button> : null}
                {!isSelf && user.accountState === "blocked" ? <button className="mini-btn" disabled={busy} onClick={() => runAction("unblock", user)}>Unblock</button> : null}
                {!isSelf ? <button className="mini-btn danger" disabled={busy} onClick={() => runAction("delete", user)}>Remove permanently</button> : null}
              </div>
            </article>
          );
        })}
        {!visibleUsers.length ? <p className="admin-empty">No users match this search or group.</p> : null}
      </div>
    </>
  );
}
