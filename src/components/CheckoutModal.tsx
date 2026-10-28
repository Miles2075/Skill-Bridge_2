import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Loader2,
  Award,
  Code2,
  Brain,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCourseOrder, verifyCoursePayment } from "@/lib/payments.functions";

interface CheckoutCourseInfo {
  id?: string;
  slug: string;
  title: string;
  instructor?: string;
  price?: number;
  price_inr?: number;
  image?: string;
  hours?: number;
}

interface CheckoutModalProps {
  course: CheckoutCourseInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (courseId: string, courseSlug: string) => void;
  userEmail?: string | null;
  userId?: string | null;
  displayName?: string | null;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutModal({
  course,
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  userId,
  displayName,
}: CheckoutModalProps) {
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [completed, setCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !course) return null;

  const rawPrice = course.price_inr ?? course.price ?? 999;
  const coursePrice = rawPrice > 0 ? rawPrice : 999;
  const formattedPrice = `₹${coursePrice.toLocaleString("en-IN")}`;

  const markCourseEnrolledLocally = (courseId: string, slug: string) => {
    const ids = [courseId, slug].filter(Boolean);
    if (userId) {
      const localKey = `skillbridge_purchases_${userId}`;
      try {
        const cur: string[] = JSON.parse(localStorage.getItem(localKey) ?? "[]");
        localStorage.setItem(localKey, JSON.stringify(Array.from(new Set([...cur, ...ids]))));
      } catch {
        // ignore
      }
    }
    try {
      const globalCur: string[] = JSON.parse(localStorage.getItem("skillbridge_purchases") ?? "[]");
      localStorage.setItem(
        "skillbridge_purchases",
        JSON.stringify(Array.from(new Set([...globalCur, ...ids]))),
      );
    } catch {
      // ignore
    }
  };

  const handleCompletePayment = async () => {
    if (processing || !course) return;
    setProcessing(true);
    setErrorMsg(null);
    setStatusText("Creating secure Razorpay order…");

    const targetCourseId = course.id || course.slug;
    const learnerName = displayName || userEmail?.split("@")[0] || "Student Learner";
    const learnerEmail = userEmail || "student@skillbridge.edu";

    try {
      const order = await createCourseOrder({
        data: { courseId: targetCourseId, userId: userId || undefined, userEmail: learnerEmail },
      });

      if (!order.isLive || !order.keyId) {
        throw new Error(
          "Razorpay is not configured yet. No payment was taken and the course remains locked.",
        );
      }
      setStatusText("Opening Razorpay secure checkout…");
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error(
          "Razorpay checkout could not load. Please check your connection and try again.",
        );
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Skillbridge",
        description: course.title,
        order_id: order.orderId,
        prefill: { name: learnerName, email: learnerEmail },
        theme: { color: "#4f46e5" },
        handler: async (response: Record<string, string>) => {
          try {
            const verifiedOrderId = response["razorpay_order_id"];
            const verifiedPaymentId = response["razorpay_payment_id"];
            const verifiedSignature = response["razorpay_signature"];
            if (!verifiedOrderId || !verifiedPaymentId || !verifiedSignature) {
              throw new Error(
                "Razorpay returned incomplete payment details. Course access has not been granted.",
              );
            }

            setStatusText("Verifying payment with Razorpay…");
            const verification = await verifyCoursePayment({
              data: {
                courseId: targetCourseId,
                orderId: verifiedOrderId,
                paymentId: verifiedPaymentId,
                signature: verifiedSignature,
                userName: learnerName,
                userEmail: learnerEmail,
              },
            });
            if (!verification.ok) {
              throw new Error("Payment could not be verified. The course remains locked.");
            }

            // The server has verified the HMAC and confirmed a captured payment,
            // then recorded the purchase and enrolled the authenticated student.
            markCourseEnrolledLocally(targetCourseId, course.slug);
            window.dispatchEvent(new CustomEvent("lms_data_updated"));
            setCompleted(true);
            setStatusText(
              verification.isTest
                ? "Test payment verified. Course access unlocked."
                : "Payment verified. Course access unlocked.",
            );
            window.setTimeout(() => {
              onSuccess(targetCourseId, course.slug);
              onClose();
              setCompleted(false);
              setProcessing(false);
              setStatusText("");
            }, 900);
          } catch (error: unknown) {
            setCompleted(false);
            setErrorMsg(
              error instanceof Error
                ? error.message
                : "Payment verification failed. Course access remains locked.",
            );
            setStatusText("");
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setStatusText("");
          },
        },
      });
      razorpay.open();
    } catch (error: unknown) {
      setCompleted(false);
      setErrorMsg(error instanceof Error ? error.message : "Unable to start secure checkout.");
      setStatusText("");
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Lock className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Skillbridge Secure Checkout
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                <ShieldCheck className="size-3.5" />
                <span>256-Bit SSL Encrypted & Verifiable</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Course Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex gap-4 items-center">
            {course.image && (
              <img
                src={course.image}
                alt={course.title}
                className="size-18 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                Course Enrollment
              </span>
              <h3 className="font-extrabold text-slate-900 text-sm leading-snug truncate">
                {course.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Instructor: {course.instructor || "Faculty Author"} · {course.hours || 12} hrs
              </p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-base font-black text-indigo-700">{formattedPrice}</span>
                <span className="text-xs text-slate-400 line-through">
                  ₹{(coursePrice * 2.5).toLocaleString("en-IN")}
                </span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                  60% OFF
                </span>
              </div>
            </div>
          </div>

          {/* Included Features Checklist */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2 text-xs">
            <span className="font-bold text-slate-900 block mb-1">
              Included with your enrollment:
            </span>
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Lifetime full lecture access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Code2 className="size-3.5 text-indigo-600 shrink-0" />
                <span>Code Lab Sandbox & tests</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Brain className="size-3.5 text-purple-600 shrink-0" />
                <span>Smart Recall flashcards</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="size-3.5 text-amber-600 shrink-0" />
                <span>Verifiable certificate</span>
              </div>
            </div>
          </div>

          {/* Payments are processed by the real Razorpay checkout only. */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-950">
              <ExternalLink className="size-4 text-indigo-600" />
              Secure checkout with Razorpay
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Choose UPI, cards, netbanking, or another available payment method inside Razorpay.
              Skillbridge unlocks the course only after the server verifies the signed, captured
              payment.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Lock className="size-3.5" />
              Your payment details are entered on Razorpay, not stored by Skillbridge.
            </div>
          </div>

          {/* Pricing Total Summary */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Course Tuition</span>
              <span className="font-semibold text-slate-800">{formattedPrice}</span>
            </div>
            <div className="flex justify-between">
              <span>Certificate Credential Fee</span>
              <span className="text-emerald-600 font-bold">FREE (₹0)</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-100">
              <span>Total Payable</span>
              <span className="text-indigo-700">{formattedPrice}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex flex-col gap-2">
          {completed ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-white text-xs font-bold shadow-md animate-in zoom-in-95 duration-200">
              <CheckCircle2 className="size-4" />
              <span>{statusText || "Enrollment Verified! Loading curriculum…"}</span>
            </div>
          ) : (
            <Button
              onClick={handleCompletePayment}
              disabled={processing}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{statusText || "Authorizing transaction…"}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  <span>Continue to Razorpay · Pay {formattedPrice}</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          )}

          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 text-center">
            <span>Instant Access</span>
            <span>·</span>
            <span>30-Day Money Back Guarantee</span>
            <span>·</span>
            <span>Verified Credentials</span>
          </div>
        </div>
      </div>
    </div>
  );
}
