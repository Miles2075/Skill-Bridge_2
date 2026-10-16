import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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
  const [mode, setMode] = useState<"in" | "up" | "forgot" | "reset">(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "reset") {
      return "reset";
    }
    return "in";
  });
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // A reset link must remain on this screen even if this browser has an
    // unrelated saved session from an earlier sign-in.
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("mode") === "reset" || searchParams.has("token")) {
      setCheckingSession(false);
      return () => {
        cancelled = true;
      };
    }

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
    setMsgKind("error");

    const cleanEmail = email.trim().toLowerCase();

    const getRedirectRoute = (targetRole: string) =>
      targetRole === "teacher" || targetRole === "admin" ? "/teach" : "/";

    try {
      if (mode === "forgot") {
        if (!cleanEmail) {
          setMsg("Enter the email address for your account.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) {
          setMsg(error.message || "Could not send a password reset email. Please try again.");
          return;
        }
        setMsgKind("success");
        setMsg("If an account exists for that email, password reset instructions have been sent. Check your inbox and spam folder.");
        return;
      }

      if (mode === "reset") {
        if (password.length < 8) {
          setMsg("Your new password must be at least 8 characters long.");
          return;
        }
        if (password !== confirmPassword) {
          setMsg("The passwords do not match.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setMsg(error.message || "Could not update your password. Request a new reset link if necessary.");
          return;
        }
        setMsgKind("success");
        setMsg("Your password has been reset. You can now sign in with your new password.");
        setPassword("");
        setConfirmPassword("");
        setMode("in");
        return;
      }

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

  const signInDemo = async (email: string) => {
    setBusy(true);
    setMsg("");
    setMsgKind("error");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: "password123",
      });
      if (error || !data?.session) {
        setMsg(error?.message || "This demo account is not available. Please use Sign up or your own account.");
        return;
      }
      const targetRole = data.session.user.user_metadata?.role as string;
      window.location.replace(targetRole === "teacher" || targetRole === "admin" ? "/teach" : "/");
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Could not sign in to the demo account.");
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
          {mode === "in"
            ? "Welcome back"
            : mode === "up"
              ? "Create your account"
              : mode === "forgot"
                ? "Reset your password"
                : "Choose a new password"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "in"
            ? "Sign in directly with your email and password."
            : mode === "up"
              ? "Sign up as a student or teacher to get started."
              : mode === "forgot"
                ? "Enter your account email and we’ll send you a reset link."
                : "Choose a new password with at least 8 characters."}
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
          {mode !== "reset" && (
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          )}
          {(mode === "in" || mode === "up" || mode === "reset") && (
            <Input
              type="password"
              placeholder={mode === "reset" ? "New password (min 8 characters)" : "Password (min 6 characters)"}
              minLength={mode === "reset" ? 8 : 6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
          )}
          {mode === "reset" && (
            <Input
              type="password"
              placeholder="Confirm new password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          )}
          {mode === "in" && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                onClick={() => {
                  setMsg("");
                  setMsgKind("error");
                  setMode("forgot");
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
        </div>

        {msg && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-md border p-3 text-xs font-medium ${msgKind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
          >
            {msgKind === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{msg}</span>
          </div>
        )}

        <Button type="submit" variant="chrome" className="mt-5 w-full" disabled={busy}>
          {busy
            ? mode === "forgot"
              ? "Sending reset link…"
              : mode === "reset"
                ? "Updating password…"
                : mode === "up"
                  ? "Creating account…"
                  : "Signing in…"
            : mode === "in"
              ? "Sign in"
              : mode === "up"
                ? "Sign up"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Update password"}
        </Button>
        {mode === "in" || mode === "up" ? (
          <button
            type="button"
            className="mt-4 w-full text-sm text-primary hover:underline cursor-pointer"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setMsg("");
              setMsgKind("error");
            }}
          >
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        ) : (
          <button
            type="button"
            className="mt-4 w-full text-sm text-primary hover:underline cursor-pointer"
            onClick={() => {
              setMode("in");
              setMsg("");
              setMsgKind("error");
              setPassword("");
              setConfirmPassword("");
            }}
          >
            Back to sign in
          </button>
        )}

        {(mode === "in" || mode === "up") && (
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
              onClick={() => void signInDemo("student@skillbridge.edu")}
            >
              🎓 Demo Student
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => void signInDemo("instructor@skillbridge.edu")}
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
        )}
      </form>
    </div>
  );
}
