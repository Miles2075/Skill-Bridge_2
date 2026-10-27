import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Clock, FileCheck, Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lmsClient, type StudentDashboardData } from "@/lib/lms-client";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  component: StudentAssignmentsPage,
});

function StudentAssignmentsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [solutionNotes, setSolutionNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAssignments = useCallback(async () => {
    try {
      const dashboard = await lmsClient.getStudentDashboard();
      setData(dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
    const refresh = () => void loadAssignments();
    window.addEventListener("focus", refresh);
    window.addEventListener("lms_data_updated", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("lms_data_updated", refresh);
      window.clearInterval(timer);
    };
  }, [loadAssignments]);

  const selected = data?.upcomingAssignments.find((assignment) => assignment.id === selectedId);

  const submit = async () => {
    if (!selected || !data || !user) return;
    setError("");
    setMessage("");
    if (!solutionNotes.trim() && !githubUrl.trim()) {
      setError("Add a solution summary or a GitHub repository URL before submitting.");
      return;
    }
    const course = data.enrolledCourses.find(
      (item) => item.slug === selected.courseSlug || item.title === selected.course,
    );
    if (!course) {
      setError("We could not match this assignment to one of your enrolled courses. Please contact your instructor.");
      return;
    }
    setSubmittingId(selected.id);
    try {
      await lmsClient.submitAssignment({
        assignmentId: selected.id,
        courseId: course.id,
        githubUrl: githubUrl.trim(),
        solutionNotes: solutionNotes.trim(),
        maxScore: selected.maxScore,
        studentName:
          (user.user_metadata?.["display_name"] as string | undefined) ||
          user.email?.split("@")[0] ||
          "Student",
        studentEmail: user.email || "",
      });
      setMessage(`“${selected.title}” was submitted to your instructor for review.`);
      setSelectedId(null);
      setGithubUrl("");
      setSolutionNotes("");
      await loadAssignments();
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  };

  const submitted = data?.upcomingAssignments.filter((a) => a.submissionStatus !== "unsubmitted") ?? [];
  const available = data?.upcomingAssignments.filter((a) => a.submissionStatus === "unsubmitted" || a.submissionStatus === "resubmission_required") ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/student" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <ArrowLeft className="size-4" /> Back to Student Dashboard
        </Link>
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-400">
              <ClipboardList className="size-5" /> STUDENT WORKSPACE
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Assignments</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Assignments published by your instructors for courses you are enrolled in. Submit your work here and track instructor feedback.
            </p>
          </div>
          <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" onClick={() => void loadAssignments()}>
            Refresh assignments
          </Button>
        </div>

        {message && <div role="status" className="mb-5 rounded-lg border border-teal-800 bg-teal-950/50 p-4 text-sm text-teal-200">{message}</div>}
        {error && <div role="alert" className="mb-5 rounded-lg border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-200">{error}</div>}

        {loading ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-8 text-slate-300"><Loader2 className="size-5 animate-spin" /> Loading assignments from your enrolled courses…</div>
        ) : (
          <>
            <section className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Ready to Submit</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{available.length} available</span>
              </div>
              <div className="space-y-3">
                {available.map((assignment) => (
                  <article key={assignment.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-400">{assignment.course}</div>
                        <h3 className="text-lg font-semibold text-white">{assignment.title}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{assignment.description || "Your instructor has not added a description yet."}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Due {assignment.due ? new Date(assignment.due).toLocaleDateString() : "date not set"}</span>
                          <span>Max score: {assignment.maxScore}</span>
                        </div>
                      </div>
                      <Button onClick={() => { setSelectedId(assignment.id); setGithubUrl(""); setSolutionNotes(""); setError(""); }} className="shrink-0 bg-blue-500 text-white hover:bg-blue-600">
                        Submit work <Send className="ml-2 size-4" />
                      </Button>
                    </div>
                    {selectedId === assignment.id && (
                      <div className="mt-5 space-y-3 rounded-lg border border-slate-700 bg-slate-950 p-4">
                        <label className="block text-sm font-medium text-slate-200">GitHub URL (optional)
                          <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/you/project" className="mt-1 border-slate-700 bg-slate-900 text-white" />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">Solution summary / submission notes
                          <Textarea value={solutionNotes} onChange={(e) => setSolutionNotes(e.target.value)} placeholder="Explain what you completed and include any relevant details…" className="mt-1 min-h-24 border-slate-700 bg-slate-900 text-white" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={submittingId === assignment.id} onClick={() => void submit()} className="bg-teal-500 text-slate-950 hover:bg-teal-400">
                            {submittingId === assignment.id ? <><Loader2 className="mr-2 size-4 animate-spin" /> Submitting…</> : "Send to Instructor"}
                          </Button>
                          <Button variant="outline" onClick={() => setSelectedId(null)} className="border-slate-700 text-slate-200">Cancel</Button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                {available.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No assignments waiting for submission. New assignments published for your enrolled courses will appear here.</div>}
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Submitted Work & Instructor Feedback</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{submitted.length} submitted</span>
              </div>
              <div className="space-y-3">
                {submitted.map((assignment) => (
                  <article key={assignment.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-400">{assignment.course}</div>
                        <h3 className="font-semibold text-white">{assignment.title}</h3>
                      </div>
                      <span className="rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-300">{assignment.submissionStatus === "approved" ? "Approved" : assignment.submissionStatus === "resubmission_required" ? "Revision requested" : "Under instructor review"}</span>
                    </div>
                    {assignment.score !== null && <p className="mt-3 text-sm text-slate-300">Score: {assignment.score}/{assignment.maxScore}</p>}
                    {assignment.feedback && <p className="mt-2 rounded-lg bg-slate-950 p-3 text-sm text-slate-300">Instructor feedback: {assignment.feedback}</p>}
                    {assignment.submittedAt && <p className="mt-3 text-xs text-slate-500">Submitted {new Date(assignment.submittedAt).toLocaleString()}</p>}
                  </article>
                ))}
                {submitted.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Your submitted assignments and instructor feedback will appear here.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
