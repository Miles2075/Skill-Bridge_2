import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { BarChart3, BookOpen, CheckCircle2, Clock, Target, TrendingUp } from "lucide-react";

interface CourseItem {
  id?: string;
  slug: string;
  title: string;
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  hours: number;
  category?: string;
}

interface AnalyticsViewProps {
  courses?: CourseItem[];
  overallProgress?: number;
  studentName?: string;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function AnalyticsView({
  courses = [],
  overallProgress = 0,
  studentName = "Learner",
}: AnalyticsViewProps) {
  const validCourses = courses.filter((course) => Boolean(course.id || course.slug));
  const lessonsDone = validCourses.reduce((sum, course) => sum + Math.max(0, course.lessonsDone || 0), 0);
  const lessonsTotal = validCourses.reduce((sum, course) => sum + Math.max(0, course.lessonsTotal || 0), 0);
  const completedCourses = validCourses.filter((course) => clampPercent(course.progress) >= 100).length;
  const chartData = validCourses.map((course) => ({
    course: course.title?.trim() || "Untitled course",
    progress: clampPercent(course.progress),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold mb-3">
          <BarChart3 className="size-4" /> LEARNING ANALYTICS
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Learning progress</h1>
        <p className="mt-2 text-sm text-indigo-100/80">
          Progress shown here is based on the enrolled courses currently returned for {studentName}.
          Study-time tracking, quiz averages, and peer rankings are not shown unless verified records are available.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={TrendingUp} label="Overall completion" value={`${clampPercent(overallProgress)}%`} detail="Reported by your course dashboard" />
        <Metric icon={BookOpen} label="Enrolled courses" value={String(validCourses.length)} detail="Courses in your current enrollment" />
        <Metric icon={CheckCircle2} label="Lessons completed" value={String(lessonsDone)} detail={lessonsTotal > 0 ? `Out of ${lessonsTotal} lessons listed` : "Lesson totals are not available"} />
        <Metric icon={Target} label="Courses completed" value={String(completedCourses)} detail="Courses at 100% progress" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <TrendingUp className="size-5 text-indigo-600" />
          <div>
            <h2 className="text-lg font-bold">Course completion progress</h2>
            <p className="text-xs text-muted-foreground">Current saved progress for each enrolled course. This is not a historical timeline.</p>
          </div>
        </div>
        {chartData.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="course" tick={{ fontSize: 11 }} stroke="#888888" interval={0} angle={-12} textAnchor="end" height={55} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#888888" unit="%" />
                <Tooltip formatter={(value: unknown) => [`${value}%`, "Completion"]} />
                <Bar dataKey="progress" name="Completion" fill="#6366f1" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No enrolled-course progress is available yet. Enroll in a course and complete lessons to see progress here." />
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <BookOpen className="size-5 text-indigo-600" />
          <div>
            <h2 className="text-lg font-bold">Course details</h2>
            <p className="text-xs text-muted-foreground">Progress and lesson counts from your current enrollment data.</p>
          </div>
        </div>
        {validCourses.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {validCourses.map((course) => {
              const progress = clampPercent(course.progress);
              const total = Math.max(0, course.lessonsTotal || 0);
              const done = Math.max(0, course.lessonsDone || 0);
              return (
                <div key={course.id || course.slug} className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold text-sm text-foreground">{course.title?.trim() || "Untitled course"}</span>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>{total > 0 ? `${Math.min(done, total)} of ${total} lessons completed` : "Lesson count unavailable"}</span>
                    <span>{progress >= 100 ? "Completed" : progress > 0 ? "In progress" : "Not started"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="Your enrolled courses will appear here once enrollment data is available." />
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-border p-5">
        <div className="flex items-center gap-2 font-bold text-sm"><Clock className="size-4" /> Metrics not yet verified</div>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Total study hours, daily activity, skill mastery scores, quiz averages, month-over-month change,
          streaks, and class rankings are intentionally not fabricated. They need persisted study-session
          and assessment records before they can be reported accurately.
        </p>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof TrendingUp; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"><Icon className="size-4" /></div>
      </div>
      <div>
        <div className="text-3xl font-black tracking-tight">{value}</div>
        <p className="text-[11px] text-muted-foreground mt-1">{detail}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{message}</div>;
}
