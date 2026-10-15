import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import nodePath from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { lmsDB } from "./lms-db.server";

interface UserContext {
  userId: string | null;
  email: string | null;
  name: string | null;
  role: "student" | "teacher" | "admin";
  isAdmin: boolean;
  isTeacher: boolean;
}

async function parseUserContext(req: Request): Promise<UserContext> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Validate signed-in SkillBridge demo/local sessions before the hosted Supabase
  // branch. Demo instructor accounts use server-issued LMS sessions, not Supabase JWTs.
  if (token) {
    const localSession = lmsDB.validateSession(token);
    if (localSession) {
      const role = localSession.roles.includes("admin")
        ? "admin"
        : localSession.roles.includes("teacher")
          ? "teacher"
          : "student";
      return {
        userId: localSession.user.id,
        email: localSession.user.email ?? null,
        name: String(
          localSession.user.user_metadata?.display_name ||
            localSession.user.email?.split("@")[0] ||
            "Instructor",
        ),
        role,
        isAdmin: role === "admin",
        isTeacher: role === "teacher" || role === "admin",
      };
    }
  }

  // Hosted requests must present a token verified by Supabase. Client-supplied
  // x-user-* headers are not an authentication mechanism.
  const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"];
  if (supabaseUrl && supabaseAnonKey) {
    if (!token) {
      return { userId: null, email: null, name: null, role: "student", isAdmin: false, isTeacher: false };
    }
    try {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      const authUser = data.user;
      if (error || !authUser) {
        return { userId: null, email: null, name: null, role: "student", isAdmin: false, isTeacher: false };
      }
      // Privileged roles must be set in app_metadata by a trusted administrator.
      const roleValue = authUser.app_metadata?.role;
      const role = roleValue === "admin" ? "admin" : roleValue === "teacher" ? "teacher" : "student";
      const displayName = String(authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Learner");
      if (authUser.email) lmsDB.syncExternalUser({ id: authUser.id, email: authUser.email, name: displayName, role });
      return {
        userId: authUser.id,
        email: authUser.email ?? null,
        name: displayName,
        role,
        isAdmin: role === "admin",
        isTeacher: role === "teacher" || role === "admin",
      };
    } catch (error) {
      console.error("Supabase token verification failed:", error);
      return { userId: null, email: null, name: null, role: "student", isAdmin: false, isTeacher: false };
    }
  }

  let userId = req.headers.get("x-user-id");
  let email = req.headers.get("x-user-email");
  let name = req.headers.get("x-user-name");
  let roleStr = req.headers.get("x-user-role");

  // Also check cookie header as fallback for local LMS roles
  const cookieHeader = req.headers.get("cookie") || "";
  if (!roleStr && cookieHeader) {
    const roleMatch = cookieHeader.match(/(?:^|;\s*)skillbridge_role=([^;]+)/);
    if (roleMatch && roleMatch[1]) {
      roleStr = decodeURIComponent(roleMatch[1]);
    }
  }

  if (token) {
    const validated = lmsDB.validateSession(token);
    if (validated) {
      userId = validated.user.id;
      email = validated.user.email ?? null;
      name = String(
        (validated.user.user_metadata?.display_name as string) ||
          (validated.user.email ?? "").split("@")[0],
      );
      const primaryRole = validated.roles.includes("admin")
        ? "admin"
        : validated.roles.includes("teacher")
          ? "teacher"
          : "student";
      roleStr = primaryRole;
    } else if (token.split(".").length === 3) {
      try {
        const payloadStr = Buffer.from(token.split(".")[1]!, "base64url").toString("utf-8");
        const payload = JSON.parse(payloadStr);
        if (payload.sub && !userId) userId = payload.sub;
        if (payload.email && !email) email = payload.email;
        if (payload.user_metadata?.display_name && !name) name = payload.user_metadata.display_name;
        if (payload.user_metadata?.role && !roleStr) roleStr = payload.user_metadata.role;
      } catch {
        // ignore
      }
    }
  }

  const role = (
    roleStr === "teacher" || roleStr === "instructor" || roleStr === "admin"
      ? roleStr === "instructor"
        ? "teacher"
        : roleStr
      : "student"
  ) as "student" | "teacher" | "admin";
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher" || isAdmin;

  return {
    userId,
    email,
    name,
    role,
    isAdmin,
    isTeacher,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function getRazorpayServerCredentials() {
  let keyId = (process.env["RAZORPAY_KEY_ID"] || process.env["VITE_RAZORPAY_KEY_ID"] || "").trim();
  let keySecret = (process.env["RAZORPAY_KEY_SECRET"] || "").trim();

  // Dynamically check .env file so live updates are recognized immediately
  try {
    const envPath = nodePath.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m && m[1]) {
          const k = m[1].trim();
          const v = (m[2] || "").trim().replace(/^['"]|['"]$/g, "");
          if (k === "RAZORPAY_KEY_ID" && v) keyId = v;
          if (k === "RAZORPAY_KEY_SECRET" && v) keySecret = v;
          if (k === "VITE_RAZORPAY_KEY_ID" && v && !keyId) keyId = v;
        }
      }
    }
  } catch {
    // ignore
  }

  // Handle accidental key swapping in environment
  if (!keyId.startsWith("rzp_") && keySecret.startsWith("rzp_")) {
    const temp = keyId;
    keyId = keySecret;
    keySecret = temp;
  }

  // Never ship fallback payment credentials. Configure secrets in the server environment.
  return { keyId, keySecret };
}

async function callRazorpayApi(endpoint: string, init: RequestInit = {}) {
  const { keyId, keySecret } = getRazorpayServerCredentials();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
    ...init,
    headers,
  });

  const body = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(body);
  } catch {
    data = { error: { description: body } };
  }

  if (!response.ok) {
    const errObj = data["error"] as { description?: string } | undefined;
    throw new Error(errObj?.description || `Razorpay request failed (${response.status})`);
  }

  return data;
}

