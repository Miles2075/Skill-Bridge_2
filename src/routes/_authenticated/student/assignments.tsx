import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, LoaderCircle, RefreshCw } from "lucide-react";
import { lmsClient, type StudentDashboardData } from "@/lib/lms-client";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  component: StudentAssignmentsPage,
});

function StudentAssignmentsPage() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const loadAssignments = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const dashboard = await lmsClient.getStudentDashboard();
      setData(dashboard);
      setMessage(null);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Could not load assignments. Please sign in again and retry.",
        error: true,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
    const refresh = () => void loadAssignments(true);
    window.addEventListener("focus", refresh);
    window.addEventListener("lms_data_updated", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("lms_data_updated", refresh);
      window.clearInterval(timer);
    };
  }, [loadAssignments]);

  const submit = async (assignment: StudentDashboardData["upcomingAssignments"][number]) => {
    if (!data) return;
    const solutionNotes = (notes[assignment.id] || "").trim();
    if (!solutionNotes) {
      setMessage({ text: "Add a short summary of your solution before submitting.", error: true });
      return;
    }
    const course = data.enrolledCourses.find(
      (item) => item.slug === assignment.courseSlug || item.title === assignment.course,
    );
    if (!course) {
      setMessage({ text: "This assignment is not linked to one of your enrolled courses. Please contact your instructor.", error: true });
      return;
    }
    setSubmittingId(assignment.id);
    setMessage(null);
    try {
      await lmsClient.submitAssignment({
        assignmentId: assignment.id,
        courseId: course.id,
        githubUrl: (urls[assignment.id] || "").trim(),
        solutionNotes,
        maxScore: assignment.maxScore,
      });
      setMessage({ text: "Your work was submitted to your instructor for review." });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
      await loadAssignments(true);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Submission failed. Please try again.", error: true });
    } finally {
      setSubmittingId(null);
    }
  };

  const assignments = data?.upcomingAssignments || [];
  const ready = assignments.filter((item) => item.submissionStatus === "unsubmitted" || item.submissionStatus === "resubmission_required");
  const submitted = assignments.filter((item) => item.submissionStatus === "pending" || item.submissionStatus === "approved");

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><ClipboardList className="size-4" /> STUDENT WORKSPACE</p>
            <h1 className="text-3xl font-bold tracking-tight">My Assignments</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Assignments published by your instructors for courses you are enrolled in. Submit your work here and track instructor feedback.</p>
          </div>
          <button type="button" onClick={() => void loadAssignments(true)} disabled={refreshing} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60">
            {refreshing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh assignments
          </button>
        </header>

        {message && (
          <div role="status" className={`flex items-start gap-2 rounded-lg border p-4 text-sm ${message.error ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
            {message.error ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-border p-12 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Loading assignments from your courses…</div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Ready to Submit</h2><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{ready.length} available</span></div>
              {ready.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{assignments.length === 0 ? "No published assignments were found for your enrolled courses yet. When your instructor publishes an assignment for a course you are enrolled in, it will appear here." : "You're all caught up. There are no assignments waiting for submission."}</div>
              ) : ready.map((assignment) => (
                <article key={assignment.id} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div><h3 className="text-lg font-semibold">{assignment.title}</h3><p className="mt-1 text-sm text-muted-foreground">{assignment.course}</p></div>
                    <span className="w-fit rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300">{assignment.submissionStatus === "resubmission_required" ? "Revision requested" : "Not submitted"}</span>
                  </div>
                  {assignment.description && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{assignment.description}</p>}
                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><span>Due: {assignment.due ? new Date(assignment.due).toLocaleDateString() : "No deadline specified"}</span><span>Maximum score: {assignment.maxScore}</span></div>
                  <label className="block space-y-1.5 text-sm font-medium">Solution summary <span className="text-red-500">*</span>
                    <textarea value={notes[assignment.id] || ""} onChange={(event) => setNotes((prev) => ({ ...prev, [assignment.id]: event.target.value }))} rows={3} placeholder="Explain what you built and how it works…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <label className="block space-y-1.5 text-sm font-medium">GitHub / repository URL <span className="font-normal text-muted-foreground">(optional)</span>
                    <input type="url" value={urls[assignment.id] || ""} onChange={(event) => setUrls((prev) => ({ ...prev, [assignment.id]: event.target.value }))} placeholder="https://github.com/…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" />
                  </label>
                  <button type="button" onClick={() => void submit(assignment)} disabled={submittingId !== null} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                    {submittingId === assignment.id && <LoaderCircle className="size-4 animate-spin" />} Submit for instructor review
                  </button>
                </article>
              ))}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Submitted Work & Instructor Feedback</h2><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{submitted.length} submitted</span></div>
              {submitted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Your submitted assignments, grades, and instructor feedback will appear here.</div>
              ) : submitted.map((assignment) => (
                <article key={assignment.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h3 className="font-semibold">{assignment.title}</h3><p className="mt-1 text-sm text-muted-foreground">{assignment.course}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${assignment.submissionStatus === "approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{assignment.submissionStatus === "approved" ? "Reviewed" : "Awaiting instructor review"}</span></div>
                  {assignment.submittedAt && <p className="mt-2 text-xs text-muted-foreground">Submitted {new Date(assignment.submittedAt).toLocaleString()}</p>}
                  {assignment.score !== null && <p className="mt-3 text-sm font-semibold">Score: {assignment.score} / {assignment.maxScore}</p>}
                  {assignment.feedback && <div className="mt-3 rounded-lg bg-muted p-3 text-sm"><p className="mb-1 font-semibold">Instructor feedback</p><p className="whitespace-pre-wrap">{assignment.feedback}</p></div>}
                  {assignment.submissionStatus === "pending" && <p className="mt-3 text-sm italic text-muted-foreground">Your instructor has received the submission and will provide feedback after review.</p>}
                  {assignment.submissionStatus === "approved" && <CheckCircle2 className="mt-3 size-5 text-emerald-600" />}
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
