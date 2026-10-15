import { getAuthHeaders } from "@/lib/lms-client";

export interface CourseOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  title: string;
  /** True only when the backend created an actual Razorpay order. */
  isLive: boolean;
  isTest?: boolean;
}

export interface VerifyPaymentResult {
  ok: boolean;
  orderId: string;
  paymentId: string;
  amount: number;
  courseId?: string;
  title?: string;
  isTest?: boolean;
}

async function readApiResponse<T>(response: Response, action: string): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `${action} failed (HTTP ${response.status}).`);
  }
  return payload as T;
}

/** Creates a real Razorpay order. It never synthesizes an order when the API is unavailable. */
export async function createCourseOrder(opts: {
  data: {
    courseId: string;
    userId?: string;
    userEmail?: string;
  };
}): Promise<CourseOrderResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/lms/payment/create-order", {
    method: "POST",
    headers,
    body: JSON.stringify({ courseId: opts.data.courseId }),
  });
  const order = await readApiResponse<CourseOrderResult>(response, "Order creation");
  if (!order.orderId || !order.keyId || !order.isLive) {
    throw new Error("Razorpay did not create a valid payment order. No payment has been taken.");
  }
  return order;
}

/** Unlocks a course only when the server confirms the Razorpay signature and captured payment. */
export async function verifyCoursePayment(opts: {
  data: {
    courseId: string;
    orderId: string;
    paymentId: string;
    signature: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
  };
}): Promise<VerifyPaymentResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/lms/payment/verify", {
    method: "POST",
    headers,
    body: JSON.stringify({
      courseId: opts.data.courseId,
      orderId: opts.data.orderId,
      paymentId: opts.data.paymentId,
      signature: opts.data.signature,
    }),
  });
  const result = await readApiResponse<VerifyPaymentResult>(response, "Payment verification");
  if (!result.ok) {
    throw new Error("Razorpay could not confirm this payment. The course has not been unlocked.");
  }
  return result;
}

/** Fetches the authenticated user's purchase records. */
export async function getUserPurchases(opts?: { data?: { userId?: string } }): Promise<string[]> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/lms/payment/purchases", { headers });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      purchases?: Array<{ course_id: string }>;
    };
    return Array.isArray(json.purchases) ? json.purchases.map((purchase) => purchase.course_id) : [];
  } catch {
    return [];
  }
}
