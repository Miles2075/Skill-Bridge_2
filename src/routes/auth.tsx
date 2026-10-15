import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearLocalSession } from "@/lib/local-db";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | Skillbridge" },
      {
        name: "description",
        content: "Sign in or create a Skillbridge account with email and password.",
      },
      { property: "og:title", content: "Sign in | Skillbridge" },
      { property: "og:description", content: "Join Skillbridge to buy courses or teach your own." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const routeForRole = (value: unknown) =>
      value === "teacher" || value === "admin" ? "/teach" : "/";

    const restoreSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session?.access_token) {
          if (!cancelled) setCheckingSession(false);
          return;
        }

        // Supabase JWTs are already managed and refreshed by the Supabase client.
        // The built-in LMS adapter uses server-issued tokens, which we validate
        // against the persisted backend session before auto-signing the user in.
        if (session.access_token.split(".").length === 3) {
          if (!cancelled) {
            window.location.replace(routeForRole(session.user?.user_metadata?.role));
          }
          return;
        }

        const response = await fetch("/api/lms/auth/session", {
          method: "GET",
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));

        if (cancelled) return;
        if (response.ok && result?.user) {
          const role = Array.isArray(result.roles) ? result.roles[0] : result.user.user_metadata?.role;
          window.location.replace(routeForRole(role));
          return;
        }
        if (response.ok && !result?.user) {
          // Remove old fake/expired sessions left by previous versions. They
          // must not be treated as a valid login.
          clearLocalSession();
        }
      } catch {
        // A temporary network issue should not erase a saved session.
        const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (data?.session && !cancelled) {
          window.location.replace(routeForRole(data.session.user?.user_metadata?.role));
          return;
        }
      }

      if (!cancelled) setCheckingSession(false);
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    const cleanEmail = email.trim().toLowerCase();

    const getRedirectRoute = (targetRole: string) =>
      targetRole === "teacher" || targetRole === "admin" ? "/teach" : "/";

    try {
      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setMsg(error.message || "Sign-in failed. Check your email and password.");
          return;
        }
        if (!data?.session) {
          setMsg("Sign-in did not return a valid session. Please try again.");
          return;
        }

        const userMetaRole = (data.session.user.user_metadata?.role as string) || "student";
        window.location.replace(getRedirectRoute(userMetaRole));
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: name.trim() || cleanEmail.split("@")[0], role },
          },
        });

        if (error) {
          setMsg(error.message || "Registration failed. Please try again.");
          return;
        }
        if (!data?.session) {
          setMsg("Registration did not return a valid session. Please try again.");
          return;
        }

        window.location.replace(getRedirectRoute(role));
        return;
      }
    } catch (err: unknown) {
      console.error("Auth submit error:", err);
      setMsg(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Restoring your saved Skillbridge session…</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded bg-primary font-extrabold text-primary-foreground">
            S
          </span>
          <span className="text-lg font-extrabold tracking-tight">skillbridge</span>
        </Link>
        <h1 className="text-xl font-extrabold">
          {mode === "in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "in"
            ? "Sign in directly with your email and password."
            : "Sign up as a student or teacher to get started."}
        </p>
        <div className="mt-5 space-y-3">
          {mode === "up" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["student", "teacher"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold capitalize cursor-pointer transition-colors ${role === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}
                  >
                    I'm a {r}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </>
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Password (min 6 characters)"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
        </div>

        {msg && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <AlertCircle className="size-4 shrink-0 text-destructive" />
            <span>{msg}</span>
          </div>
        )}

        <Button type="submit" variant="chrome" className="mt-5 w-full" disabled={busy}>
          {busy ? "Signing in…" : mode === "in" ? "Sign in" : "Sign up"}
        </Button>
        <button
          type="button"
          className="mt-4 w-full text-sm text-primary hover:underline cursor-pointer"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setMsg("");
          }}
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-center text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
            Instant Demo Access
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                establishDirectSession({
                  id: "00000000-0000-4000-a000-000000000001",
                  email: "student@skillbridge.edu",
                  name: "Alex Learner",
                  role: "student",
                });
                window.location.href = "/";
              }}
            >
              🎓 Demo Student
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                establishDirectSession({
                  id: "8d95e694-3d47-422e-a017-86a1a0ee1251",
                  email: "instructor@skillbridge.edu",
                  name: "Sarah Chen",
                  role: "teacher",
                });
                window.location.href = "/teach";
              }}
            >
              👨‍🏫 Demo Instructor
            </Button>
          </div>
          <div className="mt-3 text-center text-[11px] text-muted-foreground space-y-0.5">
            <div>
              Student:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                student@skillbridge.edu
              </code>{" "}
              / <code className="rounded bg-muted px-1 py-0.5 text-[10px]">password123</code>
            </div>
            <div>
              Instructor:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                instructor@skillbridge.edu
              </code>{" "}
              / <code className="rounded bg-muted px-1 py-0.5 text-[10px]">password123</code>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
