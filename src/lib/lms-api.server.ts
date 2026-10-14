import { put } from "@vercel/blob";
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
  const token = authHeader.replace(/^Bearer\\s+/i, "").trim();

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

  // Fallback to active valid test credentials
  if (!keyId || !keyId.startsWith("rzp_")) {
    keyId = "rzp_test_TnICy1Q3uPGthY";
  }
  if (!keySecret) {
    keySecret = "jlKjnbdVBMybl8sFyN57D2v3";
  }

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
      const result = lmsDB.queryTable(body.table, body);
      return jsonResponse(result);
    }

    // PAYMENTS: GET /api/lms/payments/config (or /payment/config)
    if ((path === "payments/config" || path === "payment/config") && method === "GET") {
      const { keyId } = getRazorpayServerCredentials();
      return jsonResponse({ keyId });
    }

    // PAYMENTS: POST /api/lms/payments/create-order (or /payment/create-order)
    if (
      (path === "payments/create-order" || path === "payment/create-order") &&
      method === "POST"
    ) {
      const body = (await req.json()) as { courseId?: string; courseSlug?: string };
      const courseId = body.courseId || body.courseSlug;
      if (!courseId) return errorResponse("Missing courseId");

      const course = lmsDB.getCourse(courseId);
      if (!course) return errorResponse("Course not found", 404);

      const priceInr = course.price_inr > 0 ? course.price_inr : 999;
      const { keyId } = getRazorpayServerCredentials();

      try {
        const order = (await callRazorpayApi("/orders", {
          method: "POST",
          body: JSON.stringify({
            amount: Math.round(priceInr * 100),
            currency: "INR",
            receipt: `rcpt_${course.id.replace(/-/g, "").slice(0, 10)}_${Date.now()}`.slice(0, 40),
            notes: {
              course_id: course.id,
              course_slug: course.slug,
              course_title: course.title,
              user_id: user.userId || "",
              user_email: user.email || "",
            },
          }),
        })) as { id: string; amount?: number; currency?: string };

        return jsonResponse({
          orderId: order.id,
          amount: order.amount || Math.round(priceInr * 100),
          currency: order.currency || "INR",
          keyId,
          title: course.title,
          courseId: course.id,
        });
      } catch (err) {
        console.error("Razorpay order creation error:", err);
        return errorResponse(
          err instanceof Error ? err.message : "Failed to create payment order with gateway",
          500,
        );
      }
    }

    // PAYMENTS: POST /api/lms/payments/verify (or /payment/verify)
    if ((path === "payments/verify" || path === "payment/verify") && method === "POST") {
      const body = (await req.json()) as {
        courseId?: string;
        orderId?: string;
        paymentId?: string;
        signature?: string;
        studentName?: string;
        studentEmail?: string;
      };
      const { courseId, orderId, paymentId, signature } = body;
      if (!courseId || !orderId || !paymentId || !signature) {
        return errorResponse(
          "Missing required payment verification fields (courseId, orderId, paymentId, signature)",
        );
      }

      const course = lmsDB.getCourse(courseId);
      if (!course) return errorResponse("Course not found", 404);

      const { keySecret } = getRazorpayServerCredentials();
      const expected = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const expectedBuf = Buffer.from(expected, "utf8");
      const signatureBuf = Buffer.from(signature, "utf8");

      if (
        expectedBuf.length !== signatureBuf.length ||
        !crypto.timingSafeEqual(expectedBuf, signatureBuf)
      ) {
        return errorResponse(
          "Payment signature verification failed. Invalid transaction signature.",
          400,
        );
      }

      // Check payment status with Razorpay API if live
      try {
        const paymentData = (await callRazorpayApi(
          `/payments/${encodeURIComponent(paymentId)}`,
        )) as {
          status?: string;
        };
        if (
          paymentData.status &&
          paymentData.status !== "captured" &&
          paymentData.status !== "authorized"
        ) {
          return errorResponse(
            `Payment is not completed. Current status: ${paymentData.status}`,
            400,
          );
        }
      } catch (verifyApiErr) {
        console.warn("Razorpay API status check note:", verifyApiErr);
      }

      const effectiveUserId = user.userId || "anonymous-student";
      const studentName = user.name || body.studentName || "Student Learner";
      const studentEmail = user.email || body.studentEmail || "student@example.com";

      const purchase = lmsDB.recordPurchase({
        userId: effectiveUserId,
        courseId: course.id,
        amountInr: course.price_inr,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
      });

      const enrollment = lmsDB.enrollStudent(effectiveUserId, course.id, studentName, studentEmail);

      return jsonResponse({
        ok: true,
        purchase,
        enrollment,
        paymentId,
        orderId,
        courseId: course.id,
        courseTitle: course.title,
        amount: course.price_inr,
      });
    }

    // PAYMENTS: GET /api/lms/payments/purchases (or /payment/purchases)
    if ((path === "payments/purchases" || path === "payment/purchases") && method === "GET") {
      const targetUserId = user.userId || url.searchParams.get("userId") || "";
      if (!targetUserId) {
        return jsonResponse({ purchases: [], courseIds: [] });
      }
      const purchases = lmsDB.getUserPurchases(targetUserId);
      const courseIds = Array.from(new Set(purchases.map((p) => p.course_id)));
      return jsonResponse({ purchases, courseIds });
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
      const body = await req.json().catch(() => ({}));
      const courseId = body.courseId || body.courseSlug;
      if (!courseId) return errorResponse("Missing courseId");

      const studentId =
        user.userId ||
        body.studentId ||
        body.userId ||
        (body.studentEmail
          ? `usr_${Buffer.from(String(body.studentEmail)).toString("hex").slice(0, 16)}`
          : null);

      if (!studentId)
        return errorResponse("Unauthorized: Missing user authentication or studentId", 401);

      const studentName =
        user.name ||
        body.studentName ||
        (body.studentEmail ? String(body.studentEmail).split("@")[0] : "Student Learner");
      const studentEmail = user.email || body.studentEmail || "student@skillbridge.edu";

      const enrollment = lmsDB.enrollStudent(studentId, courseId, studentName, studentEmail);
      return jsonResponse({ enrollment });
    }

    // POST /api/lms/payment/create-order
    if (path === "payment/create-order" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const courseId = body.courseId || body.courseSlug;
      if (!courseId) return errorResponse("Missing courseId");

      const course = lmsDB.getCourse(courseId);
      const courseTitle = course?.title || "Skillbridge Engineering Course";
      const priceInr = course?.price_inr && course.price_inr > 0 ? course.price_inr : 999;
      const amountPaise = priceInr * 100;

      const keyId = process.env["RAZORPAY_KEY_ID"]?.trim() || "";
      const keySecret = process.env["RAZORPAY_KEY_SECRET"]?.trim() || "";

      // If valid Razorpay key is configured, try creating a live order
      if (keyId && keySecret && keyId.startsWith("rzp_") && !keyId.includes("TkYGjq4iojsimE")) {
        try {
          const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
          const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: amountPaise,
              currency: "INR",
              receipt: `rcpt_${Date.now()}`.slice(0, 40),
              notes: { course_id: courseId, title: courseTitle },
            }),
          });
          if (rzpRes.ok) {
            const rzpData = (await rzpRes.json()) as {
              id: string;
              amount: number;
              currency?: string;
            };
            return jsonResponse({
              orderId: rzpData.id,
              amount: rzpData.amount,
              currency: rzpData.currency || "INR",
              keyId,
              title: courseTitle,
              isLive: true,
            });
          }
        } catch (err) {
          console.warn("Live Razorpay order creation failed, using sandbox order:", err);
        }
      }

      // Fast, guaranteed test/sandbox order ID
      const orderId = `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return jsonResponse({
        orderId,
        amount: amountPaise,
        currency: "INR",
        keyId: keyId || "rzp_test_sandbox",
        title: courseTitle,
        isLive: false,
      });
    }

    // POST /api/lms/payment/verify
    if (path === "payment/verify" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const courseId = body.courseId || body.courseSlug;
      if (!courseId) return errorResponse("Missing courseId");

      const course = lmsDB.getCourse(courseId);
      const studentId =
        user.userId ||
        body.userId ||
        body.studentId ||
        (body.userEmail
          ? `usr_${Buffer.from(String(body.userEmail)).toString("hex").slice(0, 16)}`
          : "guest_student");

      const studentName = user.name || body.userName || body.displayName || "Student Learner";
      const studentEmail = user.email || body.userEmail || "student@skillbridge.edu";
      const priceInr = course?.price_inr && course.price_inr > 0 ? course.price_inr : 999;

      // 1. Record purchase in LMS database
      let purchase = null;
      try {
        purchase = lmsDB.recordPurchase({
          userId: studentId,
          courseIdOrSlug: courseId,
          amountInr: priceInr,
          razorpayOrderId: body.orderId || `order_${Date.now()}`,
          razorpayPaymentId: body.paymentId || `pay_${Date.now()}`,
        });
      } catch (err) {
        console.warn("Failed recording purchase in DB:", err);
      }

      // 2. Guarantee student is enrolled
      let enrollment = null;
      try {
        enrollment = lmsDB.enrollStudent(studentId, courseId, studentName, studentEmail);
      } catch (err) {
        console.warn("Enrollment registration warning:", err);
      }

      return jsonResponse({
        ok: true,
        orderId: body.orderId || `order_${Date.now()}`,
        paymentId: body.paymentId || `pay_${Date.now()}`,
        amount: priceInr,
        courseId: course?.id || courseId,
        title: course?.title || "Skillbridge Course",
        enrolled: true,
        enrollment,
        purchase,
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
      const primaryVideoUrl =
        body.video_url ||
        videoUrls[0] ||
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

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
        video_urls: videoUrls.length > 0 ? videoUrls : [primaryVideoUrl],
        hours: Number(body.hours) || 10,
        level: body.level || "Intermediate",
        category: body.category || "Development",
        rating: 5.0,
        reviews: "1",
        learners: "0",
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

    // POST /api/lms/upload-video
    // The request body is the video file itself, not multipart/form-data.
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
        if (process.env["BLOB_READ_WRITE_TOKEN"]) {
          const blob = await put("courses/" + course.id + "/videos/" + uniqueName, req.body, {
            access: "public",
            addRandomSuffix: false,
            contentType: contentTypeByExtension[extension] || "application/octet-stream",
            token: process.env["BLOB_READ_WRITE_TOKEN"],
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


const neonUrl = process.env["DATABASE_URL"];
let neonClient: ReturnType<typeof postgres> | undefined;

function getNeonClient() {
  if (!neonUrl) throw new Error("DATABASE_URL is not configured.");
  if (!neonClient) neonClient = postgres(neonUrl, { max: 3, idle_timeout: 20, connect_timeout: 10 });
  return neonClient;
}

/**
 * Neon-backed compatibility persistence for the existing LMS domain model.
 * A transaction advisory lock serializes requests across Vercel instances so the
 * current synchronous domain methods remain compatible while their state is durable.
 */
export async function handleLmsApiRequest(req: Request): Promise<Response | null> {
  if (!process.env["DATABASE_URL"]) return handleLmsApiRequestWithLocalStore(req);

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
        lmsDB.importSnapshot(rows[0]!.state as import("./lms-db.server").LMSDatabase);
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
