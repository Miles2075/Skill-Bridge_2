import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  Calendar,
  Sparkles,
  Flame,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

// Generate realistic progress timeline based on current progress
function generateWeeklyProgressTimeline(courses: CourseItem[]) {
  const weeks = ["W1 (Aug)", "W2 (Aug)", "W3 (Sep)", "W4 (Sep)", "W5 (Oct)", "W6 (Current)"];

  return weeks.map((week, idx) => {
    const factor = (idx + 1) / weeks.length;
    const entry: Record<string, string | number> = { week };

    let totalCumulative = 0;
    courses.forEach((c) => {
      // Calculate progressive growth curve towards current course progress
      const currentProg = c.progress || 0;
      const weekVal = Math.round(currentProg * Math.pow(factor, 1.2));
      entry[c.slug || c.title] = weekVal;
      totalCumulative += weekVal;
    });

    entry["avgProgress"] = courses.length > 0 ? Math.round(totalCumulative / courses.length) : 0;
    return entry;
  });
}

const WEEKLY_STUDY_HOURS = [
  { day: "Mon", video: 1.5, practice: 1.0, quiz: 0.5, total: 3.0 },
  { day: "Tue", video: 2.0, practice: 1.5, quiz: 0.0, total: 3.5 },
  { day: "Wed", video: 1.0, practice: 2.5, quiz: 0.8, total: 4.3 },
  { day: "Thu", video: 2.5, practice: 1.0, quiz: 0.5, total: 4.0 },
  { day: "Fri", video: 1.8, practice: 2.0, quiz: 1.0, total: 4.8 },
  { day: "Sat", video: 3.5, practice: 3.0, quiz: 1.5, total: 8.0 },
  { day: "Sun", video: 2.8, practice: 2.2, quiz: 1.0, total: 6.0 },
];

const SKILL_RADAR_DATA = [
  { subject: "TypeScript & Types", score: 88, fullMark: 100 },
  { subject: "React & Architecture", score: 75, fullMark: 100 },
  { subject: "System Design & Scale", score: 92, fullMark: 100 },
  { subject: "DSA & Algorithms", score: 80, fullMark: 100 },
  { subject: "Testing & CodeLab", score: 85, fullMark: 100 },
  { subject: "Spaced Recall", score: 90, fullMark: 100 },
];

const QUIZ_PERFORMANCE_HISTORY = [
  { topic: "Type Narrowing", score: 90, classAvg: 76 },
  { topic: "Generics & Infer", score: 85, classAvg: 70 },
  { topic: "React Profiling", score: 78, classAvg: 68 },
  { topic: "Load Balancing", score: 95, classAvg: 81 },
  { topic: "Cache Invalidation", score: 88, classAvg: 74 },
  { topic: "Hash Map / DSA", score: 92, classAvg: 79 },
];

const COURSE_COLORS: Record<string, string> = {
  "advanced-typescript": "#6366f1", // Indigo
  "react-performance": "#06b6d4", // Cyan
  "system-design": "#8b5cf6", // Purple
  dsa: "#f59e0b", // Amber
};

