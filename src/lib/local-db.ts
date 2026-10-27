export type LocalRole = "admin" | "teacher" | "student";

export interface LocalUser {
  id: string;
  email: string;
  user_metadata: {
    display_name: string;
    email: string;
    role: LocalRole;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
}

interface StoredUser extends LocalUser {
  passwordHash: string;
}

const USERS_KEY = "skillbridge_local_users";
const SESSION_KEY = "skillbridge_local_session";
const ALL_SESSION_KEYS = [
  "skillbridge_local_session",
  "skillbridge_local_auth_session",
  "sb-local-auth-token",
  "sb-csjygxumpnonfupobhih-auth-token",
];

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function hashPassword(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createLocalUser(params: {
  email: string;
  password: string;
  name?: string;
  role?: LocalRole;
}): Promise<{ user?: LocalUser; error?: string }> {
  const email = params.email.trim().toLowerCase();
  const users = readUsers();

  if (users.some((user) => user.email === email)) {
    return { error: "An account with this email already exists." };
  }

  const now = new Date().toISOString();
  const displayName = params.name?.trim() || email.split("@")[0] || "Learner";
  const user: LocalUser = {
    id: makeId(),
    email,
    user_metadata: {
      display_name: displayName,
      email,
      role: params.role ?? "student",
    },
    created_at: now,
    updated_at: now,
  };

  users.push({ ...user, passwordHash: await hashPassword(params.password) });
  writeUsers(users);
  setLocalSession(user);
  return { user };
}

export async function signInLocalUser(params: {
  email: string;
  password: string;
}): Promise<{ user?: LocalUser; error?: string }> {
  const email = params.email.trim().toLowerCase();
  const passwordHash = await hashPassword(params.password);
  const user = readUsers().find(
    (candidate) => candidate.email === email && candidate.passwordHash === passwordHash,
  );

  if (!user) return { error: "Invalid email or password." };

  const { passwordHash: _passwordHash, ...safeUser } = user;
  setLocalSession(safeUser);
  return { user: safeUser };
}

export function setLocalSession(user: LocalUser) {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  const role = user.user_metadata?.role || "student";
  const displayName = user.user_metadata?.display_name || user.email.split("@")[0] || "Learner";

  const sessionData = {
    access_token: `sb_token_${user.id}_${Date.now()}`,
    token_type: "bearer",
    expires_in: 86400 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
    refresh_token: `sb_ref_${user.id}_${Date.now()}`,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: now,
      phone: "",
      confirmed_at: now,
      last_sign_in_at: now,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        display_name: displayName,
        email: user.email,
        role,
        avatar_url: user.user_metadata?.avatar_url,
        sub: user.id,
      },
      identities: [],
      created_at: user.created_at || now,
      updated_at: user.updated_at || now,
      is_anonymous: false,
    },
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.setItem("skillbridge_local_auth_session", JSON.stringify(sessionData));
  localStorage.setItem("sb-local-auth-token", JSON.stringify(sessionData));
  localStorage.setItem("sb-csjygxumpnonfupobhih-auth-token", JSON.stringify(sessionData));

  try {
    document.cookie = `sb-local-auth-token=${encodeURIComponent(JSON.stringify(sessionData))}; path=/; max-age=2592000; SameSite=Lax`;
    document.cookie = `skillbridge_role=${role}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent("local_auth_changed"));
  window.dispatchEvent(new Event("storage"));
}

export function getLocalSession(): LocalUser | null {
  if (typeof window === "undefined") return null;

  const candidates: LocalUser[] = [];
  for (const key of ALL_SESSION_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed) continue;

      if (parsed.email && parsed.user_metadata?.role) {
        candidates.push(parsed as LocalUser);
        continue;
      }

      const u = parsed.user || (parsed.access_token ? parsed : null);
      if (!u || (!u.email && !u.id)) continue;
      const role = (u.user_metadata?.role as LocalRole) || "student";
      const displayName = u.user_metadata?.display_name || u.email?.split("@")[0] || "Learner";
      candidates.push({
        id: u.id || "00000000-0000-4000-a000-000000000001",
        email: u.email || "student@skillbridge.edu",
        user_metadata: {
          display_name: displayName,
          email: u.email || "student@skillbridge.edu",
          role,
          ...(typeof u.user_metadata?.avatar_url === "string"
            ? { avatar_url: u.user_metadata.avatar_url }
            : {}),
        },
        created_at: u.created_at || new Date().toISOString(),
        updated_at: u.updated_at || new Date().toISOString(),
      });
    } catch {
      // Ignore malformed session variants and continue checking the other keys.
    }
  }

  if (candidates.length === 0) return null;

  // Several auth adapters keep separate copies of the same session. Prefer the
  // first valid identity, but merge its avatar from any matching newer copy or
  // the local account record before handing it to React.
  const primary = candidates[0]!;
  const primaryEmail = primary.email.trim().toLowerCase();
  const matching = candidates.filter(
    (candidate) =>
      candidate.id === primary.id || candidate.email.trim().toLowerCase() === primaryEmail,
  );
  const storedUser = readUsers().find(
    (candidate) =>
      candidate.id === primary.id || candidate.email.trim().toLowerCase() === primaryEmail,
  );
  const avatar =
    matching.find((candidate) => candidate.user_metadata?.avatar_url)?.user_metadata.avatar_url ||
    storedUser?.user_metadata?.avatar_url ||
    primary.user_metadata?.avatar_url;

  const merged: LocalUser = {
    ...primary,
    user_metadata: {
      ...primary.user_metadata,
      ...(typeof avatar === "string" && avatar ? { avatar_url: avatar } : {}),
    },
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  } catch {
    // The user remains readable for this render even if storage is unavailable.
  }
  return merged;
}

export function clearLocalSession() {
  if (typeof window === "undefined") return;
  for (const key of ALL_SESSION_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  try {
    document.cookie = "sb-local-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "skillbridge_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("local_auth_changed"));
  window.dispatchEvent(new Event("storage"));
}

export function getLocalUserRole(user: LocalUser | null): LocalRole {
  if (!user) return "student";
  if (user.user_metadata?.role) return user.user_metadata.role;
  const email = (user.email || "").toLowerCase();
  if (
    email.includes("instructor") ||
    email.includes("teacher") ||
    email.includes("faculty") ||
    email.includes("teach")
  ) {
    return "teacher";
  }
  return "student";
}

export function updateLocalSessionProfile(params: {
  displayName?: string;
  avatarUrl?: string | null;
  email?: string;
}) {
  if (typeof window === "undefined") return;

  try {
    const current = getLocalSession();
    if (!current) return;
    if (params.email !== undefined) {
      current.email = params.email;
      current.user_metadata.email = params.email;
    }
    if (params.displayName !== undefined) current.user_metadata.display_name = params.displayName;
    if (params.avatarUrl !== undefined) {
      if (params.avatarUrl === null) delete current.user_metadata.avatar_url;
      else current.user_metadata.avatar_url = params.avatarUrl;
    }
    current.updated_at = new Date().toISOString();
    localStorage.setItem(SESSION_KEY, JSON.stringify(current));

    const users = readUsers();
    const existing = users.find((item) => item.id === current.id);
    if (existing) {
      existing.email = current.email;
      existing.user_metadata = { ...existing.user_metadata, ...current.user_metadata };
      if (params.avatarUrl === null) delete existing.user_metadata.avatar_url;
      existing.updated_at = current.updated_at;
      writeUsers(users);
    }

    for (const key of [
      "sb-local-auth-token",
      "sb-csjygxumpnonfupobhih-auth-token",
      "skillbridge_local_auth_session",
    ]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const session = JSON.parse(raw);
      if (session?.user?.id === current.id) {
        session.user.email = current.email;
        session.user.user_metadata = { ...session.user.user_metadata, ...current.user_metadata };
        if (params.avatarUrl === null) delete session.user.user_metadata.avatar_url;
        session.user.updated_at = current.updated_at;
        localStorage.setItem(key, JSON.stringify(session));
      }
    }
  } catch {
    // ignore local session sync failures
  }
  window.dispatchEvent(new CustomEvent("local_auth_changed"));
  window.dispatchEvent(new Event("storage"));
}
