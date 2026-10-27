import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { lmsDB } from "@/lib/lms-db.server";
import { supabaseAdmin } from "./client.server";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\\s+/i, "").trim();
    if (!token) {
      throw new Error("Unauthorized");
    }

    let userId: string | null = null;
    let claims: Record<string, unknown> = {};

    // Local LMS sessions are opaque, server-issued tokens. validateSession
    // must never treat an unverified JWT payload as an authenticated session.
    const validated = lmsDB.validateSession(token);
    if (validated) {
      userId = validated.user.id;
      claims = {
        sub: validated.user.id,
        email: validated.user.email,
        role: validated.roles.includes("admin")
          ? "admin"
          : validated.roles.includes("teacher") || validated.roles.includes("instructor")
            ? "teacher"
            : "student",
      };
    } else {
      // If this deployment uses Supabase Auth, ask Supabase to verify the token.
      // Do not decode claims locally and do not trust user_metadata for privileges.
      const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
      const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"];
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const authClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data, error } = await authClient.auth.getUser(token);
          if (!error && data.user) {
            userId = data.user.id;
            const role = data.user.app_metadata?.role;
            claims = {
              sub: data.user.id,
              email: data.user.email,
              role: role === "admin" || role === "teacher" || role === "instructor" ? role : "student",
            };
          }
        } catch {
          // Fail closed below when token verification is unavailable.
        }
      }
    }

    if (!userId) {
      throw new Error("Unauthorized");
    }

    return next({
      context: {
        supabase: supabaseAdmin,
        userId,
        claims,
      },
    });
  },
);