async function handleLmsApiRequestWithLocalStore(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/lms")) {
    return null;
  }

  const path = url.pathname.replace(/^\/api\/lms\/?/, "");
  const method = req.method.toUpperCase();

  // Vercel Blob client uploads exchange a small token request with this route;
  // the video bytes themselves go directly from the browser to Blob, avoiding
  // Vercel Functions' 4.5 MB request-body limit.
  if (path === "upload-thumbnail-token" && method === "POST") {
    const blobToken = process.env["BLOB_READ_WRITE_TOKEN"] || process.env["SKILLBRIDGE_READ_WRITE_TOKEN"];
    if (!blobToken) return errorResponse("Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.", 503);

    let body: HandleUploadBody;
    try {
      body = await req.json() as HandleUploadBody;
    } catch {
      return errorResponse("Invalid Blob upload token request.", 400);
    }

    try {
      const result = await handleUpload({
        body,
        request: req,
        token: blobToken,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          let payload: { courseId?: unknown; originalName?: unknown; authToken?: unknown };
          try {
            payload = JSON.parse(clientPayload || "{}");
          } catch {
            throw new Error("Invalid thumbnail upload metadata.");
          }

          const courseId = typeof payload.courseId === "string" ? payload.courseId : "";
          const originalName = typeof payload.originalName === "string" ? payload.originalName : "";
          const authToken = typeof payload.authToken === "string" ? payload.authToken : "";
          if (!courseId || !originalName || !authToken) throw new Error("Sign in again before uploading a thumbnail.");

          const authHeaders = new Headers(req.headers);
          authHeaders.set("authorization", `Bearer ${authToken}`);
          const authRequest = new Request(req.url, { method: "GET", headers: authHeaders });
          const uploadUser = await parseUserContext(authRequest);
          if (!uploadUser.isTeacher || !uploadUser.userId) throw new Error("Forbidden: Instructor role required.");

          const course = lmsDB.getCourse(courseId);
          if (!course) throw new Error("Course not found.");

          const segments = pathname.split("/");
          if (segments.length !== 4 || segments[0] !== "courses" || segments[1] !== courseId || segments[2] !== "thumbnails" || segments[3].includes("..")) {
            throw new Error("Invalid thumbnail upload path.");
          }
          const extension = segments[3].slice(segments[3].lastIndexOf(".")).toLowerCase();
          const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
          if (!allowedExtensions.has(extension)) throw new Error("Unsupported image format. Use JPG, PNG, WebP, AVIF, or GIF.");

          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
            maximumSizeInBytes: 10 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({
              courseId,
              originalName,
              userId: uploadUser.userId,
            }),
          };
        },
        onUploadCompleted: async () => {
          // The client persists the resulting public URL as the course thumbnail.
        },
      });
      return jsonResponse(result);
    } catch (error) {
      console.error("Vercel Blob thumbnail upload token error:", error);
      return errorResponse(error instanceof Error ? error.message : "Could not prepare thumbnail upload.", 400);
    }
  }

  if (path === "upload-video-token" && method === "POST") {
    const blobToken = process.env["BLOB_READ_WRITE_TOKEN"] || process.env["SKILLBRIDGE_READ_WRITE_TOKEN"];
    if (!blobToken) return errorResponse("Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel.", 503);

    let body: HandleUploadBody;
    try {
      body = await req.json() as HandleUploadBody;
    } catch {
      return errorResponse("Invalid Blob upload token request.", 400);
    }

    try {
      const result = await handleUpload({
        body,
        request: req,
        token: blobToken,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          let payload: { courseId?: unknown; lessonId?: unknown; originalName?: unknown; authToken?: unknown };
          try {
            payload = JSON.parse(clientPayload || "{}");
          } catch {
            throw new Error("Invalid video upload metadata.");
          }

          const courseId = typeof payload.courseId === "string" ? payload.courseId : "";
          const lessonId = typeof payload.lessonId === "string" && payload.lessonId ? payload.lessonId : null;
          const originalName = typeof payload.originalName === "string" ? payload.originalName : "";
          const authToken = typeof payload.authToken === "string" ? payload.authToken : "";
          if (!courseId || !originalName || !authToken) throw new Error("Sign in again before uploading a video.");

          const authHeaders = new Headers(req.headers);
          authHeaders.set("authorization", `Bearer ${authToken}`);
          const authRequest = new Request(req.url, { method: "GET", headers: authHeaders });
          const uploadUser = await parseUserContext(authRequest);
          if (!uploadUser.isTeacher || !uploadUser.userId) throw new Error("Forbidden: Instructor role required.");

          const course = lmsDB.getCourse(courseId);
          if (!course) throw new Error("Course not found.");

          const segments = pathname.split("/");
          if (segments.length !== 4 || segments[0] !== "courses" || segments[1] !== courseId || segments[2] !== "videos" || segments[3].includes("..")) {
            throw new Error("Invalid video upload path.");
          }
          const extension = segments[3].slice(segments[3].lastIndexOf(".")).toLowerCase();
          const allowedExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
          if (!allowedExtensions.has(extension)) throw new Error("Unsupported video format. Use MP4, WebM, MOV, or M4V.");

          if (lessonId) {
            const snapshot = lmsDB.exportSnapshot();
            const lesson = snapshot.lessons.find((item) => item.id === lessonId && (item.course_id === course.id || item.course_id === course.slug));
            if (!lesson) throw new Error("Lesson not found for this course.");
          }

          return {
            allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "application/octet-stream"],
            maximumSizeInBytes: 500 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({
              courseId,
              lessonId,
              originalName,
              userId: uploadUser.userId,
            }),
          };
        },
        onUploadCompleted: async () => {
          // The browser registers the returned Blob URL through the authenticated
          // register-video endpoint after upload succeeds.
        },
      });
      return jsonResponse(result);
    } catch (error) {
      console.error("Vercel Blob client upload token error:", error);
      return errorResponse(error instanceof Error ? error.message : "Could not prepare video upload.", 400);
    }
  }

  const user = await parseUserContext(req);

  try {
    // AUTH: POST /api/lms/auth/login
    if (path === "auth/login" && method === "POST") {
      const body = await req.json();
      const { email, password } = body;
      if (!email || !password) return errorResponse("Email and password are required");

      const res = lmsDB.authenticateUser(email, password);
      if (!res) {
        return errorResponse("Invalid login credentials", 400);
      }
      return jsonResponse({
        user: res.user,
        session: res.session,
        roles: res.roles,
      });
    }

    // AUTH: POST /api/lms/auth/signup
    if (path === "auth/signup" && method === "POST") {
      const body = await req.json();
      const { email, password, metadata } = body;
      if (!email || !password) return errorResponse("Email and password are required");

      const cleanEmail = email.trim().toLowerCase();
      if (lmsDB.findUserByEmail(cleanEmail)) {
        const authed = lmsDB.authenticateUser(cleanEmail, password);
        if (authed) {
          return jsonResponse({
            user: authed.user,
            session: authed.session,
            roles: authed.roles,
          });
        }
      }

      const res = lmsDB.registerUser({
        email: cleanEmail,
        password,
        name: metadata?.display_name || metadata?.name,
        role: metadata?.role,
      });
      return jsonResponse({
        user: res.user,
        session: res.session,
        roles: res.roles,
      });
    }

    // AUTH: GET /api/lms/profile
    if (path === "profile" && method === "GET") {
      if (!user.userId) return errorResponse("Unauthorized", 401);
      const profileUser = lmsDB.findUserById(user.userId);
      if (!profileUser) return errorResponse("User not found.", 404);
      return jsonResponse({
        user: {
          id: profileUser.id,
          email: profileUser.email,
          user_metadata: profileUser.user_metadata,
          created_at: profileUser.created_at,
          updated_at: profileUser.updated_at,
        },
      });
    }

    // AUTH: PATCH /api/lms/profile
    if (path === "profile" && method === "PATCH") {
      if (!user.userId) return errorResponse("Unauthorized", 401);
      const body = await req.json();
      const displayName = body.displayName === undefined ? undefined : String(body.displayName);
      const avatarUrl =
        body.avatarUrl === undefined
          ? undefined
          : body.avatarUrl === null
            ? null
            : String(body.avatarUrl);
      if (displayName !== undefined && !displayName.trim())
        return errorResponse("Display name cannot be empty.");
      try {
        const updated = lmsDB.updateUserProfile(user.userId, { displayName, avatarUrl });
        if (!updated) return errorResponse("User not found.", 404);
        return jsonResponse({ user: updated });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : "Unable to update profile.");
      }
    }

    // AUTH: POST /api/lms/auth/logout
    if (path === "auth/logout" && method === "POST") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (token) lmsDB.logoutUser(token);
      return jsonResponse({ success: true });
    }

    // AUTH: GET /api/lms/auth/session
    if (path === "auth/session" && method === "GET") {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      const validated = token ? lmsDB.validateSession(token) : null;
      if (!validated) {
        return jsonResponse({ user: null, session: null, roles: [] });
      }
      return jsonResponse({
        user: validated.user,
        session: validated.session,
        roles: validated.roles,
      });
    }

    // AUTH: GET /api/lms/auth/roles
    if (path === "auth/roles" && method === "GET") {
      const roles = user.userId ? lmsDB.getUserRoles(user.userId) : [];
      return jsonResponse({ roles });
    }

    // GENERIC QUERY: POST /api/lms/query
    if (path === "query" && method === "POST") {
      const body = await req.json();
      const tableName = typeof body.table === "string" ? body.table.toLowerCase() : "";
      const action = typeof body.action === "string" ? body.action.toLowerCase() : "";

      // Enrollments and payment records must only be changed by the dedicated,
      // validated LMS endpoints. Otherwise the generic data adapter could bypass
      // the payment verification performed during checkout.
      if (tableName === "course_reviews") {
        return errorResponse("Use the course review endpoint to read or write sanitized review data.", 403);
      }
      if (["enrollments", "purchases"].includes(tableName) && action !== "select") {
        return errorResponse("Enrollment and purchase records can only be changed through validated LMS endpoints.", 403);
      }

      if (tableName === "purchases") {
        if (!user.userId) return errorResponse("Please sign in to view purchases.", 401);
        body.filters = { ...(body.filters || {}), user_id: user.userId };
      }
      if (tableName === "enrollments" && !user.isTeacher && !user.isAdmin) {
        if (!user.userId) return errorResponse("Please sign in to view enrollments.", 401);
        body.filters = { ...(body.filters || {}), student_id: user.userId };
      }

      const result = lmsDB.queryTable(body.table, body);
      return jsonResponse(result);
    }

    // PAYMENTS: GET /api/lms/payments/config (or /payment/config)
    if ((path === "payments/config" || path === "payment/config") && method === "GET") {
      const { keyId } = getRazorpayServerCredentials();
      return jsonResponse({ keyId });
    }

    // Paid checkout is handled by the authenticated order and payment verification
    // endpoints below. Do not keep legacy create-order/verify handlers here: they returned
    // incompatible responses and allowed enrollment before confirming a captured payment.

    // PAYMENTS: GET /api/lms/payments/purchases (or /payment/purchases)
    // Purchase history is private to the currently authenticated user.
    if ((path === "payments/purchases" || path === "payment/purchases") && method === "GET") {
      if (!user.userId) return errorResponse("Please sign in to view your purchases.", 401);
      const purchases = lmsDB.getUserPurchases(user.userId);
      const courseIds = Array.from(new Set(purchases.map((purchase) => purchase.course_id)));
      return jsonResponse({ purchases, courseIds });
    }

    // GET /api/lms/course-reviews?courseId=...
    // Public summary/reviews, plus the current user's saved review when signed in.
    if (path === "course-reviews" && method === "GET") {
      const courseId = url.searchParams.get("courseId") || "";
      if (!courseId) return errorResponse("Missing courseId.", 400);
      const summary = lmsDB.getCourseReviewSummary(courseId);
      if (!summary) return errorResponse("Course not found.", 404);
      const own = user.userId ? lmsDB.getUserCourseReview(user.userId, courseId) : null;
      return jsonResponse({
        ...summary,
        myReview: own
          ? { rating: own.rating, reviewText: own.review_text, updatedAt: own.updated_at }
          : null,
      });
    }

    // POST /api/lms/course-reviews
    // A student must have a real enrollment or purchase; identity comes from auth context.
    if (path === "course-reviews" && method === "POST") {
      if (!user.userId) return errorResponse("Sign in to submit a course review.", 401);
      const body = await req.json().catch(() => ({}));
      const courseId = typeof body.courseId === "string" ? body.courseId : "";
      const rating = Number(body.rating);
      const reviewText = typeof body.reviewText === "string" ? body.reviewText : "";
      if (!courseId) return errorResponse("Missing courseId.", 400);
      try {
        lmsDB.saveCourseReview({
          courseIdOrSlug: courseId,
          studentId: user.userId,
          studentName: user.name || user.email?.split("@")[0] || "Student",
          rating,
          reviewText,
        });
        const summary = lmsDB.getCourseReviewSummary(courseId);
        const own = lmsDB.getUserCourseReview(user.userId, courseId);
        if (!summary || !own) return errorResponse("Review saved, but could not reload it.", 500);
        return jsonResponse({
          ok: true,
          ...summary,
          myReview: { rating: own.rating, reviewText: own.review_text, updatedAt: own.updated_at },
        });
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Could not save review.", 400);
      }
    }

    // GET /api/lms/courses
    if (path === "courses" && method === "GET") {
      const courses = lmsDB.getAllCourses();
      return jsonResponse({ courses });
    }

    // GET /api/lms/course?idOrSlug=...
    if (path === "course" && method === "GET") {
      const idOrSlug = url.searchParams.get("idOrSlug") || url.searchParams.get("slug") || "";
      if (!idOrSlug) return errorResponse("Missing course slug or id parameter");
      const course = lmsDB.getCourse(idOrSlug);
      if (!course) return errorResponse("Course not found", 404);

      const lessons = lmsDB.getLessonsForCourse(course.id);
      let enrollment = null;
      let progressRecords: unknown[] = [];

      if (user.userId) {
        enrollment = lmsDB.getStudentEnrollment(user.userId, course.id);
        progressRecords = lmsDB.getLessonProgress(user.userId, course.id);
      }

      return jsonResponse({
        course,
        lessons,
        enrollment,
        lessonProgress: progressRecords,
      });
    }

    // POST /api/lms/enroll
    if (path === "enroll" && method === "POST") {
      if (!user.userId) return errorResponse("Please sign in before enrolling.", 401);
      const body = await req.json().catch(() => ({}));
      const requestedCourseId = typeof body.courseId === "string"
        ? body.courseId
        : typeof body.courseSlug === "string"
          ? body.courseSlug
          : "";
      if (!requestedCourseId) return errorResponse("Missing courseId");

      const course = lmsDB.getCourse(requestedCourseId);
      if (!course || course.status !== "published") {
        return errorResponse("Course not found or not published.", 404);
      }

      // Paid courses are unlocked only by the verified payment endpoint.
      const existingPurchase = lmsDB.getPurchases(user.userId).some(
        (purchase) => purchase.course_id === course.id,
      );
      if (course.price_inr > 0 && !existingPurchase) {
        return errorResponse("Payment required before enrolling in this course.", 402);
      }

      const studentName = user.name || String(body.studentName || user.email?.split("@")[0] || "Student Learner");
      const studentEmail = user.email || String(body.studentEmail || "");
      const enrollment = lmsDB.enrollStudent(user.userId, course.id, studentName, studentEmail);
      return jsonResponse({ enrollment });
    }

    // POST /api/lms/payment/create-order
    // Create an actual Razorpay order; never return simulated order IDs.
    if ((path === "payment/create-order" || path === "payments/create-order") && method === "POST") {
      if (!user.userId) return errorResponse("Please sign in before purchasing a course.", 401);
      const body = await req.json().catch(() => ({}));
      const requestedCourseId = typeof body.courseId === "string" ? body.courseId : "";
      if (!requestedCourseId) return errorResponse("Missing courseId");

      const course = lmsDB.getCourse(requestedCourseId);
      if (!course) return errorResponse("Course not found.", 404);
      if (course.status !== "published") return errorResponse("This course is not available for purchase.", 409);
      if (!Number.isFinite(course.price_inr) || course.price_inr <= 0) {
        return errorResponse("This course does not require a paid checkout.", 400);
      }

      const { keyId, keySecret } = getRazorpayServerCredentials();
      if (!/^rzp_(test|live)_/.test(keyId) || !keySecret) {
        return errorResponse(
          "Razorpay is not configured for this deployment. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the Vercel environment, then redeploy.",
          503,
        );
      }

      const amountPaise = Math.round(course.price_inr * 100);
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      let razorpayOrder: {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: Record<string, string>;
      };
      try {
        const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: "INR",
            receipt: `sb_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`.slice(0, 40),
            notes: {
              course_id: course.id,
              course_slug: course.slug,
              student_id: user.userId,
            },
          }),
        });
        if (!orderResponse.ok) {
          const detail = await orderResponse.text().catch(() => "");
          console.error("Razorpay order API rejected request:", orderResponse.status, detail.slice(0, 500));
          return errorResponse(
            "Razorpay could not create the order. Check that the test/live API keys in Vercel match.",
            502,
          );
        }
        razorpayOrder = await orderResponse.json() as typeof razorpayOrder;
      } catch (error) {
        console.error("Razorpay order creation request failed:", error);
        return errorResponse("Could not reach Razorpay to create the payment order.", 502);
      }

      if (!razorpayOrder.id || razorpayOrder.amount !== amountPaise) {
        return errorResponse("Razorpay returned an invalid order. No payment has been taken.", 502);
      }

      return jsonResponse({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        keyId,
        title: course.title,
        isLive: true,
        isTest: keyId.startsWith("rzp_test_"),
      });
    }

    // POST /api/lms/payment/verify
    // Verify the HMAC signature and confirm a captured payment directly with Razorpay.
    if ((path === "payment/verify" || path === "payments/verify") && method === "POST") {
      if (!user.userId) return errorResponse("Please sign in again to verify your payment.", 401);
      const body = await req.json().catch(() => ({}));
      const requestedCourseId = typeof body.courseId === "string" ? body.courseId : "";
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
      const signature = typeof body.signature === "string" ? body.signature.trim() : "";
      if (!requestedCourseId || !orderId || !paymentId || !signature) {
        return errorResponse("Missing course, order, payment, or signature details.", 400);
      }

      const course = lmsDB.getCourse(requestedCourseId);
      if (!course || course.status !== "published") return errorResponse("Course not found or not published.", 404);
      if (!Number.isFinite(course.price_inr) || course.price_inr <= 0) {
        return errorResponse("This course is not a paid course.", 400);
      }

      const keyId = process.env["RAZORPAY_KEY_ID"]?.trim() || "";
      const keySecret = process.env["RAZORPAY_KEY_SECRET"]?.trim() || "";
      if (!/^rzp_(test|live)_/.test(keyId) || !keySecret) {
        return errorResponse("Razorpay is not configured for this deployment.", 503);
      }

      // Razorpay Checkout signs order_id|payment_id using the API key secret.
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
      if (!/^[a-f0-9]{64}$/i.test(signature)) {
        return errorResponse("Invalid Razorpay payment signature.", 400);
      }
      const expectedBytes = Buffer.from(expectedSignature, "hex");
      const suppliedBytes = Buffer.from(signature, "hex");
      if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
        return errorResponse("Razorpay signature verification failed. The course has not been unlocked.", 400);
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const razorpayHeaders = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
      const expectedAmount = Math.round(course.price_inr * 100);

      let razorpayOrder: {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: Record<string, string>;
      };
      try {
        const orderResponse = await fetch(
          `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
          { headers: razorpayHeaders },
        );
        if (!orderResponse.ok) return errorResponse("Could not confirm this Razorpay order.", 502);
        razorpayOrder = await orderResponse.json() as typeof razorpayOrder;
      } catch (error) {
        console.error("Razorpay order verification request failed:", error);
        return errorResponse("Could not reach Razorpay to verify the order.", 502);
      }

      if (
        razorpayOrder.id !== orderId ||
        razorpayOrder.amount !== expectedAmount ||
        razorpayOrder.currency !== "INR" ||
        razorpayOrder.notes?.["course_id"] !== course.id ||
        razorpayOrder.notes?.["student_id"] !== user.userId
      ) {
        return errorResponse("This payment order does not match your account, course, or course price.", 403);
      }

      let razorpayPayment: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
      try {
        const paymentResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
          { headers: razorpayHeaders },
        );
        if (!paymentResponse.ok) return errorResponse("Could not confirm the Razorpay payment.", 502);
        razorpayPayment = await paymentResponse.json() as typeof razorpayPayment;
      } catch (error) {
        console.error("Razorpay payment verification request failed:", error);
        return errorResponse("Could not reach Razorpay to verify the payment.", 502);
      }

      if (
        razorpayPayment.id !== paymentId ||
        razorpayPayment.order_id !== orderId ||
        razorpayPayment.amount !== expectedAmount ||
        razorpayPayment.currency !== "INR"
      ) {
        return errorResponse("The Razorpay payment details do not match this course order.", 400);
      }

      if (razorpayPayment.status === "authorized") {
        try {
          const captureResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,
            {
              method: "POST",
              headers: razorpayHeaders,
              body: JSON.stringify({ amount: expectedAmount, currency: "INR" }),
            },
          );
          if (!captureResponse.ok) {
            const detail = await captureResponse.text().catch(() => "");
            console.error("Razorpay capture failed:", captureResponse.status, detail.slice(0, 500));
            return errorResponse("Payment was authorized but could not be captured. Course access has not been granted.", 402);
          }
          razorpayPayment = await captureResponse.json() as typeof razorpayPayment;
        } catch (error) {
          console.error("Razorpay capture request failed:", error);
          return errorResponse("Payment capture could not be confirmed. Course access has not been granted.", 502);
        }
      }

      if (razorpayPayment.status !== "captured") {
        return errorResponse("Payment is not captured yet. The course has not been unlocked.", 402);
      }

      // Trust only the authenticated session identity, never a user ID sent in the request body.
      const studentId = user.userId;
      const studentName = user.name || String(body.userName || user.email?.split("@")[0] || "Student Learner");
      const studentEmail = user.email || String(body.userEmail || "");
      const purchase = lmsDB.recordPurchase({
        userId: studentId,
        courseIdOrSlug: course.id,
        amountInr: course.price_inr,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
      });
      const enrollment = lmsDB.enrollStudent(studentId, course.id, studentName, studentEmail);

      return jsonResponse({
        ok: true,
        orderId,
        paymentId,
        amount: course.price_inr,
        courseId: course.id,
        title: course.title,
        enrolled: true,
        enrollment,
        purchase,
        isLive: keyId.startsWith("rzp_live_"),
        isTest: keyId.startsWith("rzp_test_"),
      });
    }

    // GET /api/lms/payment/purchases
    if (path === "payment/purchases" && method === "GET") {
      const studentId = user.userId || url.searchParams.get("userId");
      if (!studentId) return jsonResponse({ purchases: [] });
      const purchases = lmsDB.getPurchases(studentId);
      return jsonResponse({ purchases });
    }

    // POST /api/lms/complete-lesson
    if (path === "complete-lesson" && method === "POST") {
      if (!user.userId) return errorResponse("Unauthorized", 401);
      const body = await req.json();
      const { courseId, lessonId, completed = true } = body;
      if (!courseId || !lessonId) return errorResponse("Missing courseId or lessonId");

      const result = lmsDB.completeLesson({
        studentId: user.userId,
        courseIdOrSlug: courseId,
        lessonId,
        completed: Boolean(completed),
        studentName: user.name || body.studentName,
        studentEmail: user.email || body.studentEmail,
      });

      return jsonResponse(result);
    }

    // GET /api/lms/student-dashboard
    if (path === "student-dashboard" && method === "GET") {
      if (!user.userId) return errorResponse("Unauthorized", 401);
      const data = lmsDB.getStudentDashboard(user.userId);
      return jsonResponse(data);
    }

    // GET /api/lms/instructor-data
    if (path === "instructor-data" && method === "GET") {
      if (!user.isTeacher) return errorResponse("Forbidden: Instructor role required", 403);
      const data = lmsDB.getInstructorData(user.userId, user.isAdmin);
      return jsonResponse(data);
    }

    // POST /api/lms/course (Create course)
    if (path === "course" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden: Instructor role required", 403);
      const body = await req.json();
      if (!body.title || !body.slug) return errorResponse("Title and slug are required");

      const videoUrls = Array.isArray(body.video_urls)
        ? body.video_urls.filter(Boolean)
        : body.video_url
          ? [body.video_url]
          : [];
      // Do not seed a placeholder video when the teacher has not uploaded one.
      const primaryVideoUrl = body.video_url || videoUrls[0] || "";

      const created = lmsDB.createCourse({
        title: body.title,
        slug: body.slug,
        description: body.description || "",
        instructor: body.instructor || user.name || "Lead Instructor",
        teacher_id: user.userId,
        thumbnail: body.thumbnail || "/course-typescript.jpg",
        status: body.status || "published",
        price_inr: Number(body.price_inr) || 999,
        preview_minutes: Number(body.preview_minutes) || 3,
        video_url: primaryVideoUrl,
        video_urls: videoUrls,
        hours: Number(body.hours) || 10,
        level: body.level || "Intermediate",
        category: body.category || "Development",
        rating: 0,
        reviews: "0",
        learners: "0",
        bestseller: false,
      });

      return jsonResponse({ course: created });
    }

    // PUT /api/lms/course (Update course)
    if (path === "course" && method === "PUT") {
      if (!user.isTeacher) return errorResponse("Forbidden: Instructor role required", 403);
      const body = await req.json();
      const courseId = body.id || body.slug;
      if (!courseId) return errorResponse("Course id is required");

      const existing = lmsDB.getCourse(courseId);
      if (!existing) return errorResponse("Course not found", 404);

      const updated = lmsDB.updateCourse(existing.id, body);
      return jsonResponse({ course: updated });
    }

    // DELETE /api/lms/course
    if (path === "course" && method === "DELETE") {
      if (!user.isTeacher) return errorResponse("Forbidden: Instructor role required", 403);
      const body = await req.json();
      const courseId = body.id || body.slug;
      if (!courseId) return errorResponse("Course id is required");

      const existing = lmsDB.getCourse(courseId);
      if (!existing) return errorResponse("Course not found", 404);

      const ok = lmsDB.deleteCourse(existing.id);
      return jsonResponse({ success: ok });
    }

    // POST /api/lms/register-video
    // Persist the URL after the browser uploads the bytes directly to Vercel Blob.
    if (path === "register-video" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden: Instructor role required", 403);
      const body = await req.json();
      const courseId = typeof body.courseId === "string" ? body.courseId : "";
      const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl : "";
      const lessonId = typeof body.lessonId === "string" && body.lessonId ? body.lessonId : null;
      if (!courseId || !videoUrl) return errorResponse("Course id and video URL are required.");
      let parsedVideoUrl: URL;
      try {
        parsedVideoUrl = new URL(videoUrl);
      } catch {
        return errorResponse("Invalid video URL.");
      }
      if (parsedVideoUrl.protocol !== "https:" || !parsedVideoUrl.hostname.endsWith(".blob.vercel-storage.com")) {
        return errorResponse("Video must be uploaded to the configured Vercel Blob store.");
      }

      const course = lmsDB.getCourse(courseId);
      if (!course) return errorResponse("Course not found.", 404);

      if (lessonId) {
        const snapshot = lmsDB.exportSnapshot();
        const lesson = snapshot.lessons.find((item) => item.id === lessonId && (item.course_id === course.id || item.course_id === course.slug));
        if (!lesson) return errorResponse("Lesson not found for this course.", 404);
        const updatedLesson = lmsDB.updateLesson(lessonId, { video_url: videoUrl });
        if (!updatedLesson) return errorResponse("Could not save video to the lesson.", 500);
      } else {
        let currentUrls = course.video_urls && Array.isArray(course.video_urls)
          ? [...course.video_urls].filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
          : course.video_url ? [course.video_url] : [];

        // If this course has real Blob uploads, remove the old sample URLs
        // that earlier versions inserted automatically during course creation.
        if (videoUrl.includes(".blob.vercel-storage.com")) {
          currentUrls = currentUrls.filter(
            (url) => !url.includes("commondatastorage.googleapis.com/gtv-videos-bucket/sample/"),
          );
        }
        if (!currentUrls.includes(videoUrl)) currentUrls.push(videoUrl);
        lmsDB.updateCourse(course.id, { video_url: videoUrl, video_urls: currentUrls });
      }

      return jsonResponse({ videoUrl, fileName: String(body.fileName || ""), size: Number(body.size) || 0 });
    }

    // POST /api/lms/upload-video
    // Legacy server-side upload route retained for compatibility with small files.
    if (path === "upload-video" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden: Instructor role required", 403);

      const courseId = url.searchParams.get("courseId") || "";
      if (!courseId) return errorResponse("Course id is required.");

      const course = lmsDB.getCourse(courseId);
      if (!course) return errorResponse("Course not found.", 404);

      const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
      const declaredSize = Number(
        req.headers.get("x-file-size") || req.headers.get("content-length") || 0,
      );
      if (declaredSize > MAX_VIDEO_SIZE) {
        return errorResponse("Video is too large. Maximum file size is 500 MB.", 413);
      }
      if (!req.body) return errorResponse("Video file is required.", 400);

      let originalName = "video.mp4";
      const encodedName = req.headers.get("x-file-name");
      if (encodedName) {
        try {
          originalName = decodeURIComponent(encodedName);
        } catch {
          originalName = encodedName;
        }
      }

      const allowedExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
      const dot = originalName.lastIndexOf(".");
      const extension = dot >= 0 ? originalName.slice(dot).toLowerCase() : "";
      if (!allowedExtensions.has(extension)) {
        return errorResponse("Unsupported video format. Use MP4, WebM, MOV, or M4V.", 400);
      }

      const safeBase =
        originalName
          .slice(0, dot >= 0 ? dot : originalName.length)
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || "video";
      const uniqueName = `${course.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeBase}${extension}`;

      let publicVideoUrl: string;
      const contentTypeByExtension: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".m4v": "video/x-m4v",
      };

      try {
        const blobToken = process.env["BLOB_READ_WRITE_TOKEN"] || process.env["SKILLBRIDGE_READ_WRITE_TOKEN"];
        if (blobToken) {
          const blob = await put("courses/" + course.id + "/videos/" + uniqueName, req.body, {
            access: "public",
            addRandomSuffix: false,
            contentType: contentTypeByExtension[extension] || "application/octet-stream",
            token: blobToken,
          });
          publicVideoUrl = blob.url;
        } else {
          const uploadDir = nodePath.resolve(process.cwd(), "public", "uploads", "videos");
          fs.mkdirSync(uploadDir, { recursive: true });
          const filePath = nodePath.join(uploadDir, uniqueName);
          const writeStream = fs.createWriteStream(filePath);
          await pipeline(Readable.fromWeb(req.body as unknown as Parameters<typeof Readable.fromWeb>[0]), writeStream);
          const writtenStat = await fs.promises.stat(filePath);
          if (declaredSize > 0 && writtenStat.size === 0) {
            await fs.promises.rm(filePath, { force: true }).catch(() => {});
            return errorResponse("Video upload failed: 0 bytes written to disk.", 500);
          }
          publicVideoUrl = "/uploads/videos/" + uniqueName;
        }
      } catch (err) {
        if (req.signal?.aborted) {
          console.warn("Video upload request was aborted by the client.");
          return errorResponse("Video upload was cancelled before completion.", 499);
        }
        throw err;
      }

      const lessonId = url.searchParams.get("lessonId");
      if (lessonId) {
        try {
          lmsDB.updateLesson(lessonId, { video_url: publicVideoUrl });
        } catch (lErr) {
          console.warn("Failed to auto-update lesson video_url during upload:", lErr);
        }
      } else {
        // Automatically append to course's video_urls and update video_url
        try {
          const currentUrls =
            course.video_urls && Array.isArray(course.video_urls)
              ? [...course.video_urls]
              : course.video_url
                ? [course.video_url]
                : [];
          if (!currentUrls.includes(publicVideoUrl)) {
            currentUrls.push(publicVideoUrl);
          }
          lmsDB.updateCourse(course.id, {
            video_url: publicVideoUrl,
            video_urls: currentUrls,
          });
        } catch (dbErr) {
          console.warn("Failed to auto-update course video_url during upload:", dbErr);
        }
      }

      return jsonResponse({
        videoUrl: publicVideoUrl,
        fileName: originalName,
        size: declaredSize,
      });
    }

    // POST /api/lms/lesson (Add lesson)
    if (path === "lesson" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const {
        courseId,
        title,
        description = "",
        duration = "15:00",
        videoUrl = "",
        isRequired = true,
        isPreview = false,
      } = body;
      if (!courseId || !title) return errorResponse("Missing courseId or title");

      const existingCourse = lmsDB.getCourse(courseId);
      if (!existingCourse) return errorResponse("Course not found", 404);

      const lesson = lmsDB.addLesson(existingCourse.id, {
        title,
        description,
        duration,
        video_url: videoUrl || existingCourse.video_url,
        is_required: Boolean(isRequired),
        is_preview: Boolean(isPreview),
        lesson_order: body.lessonOrder || 0,
      });

      return jsonResponse({ lesson });
    }

    // PUT /api/lms/lesson (Edit lesson)
    if (path === "lesson" && method === "PUT") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const { lessonId, ...patch } = body;
      if (!lessonId) return errorResponse("Missing lessonId");

      if (patch.videoUrl && !patch.video_url) {
        patch.video_url = patch.videoUrl;
      }

      const lesson = lmsDB.updateLesson(lessonId, patch);
      if (!lesson) return errorResponse("Lesson not found", 404);
      return jsonResponse({ lesson });
    }

    // DELETE /api/lms/lesson (Delete lesson)
    if (path === "lesson" && method === "DELETE") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const { lessonId } = body;
      if (!lessonId) return errorResponse("Missing lessonId");

      const ok = lmsDB.deleteLesson(lessonId);
      return jsonResponse({ success: ok });
    }

    // POST /api/lms/submit-assignment
    if (path === "submit-assignment" && method === "POST") {
      if (!user.userId) return errorResponse("Unauthorized", 401);
      const body = await req.json();
      const { assignmentId, courseId, githubUrl = "", solutionNotes = "" } = body;
      if (!assignmentId || !courseId) return errorResponse("Missing assignmentId or courseId");

      const course = lmsDB.getCourse(courseId);
      if (!course) return errorResponse("Course not found", 404);

      const submission = lmsDB.submitAssignment({
        assignment_id: assignmentId,
        course_id: course.id,
        student_id: user.userId,
        student_name: user.name || body.studentName || "Student",
        student_email: user.email || body.studentEmail || "student@example.com",
        github_url: githubUrl,
        solution_notes: solutionNotes,
        max_score: Number(body.maxScore) || 100,
      });

      return jsonResponse({ submission });
    }

    // POST /api/lms/grade-submission
    if (path === "grade-submission" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const { submissionId, score, feedback, status } = body;
      if (!submissionId || score === undefined)
        return errorResponse("Missing submissionId or score");

      const graded = lmsDB.gradeSubmission(submissionId, {
        score: Number(score),
        feedback: feedback || "Well done!",
        gradedBy: user.name || "Instructor",
        status: status === "needs_revision" || status === "approved" ? status : undefined,
      });

      if (!graded) return errorResponse("Submission not found", 404);
      return jsonResponse({ submission: graded });
    }

    // POST /api/lms/save-assignment
    if (path === "save-assignment" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const course = lmsDB.getCourse(body.courseId || body.courseSlug);
      if (!course) return errorResponse("Course not found", 404);

      const asg = lmsDB.saveAssignment({
        id: body.id,
        course_id: course.id,
        course_slug: course.slug,
        course_title: course.title,
        title: body.title,
        description: body.description || "",
        due_date: body.dueDate || new Date(Date.now() + 86400000 * 7).toISOString(),
        max_score: Number(body.maxScore) || 100,
        created_by: user.userId,
      });

      return jsonResponse({ assignment: asg });
    }

    // DELETE /api/lms/assignment
    if (path === "assignment" && method === "DELETE") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const { id } = body;
      if (!id) return errorResponse("Missing id");
      const ok = lmsDB.deleteAssignment(id);
      return jsonResponse({ success: ok });
    }

    // POST /api/lms/submit-quiz
    if (path === "submit-quiz" && method === "POST") {
      if (!user.userId) return errorResponse("Unauthorized", 401);
      const body = await req.json();
      const { quizId, courseId, answers = {} } = body;
      if (!quizId || !courseId) return errorResponse("Missing quizId or courseId");

      const db = lmsDB.getAllCourses();
      const course = lmsDB.getCourse(courseId);
      if (!course) return errorResponse("Course not found", 404);

      // Find quiz to score answers
      const quiz = (lmsDB as unknown as { read: () => { quizzes: unknown[] } })
        .read?.()
        ?.quizzes?.find((q: unknown) => (q as { id: string }).id === quizId) as
        | {
            questions: { id: number; correct_option: number; marks: number }[];
            pass_percentage: number;
          }
        | undefined;

      let score = 0;
      let totalMarks = 0;
      if (quiz && quiz.questions) {
        quiz.questions.forEach((q) => {
          totalMarks += q.marks;
          if (answers[q.id] === q.correct_option) {
            score += q.marks;
          }
        });
      } else {
        totalMarks = 100;
        score = 80;
      }

      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      const passed = percentage >= (quiz?.pass_percentage || 70);

      const attempt = lmsDB.submitQuizAttempt({
        quiz_id: quizId,
        course_id: course.id,
        student_id: user.userId,
        student_name: user.name || body.studentName || "Student",
        student_email: user.email || body.studentEmail || "student@example.com",
        score,
        total_marks: totalMarks,
        percentage,
        passed,
        answers,
      });

      return jsonResponse({ attempt });
    }

    // POST /api/lms/save-quiz
    if (path === "save-quiz" && method === "POST") {
      if (!user.isTeacher) return errorResponse("Forbidden", 403);
      const body = await req.json();
      const course = lmsDB.getCourse(body.courseId || body.courseSlug);
      if (!course) return errorResponse("Course not found", 404);

      const quiz = lmsDB.saveQuiz({
        id: body.id,
        course_id: course.id,
        course_slug: course.slug,
        course_title: course.title,
        title: body.title,
        description: body.description || "",
        duration_minutes: Number(body.durationMinutes) || 15,
        pass_percentage: Number(body.passPercentage) || 70,
        questions: body.questions || [],
        created_by: user.userId,
      });

      return jsonResponse({ quiz });
    }

    return errorResponse(`Unhandled endpoint: ${method} /api/lms/${path}`, 404);
  } catch (err: unknown) {
    console.error("LMS API Error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return errorResponse(msg, 500);
  }
}


function getNeonConnectionString(): string | undefined {
  const candidates = [
    process.env["DATABASE_URL"],
    process.env["DATABASE_POSTGRES_URL"],
    process.env["DATABASE_POSTGRES_URL_NON_POOLING"],
    process.env["DATABASE_URL_UNPOOLED"],
    process.env["POSTGRES_URL"],
    process.env["POSTGRES_URL_NON_POOLING"],
  ];
  return candidates
    .map((value) => value?.trim())
    .find((value) => Boolean(value) && !value!.includes("[SENSITIVE]"));
}

let neonClient: ReturnType<typeof postgres> | undefined;
let neonClientUrl: string | undefined;

function getNeonClient() {
  const url = getNeonConnectionString();
  if (!url) throw new Error("Neon PostgreSQL is not configured. Set DATABASE_URL in the Vercel environment.");
  if (!neonClient || neonClientUrl !== url) {
    if (neonClient) void neonClient.end({ timeout: 1 }).catch(() => {});
    neonClient = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10 });
    neonClientUrl = url;
  }
  return neonClient;
}

/**
 * Neon-backed compatibility persistence for the existing LMS domain model.
 * A transaction advisory lock serializes requests across Vercel instances so the
 * current synchronous domain methods remain compatible while their state is durable.
 */
export async function handleLmsApiRequest(req: Request): Promise<Response | null> {
  const pathname = new URL(req.url).pathname;
  if (!pathname.startsWith("/api/lms")) return null;

  // Safe diagnostic endpoint: confirms database connectivity without exposing credentials.
  if (pathname === "/api/lms/health" && req.method.toUpperCase() === "GET") {
    try {
      const rows = await getNeonClient().unsafe("SELECT current_database() AS database");
      return jsonResponse({
        ok: true,
        database: "neon",
        connected: true,
        databaseName: rows[0]?.["database"] ?? null,
      });
    } catch (error) {
      const err = error as { code?: string };
      console.error("Neon health check failed:", error);
      return jsonResponse({
        ok: false,
        database: "neon",
        connected: false,
        error: getNeonConnectionString()
          ? "Neon connection failed. Check the connection string, network access, and database permissions."
          : "No database connection string found. Configure DATABASE_URL in Vercel.",
        code: err.code || "DATABASE_CONNECTION_FAILED",
      }, 503);
    }
  }

  if (!getNeonConnectionString()) {
    // Local file-backed mode is useful for local development, but is not durable on Vercel.
    if (process.env["VERCEL"]) {
      return jsonResponse({
        error: "Neon PostgreSQL is not configured. Add DATABASE_URL to the Vercel project and redeploy.",
      }, 503);
    }
    return handleLmsApiRequestWithLocalStore(req);
  }

  try {
    const sql = getNeonClient();
    await sql`
      CREATE TABLE IF NOT EXISTS skillbridge_lms_state (
        id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        state jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(736284910)`;
      const rows = await tx`SELECT state FROM skillbridge_lms_state WHERE id = 1`;
      if (rows.length > 0) {
        // PostgreSQL JSONB should normally be decoded to an object, but older
        // rows/deployments may return a JSON-serialized string. Normalize both
        // formats before importing so schema integrity checks can mutate it.
        let snapshot: unknown = rows[0]!.state;
        // Some earlier deployments stored the JSONB snapshot as a JSON string,
        // and some drivers/legacy rows can expose that string more than once.
        // Decode repeatedly until it is an object, rather than importing a string
        // (which prevents every mutation from being persisted).
        for (let depth = 0; typeof snapshot === "string" && depth < 3; depth += 1) {
          try {
            snapshot = JSON.parse(snapshot);
          } catch {
            break;
          }
        }
        if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
          throw new Error("Neon LMS state is not a valid database snapshot.");
        }
        lmsDB.importSnapshot(snapshot as import("./lms-db.server").LMSDatabase);
      } else {
        await tx`
          INSERT INTO skillbridge_lms_state (id, state, updated_at)
          VALUES (1, ${JSON.stringify(lmsDB.exportSnapshot())}::jsonb, now())
          ON CONFLICT (id) DO NOTHING
        `;
      }

      const response = await handleLmsApiRequestWithLocalStore(req);
      await tx`
        INSERT INTO skillbridge_lms_state (id, state, updated_at)
        VALUES (1, ${JSON.stringify(lmsDB.exportSnapshot())}::jsonb, now())
        ON CONFLICT (id) DO UPDATE
        SET state = EXCLUDED.state, updated_at = now()
      `;
      return response;
    });
  } catch (error) {
    console.error("Neon LMS persistence error:", error);
    return jsonResponse({ error: "The LMS database is temporarily unavailable. Check DATABASE_URL and database connectivity." }, 503);
  }
}