export function AnalyticsView({
  courses = [],
  overallProgress = 0,
  studentName = "Learner",
}: AnalyticsViewProps) {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("30d");

  const effectiveCourses =
    courses.length > 0
      ? courses
      : [
          {
            slug: "advanced-typescript",
            title: "Advanced TypeScript",
            progress: 65,
            lessonsDone: 2,
            lessonsTotal: 3,
            hours: 18,
          },
          {
            slug: "react-performance",
            title: "React Performance",
            progress: 40,
            lessonsDone: 1,
            lessonsTotal: 3,
            hours: 16,
          },
          {
            slug: "system-design",
            title: "System Design",
            progress: 80,
            lessonsDone: 2,
            lessonsTotal: 3,
            hours: 20,
          },
          {
            slug: "dsa",
            title: "Data Structures & DSA",
            progress: 30,
            lessonsDone: 1,
            lessonsTotal: 3,
            hours: 26,
          },
        ];

  const totalLessonsDone = effectiveCourses.reduce((acc, c) => acc + (c.lessonsDone || 0), 0);
  const totalHoursInvested = effectiveCourses.reduce(
    (acc, c) => acc + Math.round((c.hours * (c.progress || 0)) / 100),
    0,
  );
  const progressTimelineData = generateWeeklyProgressTimeline(effectiveCourses);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/30 mb-3">
              <BarChart3 className="size-3.5 text-indigo-400" />
              <span>Real-Time Analytics & Learning Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Learning Analytics & Progress Trajectory
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
              Visualizing lecture completion curves, weekly study hours, quiz mastery, and topic
              retention for {studentName}.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl backdrop-blur-md border border-white/10 self-start md:self-auto">
            {(["7d", "30d", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  timeframe === t
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                }`}
              >
                {t === "7d" ? "Past Week" : t === "30d" ? "Past 30 Days" : "All Time"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Overall Completion
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">{overallProgress}%</span>
              <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                +12% vs last month
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Across all enrolled modules</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Study Hours Invested
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">{totalHoursInvested} hrs</span>
              <span className="text-xs font-bold text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                ~4.8h/day avg
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Video lectures + practice labs</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Modules Completed
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">{totalLessonsDone}</span>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                Active Streak 🔥
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Verified curriculum lessons</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Quiz Average Score
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Target className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">88%</span>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                Top 10%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Knowledge checks passed</p>
          </div>
        </div>
      </div>

      {/* CHART 1: Course Progress Over Time (Recharts Area / Line Chart) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-foreground">
                Course Completion Progress Over Time
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Weekly trajectory percentage for each enrolled software engineering track.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            {effectiveCourses.map((c) => {
              const color = COURSE_COLORS[c.slug] || "#6366f1";
              return (
                <div key={c.slug} className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-muted-foreground">{c.title.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recharts Area Chart Container */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={progressTimelineData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorReact" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#888888" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#888888" unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  borderColor: "rgba(99, 102, 241, 0.3)",
                  borderRadius: "0.75rem",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
                }}
                formatter={(val: unknown) => [`${val}%`, "Completion"]}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />

              <Area
                type="monotone"
                dataKey="avgProgress"
                name="Overall Average"
                stroke="#6366f1"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAvg)"
              />

              {effectiveCourses.map((c) => {
                const color = COURSE_COLORS[c.slug] || "#8b5cf6";
                return (
                  <Line
                    key={c.slug}
                    type="monotone"
                    dataKey={c.slug || c.title}
                    name={c.title}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: color }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-Column Charts: Weekly Study Hours + Skill Competency Radar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CHART 2: Weekly Study Breakdown (Stacked Bar Chart) */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="font-bold text-base text-foreground">Weekly Activity Breakdown</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hours spent per day on video lectures, hands-on labs, and quizzes.
              </p>
            </div>
            <span className="text-xs font-bold text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 px-2.5 py-1 rounded-full border border-cyan-200 dark:border-cyan-800">
              30.6 Hours Total
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={WEEKLY_STUDY_HOURS}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#888888" />
                <YAxis tick={{ fontSize: 11 }} stroke="#888888" unit="h" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(6, 182, 212, 0.3)",
                    borderRadius: "0.75rem",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val: unknown) => [`${val} hours`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar
                  dataKey="video"
                  name="Video Lectures"
                  stackId="a"
                  fill="#6366f1"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="practice"
                  name="Code Lab & Practice"
                  stackId="a"
                  fill="#06b6d4"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="quiz"
                  name="Assessments & Recall"
                  stackId="a"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: Skill Competency Radar Chart */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="size-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-base text-foreground">Skill Mastery Profile</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Competency evaluation derived from coding exercises and quizzes.
              </p>
            </div>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
              Level 4 Engineer
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={SKILL_RADAR_DATA}>
                <PolarGrid stroke="#888888" opacity={0.2} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#888888" }} />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fontSize: 9 }}
                  stroke="#888888"
                />
                <Radar
                  name="Student Mastery"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.4}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(139, 92, 246, 0.3)",
                    borderRadius: "0.75rem",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val: unknown) => [`${val}%`, "Mastery"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CHART 4: Quiz & Assessment Scores Comparison Bar Chart */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Award className="size-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-base text-foreground">
                Assessment Performance vs Peer Class Average
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparison of your scores against the class average across technical topics.
            </p>
          </div>
        </div>

        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={QUIZ_PERFORMANCE_HISTORY}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis dataKey="topic" tick={{ fontSize: 11 }} stroke="#888888" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#888888" unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  borderColor: "rgba(245, 158, 11, 0.3)",
                  borderRadius: "0.75rem",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(val: unknown) => [`${val}%`, "Score"]}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="score" name="Your Score" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="classAvg" name="Cohort Average" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Individual Course Completion Cards with Progress Bar */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-foreground">Detailed Track Progress</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {effectiveCourses.map((course) => (
            <div
              key={course.slug}
              className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground truncate max-w-[200px]">
                  {course.title}
                </span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                  {course.progress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>
                  {Math.min(course.lessonsDone, course.lessonsTotal || 3)} of{" "}
                  {course.lessonsTotal || 3} Lessons Done
                </span>
                <span>{course.hours} Total Hours</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
