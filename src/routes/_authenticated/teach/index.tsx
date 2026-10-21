import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ChevronDown,
  ExternalLink,
  FilePlus,
  FolderKanban,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MessageSquare,
  PlusCircle,
  Pencil,
  Save,
  Search,
  Settings,
  Target,
  TrendingUp,
  User,
  Users,
  Upload,
  Loader2,
  Film,
  Trash2,
  X,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileEditor } from "@/components/ProfileEditor";
import { UserAvatar } from "@/components/UserAvatar";
import { ProfileModal } from "@/components/ProfileModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lmsClient } from "@/lib/lms-client";
import {
  type AssignmentSubmission,
  type EnrolledStudent,
  type VideoComment,
  type Quiz,
  type QuizAttempt,
  type AssignmentDefinition,
  type CourseLesson,
  getVideoComments,
  replyToComment,
} from "@/lib/lms-store";
import { CodeLabView } from "@/components/student/CodeLabView";
import { RecallDecksView } from "@/components/student/RecallDecksView";
import { FocusStudioView } from "@/components/student/FocusStudioView";

export const Route = createFileRoute("/_authenticated/teach/")({
  component: TeachDashboardPage,
});

type InstructorNavView =
  | "dashboard"
  | "courses"
  | "create-course"
  | "content"
  | "assignments"
  | "assessments"
  | "codelab"
  | "recall"
  | "focus"
  | "students"
  | "submissions"
  | "analytics"
  | "profile"
  | "settings";

export const PRESET_THUMBNAILS = [
  {
    label: "TypeScript & JS",
    url: "https://images.unsplash.com/photo-1516116211223-4c7141326c65?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "React & Frontend",
    url: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "System Design & Cloud",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Data Structures & Algos",
    url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "AI & Neural Networks",
    url: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80",
  },
  {
    label: "Mobile & DevOps",
    url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=80",
  },
];

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  teacher_id: string | null;
  price_inr: number;
  preview_minutes: number;
  video_url: string;
  video_urls?: string[];
  thumbnail?: string;
  hours?: number;
  status?: "published" | "draft" | "review";
};

const DEFAULT_COURSES: CourseRow[] = [
  {
    id: "c-ts",
    slug: "advanced-typescript",
    title: "Advanced TypeScript & Design Patterns",
    teacher_id: null,
    price_inr: 1299,
    preview_minutes: 5,
    thumbnail: PRESET_THUMBNAILS[0].url,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    video_urls: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    ],
    hours: 18.5,
    status: "published",
  },
  {
    id: "c-react",
    slug: "react-performance",
    title: "React Performance & Architecture",
    teacher_id: null,
    price_inr: 1499,
    preview_minutes: 5,
    thumbnail: PRESET_THUMBNAILS[1].url,
    video_url:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    video_urls: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    ],
    hours: 14.0,
    status: "published",
  },
  {
    id: "c-sys",
    slug: "system-design",
    title: "System Design Fundamentals",
    teacher_id: null,
    price_inr: 999,
    preview_minutes: 5,
    thumbnail: PRESET_THUMBNAILS[2].url,
    video_url:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    video_urls: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    ],
    hours: 22.0,
    status: "published",
  },
  {
    id: "c-dsa",
    slug: "dsa",
    title: "Data Structures & Algorithms",
    teacher_id: null,
    price_inr: 799,
    preview_minutes: 5,
    thumbnail: PRESET_THUMBNAILS[3].url,
    video_url:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    video_urls: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    ],
    hours: 26.5,
    status: "published",
  },
  {
    id: "4c74ff05-54da-4395-bcda-689b1649443d",
    slug: "1",
    title: "1",
    teacher_id: "8d95e694-3d47-422e-a017-86a1a0ee1251",
    price_inr: 999,
    preview_minutes: 5,
    thumbnail: PRESET_THUMBNAILS[0].url,
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    video_urls: [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    ],
    hours: 16.0,
    status: "published",
  },
];

interface LessonItem {
  id: string;
  courseSlug: string;
  title: string;
  duration: string;
  videoUrl: string;
  isPreview: boolean;
}

function titleFromVideoFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "";
  const readable = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return readable || "Untitled video";
}

function titleFromVideoUrl(url: string, index = 0): string {
  try {
    const fileName = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    const title = titleFromVideoFileName(fileName);
    return title && title !== "Untitled video" ? title : `Video ${index + 1}`;
  } catch {
    return `Video ${index + 1}`;
  }
}

const DEFAULT_LESSONS: LessonItem[] = [
  {
    id: "les-1",
    courseSlug: "advanced-typescript",
    title: "Course Overview & Project Setup",
    duration: "12m",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    isPreview: true,
  },
  {
    id: "les-2",
    courseSlug: "advanced-typescript",
    title: "Advanced Generic Constraints & Type Mappings",
    duration: "28m",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    isPreview: false,
  },
  {
    id: "les-3",
    courseSlug: "advanced-typescript",
    title: "Distributive Conditional Types & Infer",
    duration: "34m",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    isPreview: false,
  },
  {
    id: "les-4",
    courseSlug: "system-design",
    title: "Scale from Zero to 10M Users",
    duration: "25m",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    isPreview: true,
  },
  {
    id: "les-5",
    courseSlug: "system-design",
    title: "Database Sharding & Consistent Hashing",
    duration: "42m",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    isPreview: false,
  },
  {
    id: "les-6",
    courseSlug: "react-performance",
    title: "React Profiler & Flamegraphs Deep Dive",
    duration: "30m",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    isPreview: true,
  },
];

function TeachDashboardPage() {
  const { user, isTeacher, isAdmin } = useAuth();
  const displayName =
    (user?.user_metadata?.["display_name"] as string) ||
    user?.email?.split("@")[0] ||
    "Faculty Lead";

  // URL-synced view state
  const [currentView, setCurrentView] = useState<InstructorNavView>("dashboard");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("view") as InstructorNavView;
      if (p) setCurrentView(p);
    }

    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search).get("view") as InstructorNavView;
      setCurrentView(p || "dashboard");
    };
    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<{ view: InstructorNavView }>;
      if (custom.detail?.view) {
        setCurrentView(custom.detail.view);
      }
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("teach_view_changed", handleCustomChange);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("teach_view_changed", handleCustomChange);
    };
  }, []);

  const switchView = (v: InstructorNavView) => {
    setCurrentView(v);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", v);
      window.history.pushState({}, "", url.toString());
      window.dispatchEvent(new CustomEvent("teach_view_changed", { detail: { view: v } }));
    }
  };

  // State
  const [rows, setRows] = useState<CourseRow[]>(DEFAULT_COURSES);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [assignmentDefs, setAssignmentDefs] = useState<AssignmentDefinition[]>([]);
  const [msg, setMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);

  // Filters
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "pending" | "approved">("all");
  const [selectedContentCourse, setSelectedContentCourse] = useState("advanced-typescript");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState("");
  // Per-course title editor for the student-facing videos in Course Portfolio.
  const [videoTitleEditorCourse, setVideoTitleEditorCourse] = useState<string | null>(null);
  const [videoTitleLessons, setVideoTitleLessons] = useState<Record<string, LessonItem[]>>({});
  const [videoTitleDrafts, setVideoTitleDrafts] = useState<Record<string, string>>({});
  const [loadingVideoTitleCourse, setLoadingVideoTitleCourse] = useState<string | null>(null);
  const [savingVideoTitleId, setSavingVideoTitleId] = useState<string | null>(null);

  // Grading modal state
  const [gradingSub, setGradingSub] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(95);
  const [gradeStatus, setGradeStatus] = useState<"approved" | "needs_revision">("approved");
  const [gradeFeedback, setGradeFeedback] = useState<string>("");

  // Create Course Form State
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPrice, setNewPrice] = useState(999);
  const [newPreview, setNewPreview] = useState(5);
  const [newHours, setNewHours] = useState(16);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoFiles, setNewVideoFiles] = useState<File[]>([]);
  const [newVideoTitles, setNewVideoTitles] = useState<string[]>([]);
  const [newVideoUrls, setNewVideoUrls] = useState<string[]>([]);
  const [newUrlInput, setNewUrlInput] = useState("");
  const [isUploadingCourseVideo, setIsUploadingCourseVideo] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<"published" | "draft">("published");
  const [newThumbnail, setNewThumbnail] = useState<string>(PRESET_THUMBNAILS[0].url);
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null);

  const handleThumbnailFileChange = (file: File, onSuccess: (dataUrl: string) => void) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ text: "Image file is too large (max 10MB)", isError: true });
      return;
    }

    // Store a compact thumbnail instead of a large original image data URL.
    // Large base64 thumbnails can make course-update requests exceed Vercel's
    // request-body limit and return HTTP 413.
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDimension = 1200;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        setMsg({ text: "Could not process this image. Please choose another file.", isError: true });
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setMsg({ text: "Could not compress this image. Please choose another file.", isError: true });
            return;
          }
          if (blob.size > 900 * 1024) {
            setMsg({ text: "Image is still too large after compression. Please choose a smaller image.", isError: true });
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") onSuccess(reader.result);
          };
          reader.onerror = () => {
            setMsg({ text: "Could not read the processed image.", isError: true });
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.78,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setMsg({ text: "This image could not be opened. Please choose another file.", isError: true });
    };
    image.src = objectUrl;
  };

  // Per-row additional URL input state in Courses management table
  const [rowNewUrls, setRowNewUrls] = useState<Record<string, string>>({});

  // Create Assignment Form State
  const [newAsgTitle, setNewAsgTitle] = useState("");
  const [newAsgCourse, setNewAsgCourse] = useState("advanced-typescript");
  const [newAsgDue, setNewAsgDue] = useState("2026-11-01");
  const [newAsgMaxScore, setNewAsgMaxScore] = useState(100);
  const [newAsgDesc, setNewAsgDesc] = useState("");

  // Create Quiz Form State
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizCourse, setNewQuizCourse] = useState("advanced-typescript");
  const [newQuizDuration, setNewQuizDuration] = useState(15);
  const [newQuizPass, setNewQuizPass] = useState(80);
  const [newQuizDesc, setNewQuizDesc] = useState("");
  const [newQText, setNewQText] = useState("");
  const [newQOpt1, setNewQOpt1] = useState("");
  const [newQOpt2, setNewQOpt2] = useState("");
  const [newQOpt3, setNewQOpt3] = useState("");
  const [newQOpt4, setNewQOpt4] = useState("");
  const [newQCorrect, setNewQCorrect] = useState(0);

  // Add Lesson State
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDuration, setNewLessonDuration] = useState("20m");
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState("");
  const [newLessonVideoFile, setNewLessonVideoFile] = useState<File | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [newLessonOrder, setNewLessonOrder] = useState<number>(0);
  const [newLessonRequired, setNewLessonRequired] = useState(true);
  const [newLessonPreview, setNewLessonPreview] = useState(false);

  // Load Data
  const loadInstructorData = async () => {
    try {
      const data = await lmsClient.getInstructorData();
      if (data.courses?.length > 0) {
        setRows(
          (data.courses as CourseRow[]).map((c) => ({
            ...c,
            thumbnail: c.thumbnail || PRESET_THUMBNAILS[0].url,
            video_urls:
              c.video_urls && Array.isArray(c.video_urls) && c.video_urls.length > 0
                ? c.video_urls
                : c.video_url
                  ? [c.video_url]
                  : [],
            video_url: c.video_url || (c.video_urls && c.video_urls[0]) || "",
          })),
        );
      }
      setStudents(data.students as unknown as EnrolledStudent[]);
      // The API returns persisted DB rows in snake_case; normalize them once at the
      // boundary so the instructor UI, counts, and grading actions use real values.
      setSubmissions(
        (data.submissions || []).map((raw: Record<string, unknown>) => ({
          id: String(raw.id || ""),
          courseSlug: String(raw.courseSlug || raw.course_slug || ""),
          courseTitle: String(raw.courseTitle || raw.course_title || "Course"),
          assignmentId: String(raw.assignmentId || raw.assignment_id || ""),
          assignmentTitle: String(raw.assignmentTitle || raw.assignment_title || "Assignment"),
          studentId: String(raw.studentId || raw.student_id || ""),
          studentName: String(raw.studentName || raw.student_name || "Student"),
          studentEmail: String(raw.studentEmail || raw.student_email || ""),
          githubUrl: String(raw.githubUrl || raw.github_url || ""),
          solutionNotes: String(raw.solutionNotes || raw.solution_notes || ""),
          submittedAt: String(raw.submittedAt || raw.submitted_at || ""),
          status:
            raw.status === "resubmission_required"
              ? "needs_revision"
              : raw.status === "reviewed"
                ? "approved"
                : (raw.status as AssignmentSubmission["status"]) || "pending",
          score: typeof raw.score === "number" ? raw.score : undefined,
          maxScore: Number(raw.maxScore ?? raw.max_score ?? 100),
          feedback: typeof raw.feedback === "string" ? raw.feedback : undefined,
          gradedAt: String(raw.gradedAt || raw.graded_at || "") || undefined,
          gradedBy: String(raw.gradedBy || raw.graded_by || "") || undefined,
          studentAvatar: String(raw.studentAvatar || raw.avatar_url || "") || undefined,
        })) as AssignmentSubmission[],
      );
      setQuizzes(data.quizzes as unknown as Quiz[]);
      setAssignmentDefs(
        (data.assignments || []).map((raw: Record<string, unknown>) => ({
          id: String(raw.id || ""),
          courseSlug: String(raw.courseSlug || raw.course_slug || ""),
          courseTitle: String(raw.courseTitle || raw.course_title || "Course"),
          title: String(raw.title || "Assignment"),
          description: String(raw.description || ""),
          dueDate: String(raw.dueDate || raw.due_date || ""),
          maxScore: Number(raw.maxScore ?? raw.max_score ?? 100),
          submissionCount: (data.submissions || []).filter(
            (submission: Record<string, unknown>) =>
              (submission.assignmentId || submission.assignment_id) === raw.id,
          ).length,
        })) as AssignmentDefinition[],
      );
    } catch (e) {
      console.error("Failed to load instructor data:", e);
    }
  };

  const loadLessons = async (slug: string) => {
    try {
      const { lessons: courseLessons } = await lmsClient.getCourse(slug);
      if (courseLessons?.length > 0) {
        setLessons(
          courseLessons.map((l) => ({
            id: l.id,
            courseSlug: slug,
            title: l.title,
            duration: l.duration,
            videoUrl: l.video_url,
            isPreview: l.is_preview,
          })),
        );
      } else {
        setLessons([]);
      }
    } catch {
      setLessons([]);
    }
  };

  const toggleRowVideoTitleEditor = async (row: CourseRow) => {
    if (videoTitleEditorCourse === row.id) {
      setVideoTitleEditorCourse(null);
      return;
    }

    setLoadingVideoTitleCourse(row.id);
    setMsg(null);
    try {
      // Load persistent lesson records by course ID, so duplicate course slugs
      // cannot cause a teacher to rename another course's video.
      const { lessons: courseLessons } = await lmsClient.getCourse(row.id);
      const loadedLessons: LessonItem[] = (courseLessons || [])
        .filter((lesson) => Boolean(lesson.video_url))
        .map((lesson) => ({
          id: lesson.id,
          courseSlug: row.slug,
          title: lesson.title,
          duration: lesson.duration,
          videoUrl: lesson.video_url,
          isPreview: lesson.is_preview,
        }));

      setVideoTitleLessons((previous) => ({ ...previous, [row.id]: loadedLessons }));
      setVideoTitleDrafts((previous) => ({
        ...previous,
        ...Object.fromEntries(loadedLessons.map((lesson) => [lesson.id, lesson.title])),
      }));
      setVideoTitleEditorCourse(row.id);
      if (loadedLessons.length === 0) {
        setMsg({ text: `No uploaded video lessons found for "${row.title}". Upload a video first.`, isError: true });
      }
    } catch (error) {
      setMsg({
        text: error instanceof Error ? error.message : "Could not load video titles.",
        isError: true,
      });
    } finally {
      setLoadingVideoTitleCourse(null);
    }
  };

  const saveRowVideoTitle = async (rowId: string, lesson: LessonItem) => {
    const title = (videoTitleDrafts[lesson.id] || "").trim();
    if (!title) {
      setMsg({ text: "Enter a video title before saving.", isError: true });
      return;
    }

    setSavingVideoTitleId(lesson.id);
    setMsg(null);
    try {
      const { lesson: savedLesson } = await lmsClient.updateLesson(lesson.id, { title });
      setVideoTitleLessons((previous) => ({
        ...previous,
        [rowId]: (previous[rowId] || []).map((item) =>
          item.id === lesson.id ? { ...item, title: savedLesson.title } : item,
        ),
      }));
      setVideoTitleDrafts((previous) => ({ ...previous, [lesson.id]: savedLesson.title }));
      setLessons((previous) =>
        previous.map((item) =>
          item.id === lesson.id ? { ...item, title: savedLesson.title } : item,
        ),
      );
      setMsg({ text: `Saved video title: "${savedLesson.title}". Students will see this name in the course player.` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (error) {
      setMsg({
        text: error instanceof Error ? error.message : "Could not save video title.",
        isError: true,
      });
    } finally {
      setSavingVideoTitleId(null);
    }
  };

  useEffect(() => {
    loadInstructorData();
    loadLessons(selectedContentCourse);

    const handleUpdate = () => {
      loadInstructorData();
      loadLessons(selectedContentCourse);
    };
    window.addEventListener("lms_data_updated", handleUpdate);
    return () => {
      window.removeEventListener("lms_data_updated", handleUpdate);
    };
  }, [selectedContentCourse]);

  // Handlers
  const updateRow = (id: string, patch: Partial<CourseRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  // Save cover changes immediately. Previously the preview changed locally,
  // but the thumbnail reached Neon only if the separate course-save action ran.
  const handleRowThumbnailChange = async (rowId: string, thumbnail: string) => {
    setMsg(null);
    try {
      const { course } = await lmsClient.updateCourse(rowId, { thumbnail });
      updateRow(rowId, { thumbnail: course.thumbnail || thumbnail });
      setMsg({ text: "Course cover saved and available to students." });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Could not save course cover.",
        isError: true,
      });
    }
  };

  const handleRowThumbnailUpload = async (rowId: string, file: File) => {
    if (!file) return;
    setMsg(null);
    try {
      const { thumbnailUrl } = await lmsClient.uploadThumbnail(rowId, file);
      await handleRowThumbnailChange(rowId, thumbnailUrl);
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Could not upload course cover.",
        isError: true,
      });
    }
  };

  const handleUploadRowVideos = async (row: CourseRow, files: FileList | File[] | File) => {
    const fileList = files instanceof File ? [files] : Array.from(files);
    if (fileList.length === 0) return;
    setUploadingRowId(row.id);
    setMsg(null);
    try {
      // Materialize any older URL-only course videos before appending new ones,
      // preserving their existing curriculum order and names.
      await lmsClient.getCourse(row.id).catch(() => null);
      let currentUrls =
        row.video_urls && Array.isArray(row.video_urls)
          ? [...row.video_urls]
          : row.video_url
            ? [row.video_url]
            : [];

      const uploadedItems: Array<{ url: string; title: string }> = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]!;
        setUploadProgressText(`Uploading ${i + 1} of ${fileList.length}: ${file.name}…`);
        const uploaded = await lmsClient.uploadVideo(row.id, file);
        if (!currentUrls.includes(uploaded.videoUrl)) {
          currentUrls = [...currentUrls, uploaded.videoUrl];
        }
        uploadedItems.push({ url: uploaded.videoUrl, title: titleFromVideoFileName(file.name) });
      }

      // Save a named lesson for every upload. The title comes from the filename
      // by default and can be renamed in the Curriculum Lesson Sequence below.
      for (const item of uploadedItems) {
        await lmsClient.addLesson(row.id, {
          title: item.title,
          description: "",
          videoUrl: item.url,
          isRequired: true,
          isPreview: false,
        });
      }

      // Keep every uploaded stream, but point the primary player at the most
      // recently uploaded video instead of silently retaining the starter/sample URL.
      const primaryVideoUrl = currentUrls[currentUrls.length - 1] || "";
      updateRow(row.id, {
        video_url: primaryVideoUrl,
        video_urls: currentUrls,
      });
      await lmsClient.updateCourse(row.id, {
        video_url: primaryVideoUrl,
        video_urls: currentUrls,
      });
      setMsg({
        text: `Successfully uploaded ${fileList.length} video${fileList.length > 1 ? "s" : ""} for "${row.title}"!`,
      });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to upload video file(s)",
        isError: true,
      });
    } finally {
      setUploadingRowId(null);
      setUploadProgressText(null);
    }
  };

  const handleUploadRowVideo = (row: CourseRow, file: File) => handleUploadRowVideos(row, [file]);

  const handleAddRowVideoUrl = async (rowId: string, urlToAdd: string) => {
    const trimmed = urlToAdd.trim();
    if (!trimmed) return;
    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;
    // Keep existing URL-only assets as real lessons before adding another video.
    await lmsClient.getCourse(rowId).catch(() => null);
    const currentUrls =
      targetRow.video_urls && Array.isArray(targetRow.video_urls)
        ? [...targetRow.video_urls]
        : targetRow.video_url
          ? [targetRow.video_url]
          : [];
    const isNewVideoUrl = !currentUrls.includes(trimmed);
    if (isNewVideoUrl) currentUrls.push(trimmed);
    updateRow(rowId, {
      video_urls: currentUrls,
      video_url: targetRow.video_url || currentUrls[0] || "",
    });
    try {
      await lmsClient.updateCourse(rowId, {
        video_urls: currentUrls,
        video_url: targetRow.video_url || currentUrls[0] || "",
      });
      if (isNewVideoUrl) {
        await lmsClient.addLesson(rowId, {
          title: titleFromVideoUrl(trimmed, currentUrls.length - 1),
          description: "",
          videoUrl: trimmed,
          isRequired: true,
          isPreview: false,
        });
      }
      setMsg({ text: "Added video URL and saved its curriculum title. Rename it in Course Content if needed." });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err) {
      console.warn("Failed to update course video urls:", err);
    }
  };

  const handleEditRowVideoUrl = (rowId: string, indexToEdit: number, newVal: string) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== rowId) return r;
        const currentUrls =
          r.video_urls && Array.isArray(r.video_urls)
            ? [...r.video_urls]
            : r.video_url
              ? [r.video_url]
              : [];
        const next = [...currentUrls];
        next[indexToEdit] = newVal;
        return {
          ...r,
          video_urls: next,
          video_url: indexToEdit === 0 ? newVal : r.video_url,
        };
      }),
    );
  };

  const handleRemoveRowVideoUrl = async (rowId: string, indexToRemove: number) => {
    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;
    const currentUrls =
      targetRow.video_urls && Array.isArray(targetRow.video_urls)
        ? [...targetRow.video_urls]
        : targetRow.video_url
          ? [targetRow.video_url]
          : [];
    const filtered = currentUrls.filter((_, idx) => idx !== indexToRemove);
    updateRow(rowId, {
      video_urls: filtered,
      video_url: filtered[0] || "",
    });
    try {
      await lmsClient.updateCourse(rowId, {
        video_urls: filtered,
        video_url: filtered[0] || "",
      });
      setMsg({ text: "Removed video from course." });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err) {
      console.warn("Failed to delete video from course:", err);
    }
  };

  const handleSetRowPrimaryVideo = async (rowId: string, indexToPrimary: number) => {
    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;
    const currentUrls =
      targetRow.video_urls && Array.isArray(targetRow.video_urls)
        ? [...targetRow.video_urls]
        : targetRow.video_url
          ? [targetRow.video_url]
          : [];
    const target = currentUrls[indexToPrimary];
    if (!target) return;
    const reordered = [target, ...currentUrls.filter((_, idx) => idx !== indexToPrimary)];
    updateRow(rowId, {
      video_urls: reordered,
      video_url: target,
    });
    try {
      await lmsClient.updateCourse(rowId, {
        video_urls: reordered,
        video_url: target,
      });
      setMsg({ text: `Set primary video to: ${target}` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err) {
      console.warn("Failed to update primary video:", err);
    }
  };

  const handleUploadLessonVideo = async (les: LessonItem, file: File) => {
    setMsg(null);
    try {
      const uploaded = await lmsClient.uploadVideo(selectedContentCourse, file, les.id);
      let durationStr = les.duration;
      try {
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        const d = await new Promise<number>((resolve) => {
          tempVideo.onloadedmetadata = () => {
            window.URL.revokeObjectURL(tempVideo.src);
            resolve(tempVideo.duration || 60);
          };
          tempVideo.onerror = () => resolve(60);
          tempVideo.src = URL.createObjectURL(file);
        });
        if (d && !isNaN(d) && isFinite(d) && d > 0) {
          const mins = Math.floor(d / 60);
          const secs = Math.floor(d % 60);
          durationStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        }
      } catch {
        // ignore
      }

      await lmsClient.updateLesson(les.id, {
        video_url: uploaded.videoUrl,
        duration: durationStr,
      });
      setLessons((prev) =>
        prev.map((l) =>
          l.id === les.id ? { ...l, videoUrl: uploaded.videoUrl, duration: durationStr } : l,
        ),
      );
      setMsg({ text: `Successfully updated video for lesson "${les.title}"!` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to upload lesson video",
        isError: true,
      });
    }
  };

  const saveCourse = async (row: CourseRow) => {
    setMsg(null);
    try {
      const videoUrls =
        row.video_urls && Array.isArray(row.video_urls)
          ? row.video_urls.map((u) => u.trim()).filter(Boolean)
          : row.video_url
            ? [row.video_url.trim()]
            : [];
      const primaryVideoUrl = videoUrls[0] || row.video_url?.trim() || "";

      await lmsClient.updateCourse(row.id, {
        price_inr: row.price_inr,
        preview_minutes: row.preview_minutes,
        video_url: primaryVideoUrl,
        video_urls: videoUrls,
        thumbnail: row.thumbnail || PRESET_THUMBNAILS[0].url,
        hours: row.hours,
        status: row.status,
      });

      // also sync to Supabase courses table
      await supabase
        .from("courses")
        .update({
          price_inr: row.price_inr,
          preview_minutes: row.preview_minutes,
          video_url: primaryVideoUrl,
          thumbnail: row.thumbnail || PRESET_THUMBNAILS[0].url,
        })
        .eq("id", row.id)
        .then(undefined, () => {});

      setMsg({ text: `Saved updates for "${row.title}" successfully!` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to update course",
        isError: true,
      });
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSlug.trim()) {
      setMsg({ text: "Please enter course title and slug.", isError: true });
      return;
    }

    try {
      const thumbnailFileToUpload = newThumbnailFile;
      const filesToUpload = [...newVideoFiles];
      const fileTitles = [...newVideoTitles];
      if (newVideoFile && !filesToUpload.includes(newVideoFile)) {
        filesToUpload.push(newVideoFile);
        fileTitles.push(titleFromVideoFileName(newVideoFile.name));
      }
      setIsUploadingCourseVideo(filesToUpload.length > 0);

      const initialUrls = newVideoUrls.map((u) => u.trim()).filter(Boolean);
      if (newVideoUrl.trim() && !initialUrls.includes(newVideoUrl.trim())) {
        initialUrls.push(newVideoUrl.trim());
      }

      const { course } = await lmsClient.createCourse({
        title: newTitle.trim(),
        slug: newSlug.trim().toLowerCase().replace(/\s+/g, "-"),
        price_inr: newPrice,
        preview_minutes: newPreview,
        thumbnail: thumbnailFileToUpload
          ? PRESET_THUMBNAILS[0].url
          : newThumbnail.trim() || PRESET_THUMBNAILS[0].url,
        video_url: initialUrls[0] || "",
        video_urls: initialUrls,
        hours: newHours,
        status: newStatus,
        instructor: displayName,
      });

      let createdCourse = course as unknown as CourseRow;

      if (thumbnailFileToUpload) {
        try {
          setUploadProgressText(`Uploading course thumbnail: ${thumbnailFileToUpload.name}…`);
          const { thumbnailUrl } = await lmsClient.uploadThumbnail(createdCourse.id, thumbnailFileToUpload);
          const updated = await lmsClient.updateCourse(createdCourse.id, { thumbnail: thumbnailUrl });
          createdCourse = updated.course as unknown as CourseRow;
        } catch (thumbnailErr) {
          await lmsClient.deleteCourse(createdCourse.id).catch(() => {});
          throw new Error(
            `Course thumbnail upload failed: ${thumbnailErr instanceof Error ? thumbnailErr.message : "Upload error"}`,
          );
        }
      }

      if (filesToUpload.length > 0) {
        try {
          const uploadedUrls: string[] = [];
          for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i]!;
            setUploadProgressText(
              `Uploading video ${i + 1} of ${filesToUpload.length}: ${file.name}…`,
            );
            const uploaded = await lmsClient.uploadVideo(createdCourse.id, file);
            uploadedUrls.push(uploaded.videoUrl);
            await lmsClient.addLesson(createdCourse.id, {
              title: fileTitles[i]?.trim() || titleFromVideoFileName(file.name),
              description: "",
              videoUrl: uploaded.videoUrl,
              lessonOrder: i + 1,
              isRequired: true,
              isPreview: i === 0,
            });
          }
          const allUrls = [...uploadedUrls, ...initialUrls];
          const updated = await lmsClient.updateCourse(createdCourse.id, {
            video_url: allUrls[0] || "",
            video_urls: allUrls,
            thumbnail: createdCourse.thumbnail || PRESET_THUMBNAILS[0].url,
          });
          createdCourse = updated.course as unknown as CourseRow;
        } catch (uploadErr) {
          // If video upload failed, abort course creation so UI doesn't pretend upload succeeded
          await lmsClient.deleteCourse(createdCourse.id).catch(() => {});
          throw new Error(
            `Course video upload failed: ${uploadErr instanceof Error ? uploadErr.message : "Upload error"}`,
          );
        }
      }

      // External video URLs also become named curriculum lessons so students
      // see a real title rather than the course title or a generic placeholder.
      for (let i = 0; i < initialUrls.length; i++) {
        const url = initialUrls[i]!;
        await lmsClient.addLesson(createdCourse.id, {
          title: titleFromVideoUrl(url, i),
          description: "",
          videoUrl: url,
          lessonOrder: filesToUpload.length + i + 1,
          isRequired: true,
          isPreview: filesToUpload.length === 0 && i === 0,
        });
      }

      setRows((prev) => [createdCourse, ...prev]);
      setNewTitle("");
      setNewSlug("");
      setNewVideoFile(null);
      setNewVideoFiles([]);
      setNewVideoTitles([]);
      setNewVideoUrl("");
      setNewVideoUrls([]);
      setNewUrlInput("");
      setNewThumbnail(PRESET_THUMBNAILS[0].url);
      setNewThumbnailFile(null);
      const savedVideoCount =
        createdCourse.video_urls?.length ?? (createdCourse.video_url ? 1 : 0);
      setMsg({
        text: `Course "${createdCourse.title}" successfully created with ${savedVideoCount} video(s)!`,
      });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
      switchView("courses");
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to create course",
        isError: true,
      });
    } finally {
      setIsUploadingCourseVideo(false);
      setUploadProgressText(null);
    }
  };

  const handleDeleteAssignment = async (assignment: AssignmentDefinition) => {
    const confirmed = window.confirm(
      `Delete "${assignment.title}"? This also permanently removes its saved submissions and grading feedback. This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const result = await lmsClient.deleteAssignment(assignment.id);
      if (!result.success) throw new Error("The assignment could not be deleted.");
      setAssignmentDefs((current) => current.filter((item) => item.id !== assignment.id));
      setSubmissions((current) => current.filter((item) => item.assignmentId !== assignment.id));
      setMsg({ text: `Assignment "${assignment.title}" deleted.` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
      await loadInstructorData();
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "Failed to delete assignment", isError: true });
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgTitle.trim() || !newAsgDesc.trim()) {
      setMsg({ text: "Please fill in assignment title and description.", isError: true });
      return;
    }

    try {
      await lmsClient.saveAssignment({
        courseId: newAsgCourse,
        title: newAsgTitle.trim(),
        description: newAsgDesc.trim(),
        dueDate: newAsgDue,
        maxScore: newAsgMaxScore,
      });

      setNewAsgTitle("");
      setNewAsgDesc("");
      setMsg({ text: `Assignment "${newAsgTitle}" created and published to students!` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
      await loadInstructorData();
      switchView("assignments");
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to create assignment",
        isError: true,
      });
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim() || !newQText.trim()) {
      setMsg({ text: "Please fill in quiz title and at least one question.", isError: true });
      return;
    }

    try {
      await lmsClient.saveQuiz({
        courseId: newQuizCourse,
        title: newQuizTitle.trim(),
        description: newQuizDesc.trim() || "Test your understanding of key topics.",
        durationMinutes: newQuizDuration,
        passPercentage: newQuizPass,
        questions: [
          {
            id: 1,
            question: newQText.trim(),
            options: [
              newQOpt1.trim() || "Option A",
              newQOpt2.trim() || "Option B",
              newQOpt3.trim() || "Option C",
              newQOpt4.trim() || "Option D",
            ],
            correct_option: newQCorrect,
            explanation: "Verified by lead faculty author.",
            marks: 100,
          },
        ],
      });

      setNewQuizTitle("");
      setNewQText("");
      setMsg({ text: `Assessment quiz "${newQuizTitle}" created successfully!` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
      await loadInstructorData();
      switchView("assessments");
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to create quiz",
        isError: true,
      });
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;

    try {
      setIsUploadingVideo(Boolean(newLessonVideoFile));
      let videoUrl = newLessonVideoUrl.trim();

      if (newLessonVideoFile) {
        const uploaded = await lmsClient.uploadVideo(selectedContentCourse, newLessonVideoFile);
        videoUrl = uploaded.videoUrl;
      }

      let durationVal = newLessonDuration.trim();
      if (newLessonVideoFile) {
        try {
          const tempVideo = document.createElement("video");
          tempVideo.preload = "metadata";
          const d = await new Promise<number>((resolve) => {
            tempVideo.onloadedmetadata = () => {
              window.URL.revokeObjectURL(tempVideo.src);
              resolve(tempVideo.duration || 60);
            };
            tempVideo.onerror = () => resolve(60);
            tempVideo.src = URL.createObjectURL(newLessonVideoFile);
          });
          if (d && !isNaN(d) && isFinite(d) && d > 0) {
            const mins = Math.floor(d / 60);
            const secs = Math.floor(d % 60);
            durationVal = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
          }
        } catch {
          // ignore
        }
      }

      const { lesson } = await lmsClient.addLesson(selectedContentCourse, {
        title: newLessonTitle.trim(),
        duration: durationVal,
        videoUrl: videoUrl || undefined,
        lessonOrder: newLessonOrder > 0 ? newLessonOrder : undefined,
        isRequired: newLessonRequired,
        isPreview: newLessonPreview,
      });

      setLessons((prev) => [
        ...prev,
        {
          id: lesson.id,
          courseSlug: selectedContentCourse,
          title: lesson.title,
          duration: lesson.duration,
          videoUrl: lesson.video_url,
          isPreview: lesson.is_preview,
        },
      ]);
      setNewLessonTitle("");
      setNewLessonVideoUrl("");
      setNewLessonVideoFile(null);
      setNewLessonOrder(0);
      setMsg({ text: `Lesson "${lesson.title}" added to syllabus!` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to add lesson",
        isError: true,
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleSaveLessonTitle = async (lesson: LessonItem) => {
    const title = editingLessonTitle.trim();
    if (!title) {
      setMsg({ text: "Enter a lesson title before saving.", isError: true });
      return;
    }
    try {
      const { lesson: updatedLesson } = await lmsClient.updateLesson(lesson.id, { title });
      setLessons((prev) =>
        prev.map((item) => item.id === lesson.id ? { ...item, title: updatedLesson.title } : item),
      );
      setEditingLessonId(null);
      setEditingLessonTitle("");
      setMsg({ text: `Saved video title: "${updatedLesson.title}"` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Could not save the video title.",
        isError: true,
      });
    }
  };

  const handleOpenGrading = (sub: AssignmentSubmission) => {
    setGradingSub(sub);
    setGradeScore(sub.score ?? 95);
    setGradeStatus(sub.status === "needs_revision" ? "needs_revision" : "approved");
    setGradeFeedback(sub.feedback ?? "Code adheres to architectural standards and passes tests.");
  };

  const handleSaveGrade = async () => {
    if (!gradingSub) return;
    try {
      await lmsClient.gradeSubmission(gradingSub.id, gradeScore, gradeFeedback, gradeStatus);
      setGradingSub(null);
      setMsg({ text: `Recorded score (${gradeScore}/100) for ${gradingSub.studentName}.` });
      window.dispatchEvent(new CustomEvent("lms_data_updated"));
      await loadInstructorData();
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to save grade",
        isError: true,
      });
    }
  };

  // Metrics
  const totalRevenue = students.reduce((acc, s) => acc + (s.pricePaidInr || 0), 0);
  const totalStudents = new Set(students.map((s) => s.studentId)).size;
  const pendingAssignments = submissions.filter((s) => s.status === "pending").length;
  const publishedCount = rows.filter((r) => r.status !== "draft").length;
  const draftCount = rows.filter((r) => r.status === "draft").length;
  // Don't offer malformed numeric placeholder courses (e.g. "2") when creating assignments.
  // Keep their existing records untouched so no learner data is lost.
  const assignmentCourseOptions = rows.filter(
    (course) =>
      typeof course.title === "string" &&
      course.title.trim().length > 1 &&
      !/^\d+$/.test(course.title.trim()) &&
      typeof course.slug === "string" &&
      course.slug.trim().length > 0 &&
      !/^\d+$/.test(course.slug.trim()),
  );
  const avgCompletion = students.length
    ? Math.round(students.reduce((acc, s) => acc + s.progress, 0) / students.length)
    : 0;

  // Filtered lists
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.studentName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentEmail.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesCourse = selectedCourseFilter === "all" || s.courseSlug === selectedCourseFilter;
    return matchesSearch && matchesCourse;
  });

  const filteredSubmissions = submissions.filter((s) => {
    if (submissionFilter === "pending") return s.status === "pending";
    if (submissionFilter === "approved") return s.status === "approved";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {msg && (
        <div
          className={`flex items-center justify-between rounded-lg p-3.5 text-xs font-medium ${
            msg.isError
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-teal-50 text-teal-800 border border-teal-200"
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {msg.isError ? (
              <AlertCircle className="size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-teal-700" />
            )}
            <span>{msg.text}</span>
          </div>
          <button
            onClick={() => setMsg(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: DASHBOARD (PRIMARY INSTRUCTOR OPERATIONS DESK) */}
      {/* ------------------------------------------------------------- */}
      {currentView === "dashboard" && (
        <div className="space-y-4">
          {/* Compact dashboard header */}
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/25 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg shadow-teal-950/20"><div className="pointer-events-none absolute -right-8 -top-14 size-44 rounded-full bg-teal-400/10 blur-3xl" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back, {displayName} <span className="inline-block">✦</span></h1>
              <p className="text-sm text-slate-300 mt-1">
                Your courses, learners, and reviews at a glance.
              </p>
            </div>
            <button
              onClick={() => switchView("create-course")}
              className="relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-teal-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/30 cursor-pointer"
            >
              <PlusCircle className="size-3.5" />
              <span>Create Course</span>
            </button>
          </div>

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl border border-teal-500/20 bg-white dark:bg-slate-900/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-teal-400/50 hover:shadow-lg hover:shadow-teal-950/30"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 to-cyan-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Courses</span>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{rows.length}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="text-emerald-700 font-semibold">{publishedCount} Published</span>
                <span>·</span>
                <span>{draftCount} Draft</span>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-950/30"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 to-violet-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Enrolled Students</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalStudents}</p>
              <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                {avgCompletion}% avg completion
              </span>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-amber-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-950/10"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Review Queue</span>
              <p className="mt-1 text-2xl font-bold text-slate-900">{pendingAssignments}</p>
              <span
                className={`text-[11px] font-bold ${pendingAssignments > 0 ? "text-amber-700" : "text-emerald-700"}`}
              >
                {pendingAssignments > 0 ? "Requires grading" : "All reviews caught up"}
              </span>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-fuchsia-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-400/50 hover:shadow-lg hover:shadow-fuchsia-950/10"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-400 to-pink-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Gross Tuition Revenue</span>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Recorded tuition</span>
            </div>
          </div>

          {/* Review Queue Spotlight & Quick Grading */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-teal-700" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Needs review
                </h3>
              </div>
              <button
                onClick={() => switchView("submissions")}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 transition-colors hover:text-teal-600 dark:hover:text-teal-300 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {submissions
                .filter((s) => s.status === "pending")
                .slice(0, 3)
                .map((sub) => (
                  <div
                    key={sub.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900">{sub.studentName}</span>
                        <span className="text-slate-500 dark:text-slate-400">({sub.studentEmail})</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-teal-700 dark:text-teal-400 font-semibold">{sub.courseTitle}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        {sub.assignmentTitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {sub.githubUrl && (
                        <a
                          href={sub.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                        >
                          <ExternalLink className="size-3" /> Code Repo
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenGrading(sub)}
                        className="rounded-lg bg-teal-700 text-white px-3 py-1 text-xs font-bold hover:bg-teal-800 cursor-pointer"
                      >
                        Grade Now
                      </button>
                    </div>
                  </div>
                ))}
              {submissions.filter((s) => s.status === "pending").length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  No submissions currently awaiting review. All student projects are graded.
                </p>
              )}
            </div>
          </div>

          {/* Quick Roster Activity Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-teal-700" />
                <h3 className="font-bold text-sm text-slate-900">Recent students</h3>
              </div>
              <button
                onClick={() => switchView("students")}
                className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                View All Students ({students.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-slate-500 font-medium">
                  <tr>
                    <th className="pb-2">Learner</th>
                    <th className="pb-2">Course</th>
                    <th className="pb-2">Progress</th>
                    <th className="pb-2">Last Active</th>
                    <th className="pb-2 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-700 dark:text-slate-200">
                  {students.slice(0, 4).map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-teal-50/70 dark:hover:bg-slate-800/80">
                      <td className="py-2.5 font-bold text-slate-900">{s.studentName}</td>
                      <td className="py-2.5 text-teal-700 font-medium">{s.courseTitle}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full"
                              style={{ width: `${s.progress}%` }}
                            />
                          </div>
                          <span className="font-semibold">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-500">{s.lastActive}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        ₹{s.pricePaidInr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: COURSE MANAGEMENT */}
      {/* ------------------------------------------------------------- */}
      {currentView === "courses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Course Portfolio & Pricing</h1>
              <p className="text-xs text-slate-500">
                Manage course pricing, publication status, and media.
              </p>
            </div>
            <button
              onClick={() => switchView("create-course")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 cursor-pointer"
            >
              <PlusCircle className="size-3.5" /> Create Course
            </button>
          </div>

          <div className="grid gap-4">
            {rows.map((row) => (
              <div
                key={row.id || row.slug}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={row.thumbnail || PRESET_THUMBNAILS[0].url}
                      alt={row.title}
                      className="size-14 sm:w-20 sm:h-12 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-teal-700 uppercase font-mono">
                          {row.slug}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === "draft"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {row.status === "draft" ? "Draft Mode" : "Published Live"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5 truncate">
                        {row.title}
                      </h3>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => saveCourse(row)}
                    className="self-start sm:self-center bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold gap-1.5 cursor-pointer shrink-0"
                  >
                    <Save className="size-3.5" /> Save
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Fee (₹)</label>
                    <Input
                      type="number"
                      min={1}
                      value={row.price_inr}
                      onChange={(e) =>
                        updateRow(row.id, { price_inr: Math.max(1, Number(e.target.value)) })
                      }
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Preview (min)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={row.preview_minutes}
                      onChange={(e) =>
                        updateRow(row.id, {
                          preview_minutes: Math.min(30, Math.max(0, Number(e.target.value))),
                        })
                      }
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Duration (hrs)
                    </label>
                    <Input
                      type="number"
                      step={0.5}
                      min={1}
                      value={row.hours ?? 18}
                      onChange={(e) =>
                        updateRow(row.id, { hours: Math.max(1, Number(e.target.value)) })
                      }
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Status
                    </label>
                    <select
                      value={row.status || "published"}
                      onChange={(e) =>
                        updateRow(row.id, { status: e.target.value as "published" | "draft" })
                      }
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft Mode</option>
                    </select>
                  </div>
                </div>

                <details className="group mt-3 border-t border-slate-100 pt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Film className="size-4 text-indigo-600" />
                    <span>Media & videos</span>
                    <span className="text-xs font-normal text-slate-400">Cover, uploads and links</span>
                    <ChevronDown className="ml-auto size-4 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-4 px-1 pt-2">
                {/* Course Cover Thumbnail Option */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-teal-600" />
                      <span>Course Cover Thumbnail</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 hover:text-teal-800 cursor-pointer">
                      <Upload className="size-3" />
                      <span>Upload Custom Cover</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleRowThumbnailUpload(row.id, file);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                      Presets:
                    </span>
                    {PRESET_THUMBNAILS.map((p) => {
                      const isSelected = row.thumbnail === p.url;
                      return (
                        <button
                          key={`p_${row.id}_${p.url}`}
                          type="button"
                          onClick={() => void handleRowThumbnailChange(row.id, p.url)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "border-teal-600 bg-teal-50 text-teal-800 font-bold shadow-2xs"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <Input
                      placeholder="Or enter custom image URL (https://...)"
                      value={row.thumbnail || ""}
                      onChange={(e) => updateRow(row.id, { thumbnail: e.target.value })}
                      onBlur={(e) => {
                        const value = e.currentTarget.value.trim();
                        if (value) void handleRowThumbnailChange(row.id, value);
                      }}
                      className="text-xs font-mono h-7.5"
                    />
                  </div>
                </div>

                {(() => {
                  const rowVideoUrls =
                    row.video_urls && Array.isArray(row.video_urls) && row.video_urls.length > 0
                      ? row.video_urls
                      : row.video_url
                        ? [row.video_url]
                        : [];
                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <Film className="size-3.5 text-indigo-600" />
                          <span>Course Video Assets ({rowVideoUrls.length})</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                          {uploadingRowId === row.id ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              <span>{uploadProgressText || "Uploading videos…"}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="size-3" />
                              <span>Upload Video File(s)</span>
                            </>
                          )}
                          <input
                            type="file"
                            multiple
                            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                            className="hidden"
                            disabled={uploadingRowId === row.id}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) void handleUploadRowVideos(row, files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void toggleRowVideoTitleEditor(row)}
                          disabled={loadingVideoTitleCourse === row.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 cursor-pointer"
                        >
                          {loadingVideoTitleCourse === row.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Pencil className="size-3" />
                          )}
                          {loadingVideoTitleCourse === row.id
                            ? "Loading titles…"
                            : videoTitleEditorCourse === row.id
                              ? "Hide video titles"
                              : "Rename video titles"}
                        </button>
                      </div>

                      {videoTitleEditorCourse === row.id && (
                        <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Student-facing video names</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              Rename a video here. The saved title appears in the course player; the video file stays unchanged.
                            </p>
                          </div>
                          {(videoTitleLessons[row.id] || []).length === 0 ? (
                            <p className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-[11px] text-slate-500">
                              No video lessons are available to rename yet.
                            </p>
                          ) : (
                            (videoTitleLessons[row.id] || []).map((lesson, lessonIndex) => (
                              <div
                                key={lesson.id}
                                className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-2.5 sm:flex-row sm:items-center"
                              >
                                <div className="min-w-0 sm:w-40 shrink-0">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    Video {lessonIndex + 1}
                                  </p>
                                  <p className="truncate text-[10px] text-slate-400" title={lesson.videoUrl}>
                                    {lesson.videoUrl}
                                  </p>
                                </div>
                                <Input
                                  value={videoTitleDrafts[lesson.id] ?? lesson.title}
                                  onChange={(event) =>
                                    setVideoTitleDrafts((previous) => ({
                                      ...previous,
                                      [lesson.id]: event.target.value,
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void saveRowVideoTitle(row.id, lesson);
                                    }
                                  }}
                                  aria-label={`Title for video ${lessonIndex + 1}`}
                                  placeholder="Enter a student-facing video title"
                                  className="h-8 flex-1 text-xs"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void saveRowVideoTitle(row.id, lesson)}
                                  disabled={savingVideoTitleId === lesson.id}
                                  className="h-8 shrink-0 bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700"
                                >
                                  {savingVideoTitleId === lesson.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Save className="size-3" />
                                  )}
                                  Save name
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* Video URLs list */}
                      <div className="space-y-1.5">
                        {rowVideoUrls.map((vUrl, vIdx) => (
                          <div
                            key={`${row.id}_v_${vIdx}`}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-mono"
                          >
                            <span className="text-[10px] font-bold text-slate-500 shrink-0">
                              #{vIdx + 1}
                            </span>
                            <input
                              value={vUrl}
                              onChange={(e) => handleEditRowVideoUrl(row.id, vIdx, e.target.value)}
                              className="flex-1 bg-transparent text-[11px] text-slate-700 outline-none truncate"
                              placeholder="https://..."
                            />
                            {vIdx === 0 ? (
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 uppercase shrink-0">
                                Master
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetRowPrimaryVideo(row.id, vIdx)}
                                className="text-[10px] text-slate-500 hover:text-indigo-600 font-sans hover:underline shrink-0 cursor-pointer"
                              >
                                Set Master
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveRowVideoUrl(row.id, vIdx)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0 cursor-pointer"
                              title="Remove video from course"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Video Stream URL input */}
                      <div className="flex gap-2 pt-0.5">
                        <Input
                          placeholder="Or paste an additional video URL (https://...)"
                          value={rowNewUrls[row.id] || ""}
                          onChange={(e) =>
                            setRowNewUrls((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const trimmedUrl = rowNewUrls[row.id]?.trim();
                              if (trimmedUrl) {
                                handleAddRowVideoUrl(row.id, trimmedUrl);
                                setRowNewUrls((prev) => ({ ...prev, [row.id]: "" }));
                              }
                            }
                          }}
                          className="text-xs font-mono h-7.5 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7.5 text-xs px-2.5 shrink-0"
                          onClick={() => {
                            const trimmedUrl = rowNewUrls[row.id]?.trim();
                            if (trimmedUrl) {
                              handleAddRowVideoUrl(row.id, trimmedUrl);
                              setRowNewUrls((prev) => ({ ...prev, [row.id]: "" }));
                            }
                          }}
                        >
                          <PlusCircle className="size-3 mr-1" />
                          Add URL
                        </Button>
                      </div>
                    </div>
                  );
                })()}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 3: CREATE COURSE */}
      {/* ------------------------------------------------------------- */}
      {currentView === "create-course" && (
        <div className="space-y-6 max-w-2xl">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">Author New Curriculum Course</h1>
            <p className="text-xs text-slate-500">
              Publish a new engineering course with pricing, preview lockouts, and lecture videos.
            </p>
          </div>

          <form
            onSubmit={handleCreateCourse}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Course Title</label>
              <Input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!newSlug)
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                }}
                placeholder="e.g., Cloud Native Microservices Architecture"
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                URL Identifier / Course Slug
              </label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="e.g., cloud-native-microservices"
                className="text-xs font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Price (₹ INR)</label>
                <Input
                  type="number"
                  min={1}
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Preview Limit (Min)</label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={newPreview}
                  onChange={(e) => setNewPreview(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Estimated Hours</label>
                <Input
                  type="number"
                  step={0.5}
                  min={1}
                  value={newHours}
                  onChange={(e) => setNewHours(Number(e.target.value))}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Course Thumbnail Upload & Preset Selection */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <ImageIcon className="size-4 text-teal-600" />
                    <span>Course Cover Thumbnail</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Upload a custom thumbnail photo, select a tech preset cover, or paste an image
                    URL.
                  </p>
                </div>

                <label className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 cursor-pointer transition-colors shrink-0">
                  <Upload className="size-3.5" />
                  <span>Upload Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleThumbnailFileChange(file, (dataUrl) => {
                          setNewThumbnail(dataUrl);
                          setNewThumbnailFile(file);
                        });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Live Preview and Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="relative h-28 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group shrink-0">
                  <img
                    src={newThumbnail || PRESET_THUMBNAILS[0].url}
                    alt="Course Thumbnail Preview"
                    className="h-full w-full object-cover opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-2.5">
                    <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">
                      Live Cover Preview
                    </span>
                    <p className="text-xs font-bold text-white truncate">
                      {newTitle || "Course Title Preview"}
                    </p>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Preset Covers:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PRESET_THUMBNAILS.map((p) => {
                      const isSelected = newThumbnail === p.url;
                      return (
                        <button
                          key={`new_p_${p.url}`}
                          type="button"
                          onClick={() => {
                            setNewThumbnail(p.url);
                            setNewThumbnailFile(null);
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] text-left transition-all cursor-pointer truncate ${
                            isSelected
                              ? "border-teal-600 bg-teal-50 text-teal-800 font-bold shadow-2xs"
                              : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <span className="truncate">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1">
                    <Input
                      placeholder="Or paste custom image URL (https://...)"
                      value={newThumbnail}
                      onChange={(e) => {
                        setNewThumbnail(e.target.value);
                        setNewThumbnailFile(null);
                      }}
                      className="text-xs font-mono h-7.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Multiple Video Files Upload */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Film className="size-4 text-teal-600" />
                    <span>
                      Upload Course Videos ({newVideoFiles.length} file
                      {newVideoFiles.length !== 1 ? "s" : ""} queued)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Select one or multiple video files (MP4, WebM, MOV, max 500 MB each). Set each
                    curriculum title below before publishing; you can rename it later.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 cursor-pointer transition-colors shrink-0">
                  <Upload className="size-3.5" />
                  <span>{newVideoFiles.length > 0 ? "Add More Videos" : "Choose Video Files"}</span>
                  <input
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setNewVideoFiles((prev) => [...prev, ...files]);
                        setNewVideoTitles((prev) => [
                          ...prev,
                          ...files.map((file) => titleFromVideoFileName(file.name)),
                        ]);
                        if (!newVideoFile) setNewVideoFile(files[0] ?? null);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Selected Files List */}
              {newVideoFiles.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {newVideoFiles.map((f, idx) => (
                    <div
                      key={`new_v_file_${idx}_${f.name}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs"
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-500 text-[10px] shrink-0">
                            #{idx + 1}
                          </span>
                          <Video className="size-3.5 text-teal-600 shrink-0" />
                          <span className="font-mono text-[11px] text-slate-800 truncate">
                            {f.name}
                          </span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            ({(f.size / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                          {idx === 0 && (
                            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 uppercase shrink-0">
                              Primary
                            </span>
                          )}
                        </div>
                        <Input
                          value={newVideoTitles[idx] ?? titleFromVideoFileName(f.name)}
                          onChange={(e) =>
                            setNewVideoTitles((prev) => {
                              const next = [...prev];
                              next[idx] = e.target.value;
                              return next;
                            })
                          }
                          placeholder="Enter the title students will see"
                          className="h-8 text-xs"
                          aria-label={`Title for video ${idx + 1}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewVideoFiles((prev) => prev.filter((_, i) => i !== idx));
                          setNewVideoTitles((prev) => prev.filter((_, i) => i !== idx));
                          if (newVideoFile === f) {
                            setNewVideoFile(newVideoFiles.filter((_, i) => i !== idx)[0] ?? null);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer shrink-0"
                        title="Remove file from upload queue"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video Stream URLs (array of URLs) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div>
                <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Film className="size-4 text-indigo-600" />
                  <span>Video Stream / External URLs ({newVideoUrls.length})</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Include video streams or CDN URLs as additional video sources for this course.
                </p>
              </div>

              {/* URLs List */}
              {newVideoUrls.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {newVideoUrls.map((url, uIdx) => (
                    <div
                      key={`new_v_url_${uIdx}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-mono"
                    >
                      <span className="text-[10px] font-bold text-slate-500 shrink-0">
                        #{uIdx + 1}
                      </span>
                      <input
                        value={url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewVideoUrls((prev) => {
                            const next = [...prev];
                            next[uIdx] = val;
                            return next;
                          });
                        }}
                        className="flex-1 bg-transparent text-[11px] text-slate-700 outline-none truncate"
                        placeholder="https://..."
                      />
                      {uIdx === 0 ? (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 uppercase shrink-0">
                          Primary
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setNewVideoUrls((prev) => [
                              prev[uIdx]!,
                              ...prev.filter((_, i) => i !== uIdx),
                            ]);
                          }}
                          className="text-[10px] text-slate-500 hover:text-indigo-600 font-sans hover:underline shrink-0 cursor-pointer"
                        >
                          Make Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNewVideoUrls((prev) => prev.filter((_, i) => i !== uIdx))}
                        className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0 cursor-pointer"
                        title="Remove URL"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add URL Input */}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newUrlInput}
                  onChange={(e) => setNewUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newUrlInput.trim()) {
                        setNewVideoUrls((prev) => [...prev, newUrlInput.trim()]);
                        setNewUrlInput("");
                      }
                    }
                  }}
                  placeholder="https://commondatastorage.googleapis.com/...mp4"
                  className="text-xs font-mono h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 shrink-0"
                  onClick={() => {
                    if (newUrlInput.trim()) {
                      setNewVideoUrls((prev) => [...prev, newUrlInput.trim()]);
                      setNewUrlInput("");
                    }
                  }}
                >
                  <PlusCircle className="size-3.5 mr-1 text-teal-600" />
                  Add URL
                </Button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Publication State</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as "published" | "draft")}
                className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2 text-xs"
              >
                <option value="published">Publish Immediately to Catalog</option>
                <option value="draft">Save as Draft (Private)</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => switchView("courses")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isUploadingCourseVideo}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer disabled:opacity-60"
              >
                {isUploadingCourseVideo
                  ? uploadProgressText || "Uploading videos…"
                  : `Publish Course (${newVideoFiles.length + newVideoUrls.length} Video${newVideoFiles.length + newVideoUrls.length !== 1 ? "s" : ""})`}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 4: COURSE CONTENT & LESSONS */}
      {/* ------------------------------------------------------------- */}
      {currentView === "content" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Manage Course Content & Lessons
              </h1>
              <p className="text-xs text-slate-500">
                Add lecture videos, configure syllabus sequence, and assign free preview status.
              </p>
            </div>

            <select
              value={selectedContentCourse}
              onChange={(e) => setSelectedContentCourse(e.target.value)}
              className="h-8.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              {rows.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Existing Lessons List */}
            <div className="md:col-span-2 space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Curriculum Lesson Sequence</h3>
              {lessons.filter((l) => l.courseSlug === selectedContentCourse).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  <p className="font-bold text-slate-700">No lessons added yet</p>
                  <p className="mt-1 text-slate-400">
                    Use the form on the right to upload videos and add lessons to this course.
                  </p>
                </div>
              ) : (
                lessons
                  .filter((l) => l.courseSlug === selectedContentCourse)
                  .map((les, idx) => (
                    <div
                      key={les.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid size-6 shrink-0 place-items-center rounded bg-slate-100 font-bold text-xs text-slate-600">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editingLessonId === les.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={editingLessonTitle}
                                onChange={(e) => setEditingLessonTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void handleSaveLessonTitle(les);
                                  }
                                  if (e.key === "Escape") {
                                    setEditingLessonId(null);
                                    setEditingLessonTitle("");
                                  }
                                }}
                                className="h-8 text-xs"
                                aria-label="Video lesson title"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveLessonTitle(les)}
                                className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                title="Save video title"
                              >
                                <Save className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLessonId(null);
                                  setEditingLessonTitle("");
                                }}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
                                title="Cancel title edit"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{les.title}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLessonId(les.id);
                                  setEditingLessonTitle(les.title);
                                }}
                                className="shrink-0 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                Rename
                              </button>
                            </div>
                          )}
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Duration: {les.duration}
                            {les.videoUrl ? (
                              <span className="ml-2 text-indigo-600 font-semibold">
                                • Video Attached
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                          <Upload className="size-3" />
                          <span>{les.videoUrl ? "Replace Video" : "Upload Video"}</span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadLessonVideo(les, file);
                            }}
                          />
                        </label>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            les.isPreview
                              ? "bg-teal-100 text-teal-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {les.isPreview ? "Free Preview" : "Paywalled"}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Add Lesson Form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs h-fit space-y-3 text-xs">
              <h3 className="font-bold text-sm text-slate-900">Add New Lesson</h3>
              <form onSubmit={handleAddLesson} className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lesson Title</label>
                  <Input
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    placeholder="e.g., Cache Eviction Algorithms"
                    className="text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Duration (e.g. 25m)
                  </label>
                  <Input
                    value={newLessonDuration}
                    onChange={(e) => setNewLessonDuration(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Upload Video (Optional)
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700">
                    <Upload className="size-4" />
                    <span>
                      {newLessonVideoFile ? newLessonVideoFile.name : "Choose video file"}
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                      className="hidden"
                      onChange={(e) => setNewLessonVideoFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <p className="mt-1 text-[10px] text-slate-400">
                    MP4, WebM, MOV or M4V · max 500 MB
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Video / Content URL (Optional)
                  </label>
                  <Input
                    value={newLessonVideoUrl}
                    onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                    placeholder="https://commondatastorage.googleapis.com/...mp4"
                    className="text-xs font-mono"
                  />
                  {(() => {
                    const currentCourseRow = rows.find(
                      (r) => r.slug === selectedContentCourse || r.id === selectedContentCourse,
                    );
                    const courseVideos =
                      currentCourseRow?.video_urls && currentCourseRow.video_urls.length > 0
                        ? currentCourseRow.video_urls
                        : currentCourseRow?.video_url
                          ? [currentCourseRow.video_url]
                          : [];
                    if (courseVideos.length === 0) return null;
                    return (
                      <div className="mt-2">
                        <p className="text-[10px] text-slate-500 font-semibold mb-1">
                          Or select from course video assets ({courseVideos.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {courseVideos.map((vUrl, vIdx) => {
                            const isSelected = newLessonVideoUrl === vUrl;
                            return (
                              <button
                                key={`pick_v_${vIdx}`}
                                type="button"
                                onClick={() => setNewLessonVideoUrl(vUrl)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer border transition-colors ${
                                  isSelected
                                    ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                }`}
                                title={vUrl}
                              >
                                Video #{vIdx + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Lesson Order (Leave 0 for automatic)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={newLessonOrder || ""}
                    onChange={(e) => setNewLessonOrder(parseInt(e.target.value) || 0)}
                    placeholder="e.g. 1"
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requiredCheck"
                    checked={newLessonRequired}
                    onChange={(e) => setNewLessonRequired(e.target.checked)}
                    className="size-4 text-teal-700 rounded"
                  />
                  <label htmlFor="requiredCheck" className="text-slate-700 font-medium">
                    Required for Course Completion
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="previewCheck"
                    checked={newLessonPreview}
                    onChange={(e) => setNewLessonPreview(e.target.checked)}
                    className="size-4 text-teal-700 rounded"
                  />
                  <label htmlFor="previewCheck" className="text-slate-700 font-medium">
                    Mark as Free Preview
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isUploadingVideo}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {isUploadingVideo ? "Uploading video…" : "Add Lesson to Syllabus"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 5: ASSIGNMENTS MANAGEMENT */}
      {/* ------------------------------------------------------------- */}
      {currentView === "assignments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Course Assignments & Milestones
              </h1>
              <p className="text-xs text-slate-500">
                Design coding assignments, specify rubrics, and inspect student submission counts.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Active Assignments */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Published Assignments</h3>
              <div className="space-y-3">
                {assignmentDefs.map((asg) => (
                  <div
                    key={asg.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-teal-700">{asg.courseTitle}</span>
                      <span className="text-slate-500 font-semibold">Due: {asg.dueDate}</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mt-1">{asg.title}</h4>
                    <p className="text-xs text-slate-600 mt-1">{asg.description}</p>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Max Marks: <strong>{asg.maxScore}</strong>
                        <span className="ml-3">
                          Submissions: <strong>{submissions.filter((submission) => submission.assignmentId === asg.id).length}</strong>
                        </span>
                      </span>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => {
                            setSubmissionFilter("all");
                            switchView("submissions");
                          }}
                          className="font-bold text-teal-700 hover:underline cursor-pointer"
                        >
                          Review Submissions ({submissions.filter((submission) => submission.assignmentId === asg.id).length}) →
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAssignment(asg)}
                          className="font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                          aria-label={`Delete assignment ${asg.title}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Assignment Form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs h-fit space-y-3 text-xs">
              <h3 className="font-bold text-sm text-slate-900">Create New Assignment</h3>
              <form onSubmit={handleCreateAssignment} className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Course</label>
                  <select
                    value={newAsgCourse}
                    onChange={(e) => setNewAsgCourse(e.target.value)}
                    className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    {assignmentCourseOptions.length === 0 ? (
                      <option value="" disabled>
                        No valid courses available
                      </option>
                    ) : (
                      assignmentCourseOptions.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Assignment Title
                  </label>
                  <Input
                    value={newAsgTitle}
                    onChange={(e) => setNewAsgTitle(e.target.value)}
                    placeholder="e.g., Implement Distributed Locks"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Due Date</label>
                    <Input
                      type="date"
                      value={newAsgDue}
                      onChange={(e) => setNewAsgDue(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Max Score</label>
                    <Input
                      type="number"
                      value={newAsgMaxScore}
                      onChange={(e) => setNewAsgMaxScore(Number(e.target.value))}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Rubric & Instructions
                  </label>
                  <Textarea
                    rows={3}
                    value={newAsgDesc}
                    onChange={(e) => setNewAsgDesc(e.target.value)}
                    placeholder="State requirements, starter repositories, and scoring criteria..."
                    className="text-xs"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer"
                >
                  Publish Assignment
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 6: ASSESSMENTS / QUIZZES */}
      {/* ------------------------------------------------------------- */}
      {currentView === "assessments" && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">
              Assessments & Quizzes Management
            </h1>
            <p className="text-xs text-slate-500">
              Construct timed multiple-choice skill assessments and view cohort pass rates.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Existing Quizzes */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Active Course Quizzes</h3>
              <div className="grid gap-4">
                {quizzes.map((q) => {
                  const attempts = quizAttempts.filter((a) => a.quizId === q.id);
                  const passCount = attempts.filter((a) => a.passed).length;
                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-teal-700">{q.courseTitle}</span>
                        <span className="text-slate-500 font-semibold">
                          {q.durationMinutes} mins · {q.questions.length} Questions
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-1">{q.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{q.description}</p>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Attempts: <strong>{attempts.length}</strong> · Pass Rate:{" "}
                          <strong>
                            {attempts.length
                              ? Math.round((passCount / attempts.length) * 100)
                              : 100}
                            %
                          </strong>
                        </span>
                        <span className="font-bold text-emerald-700">
                          Pass Mark: {q.passPercentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create Quiz Form */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs h-fit space-y-3 text-xs">
              <h3 className="font-bold text-sm text-slate-900">Create New Assessment</h3>
              <form onSubmit={handleCreateQuiz} className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Course</label>
                  <select
                    value={newQuizCourse}
                    onChange={(e) => setNewQuizCourse(e.target.value)}
                    className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2 text-xs"
                  >
                    {rows.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quiz Title</label>
                  <Input
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                    placeholder="e.g., Redis Sliding Window Caching Quiz"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Duration (min)
                    </label>
                    <Input
                      type="number"
                      value={newQuizDuration}
                      onChange={(e) => setNewQuizDuration(Number(e.target.value))}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Pass %</label>
                    <Input
                      type="number"
                      value={newQuizPass}
                      onChange={(e) => setNewQuizPass(Number(e.target.value))}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sample Question</label>
                  <Input
                    value={newQText}
                    onChange={(e) => setNewQText(e.target.value)}
                    placeholder="What data structure best supports LRU eviction?"
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Input
                    value={newQOpt1}
                    onChange={(e) => setNewQOpt1(e.target.value)}
                    placeholder="Option A: Hash Map + Doubly Linked List"
                    className="text-xs"
                  />
                  <Input
                    value={newQOpt2}
                    onChange={(e) => setNewQOpt2(e.target.value)}
                    placeholder="Option B: Binary Search Tree"
                    className="text-xs"
                  />
                  <Input
                    value={newQOpt3}
                    onChange={(e) => setNewQOpt3(e.target.value)}
                    placeholder="Option C: Min Heap"
                    className="text-xs"
                  />
                  <Input
                    value={newQOpt4}
                    onChange={(e) => setNewQOpt4(e.target.value)}
                    placeholder="Option D: FIFO Queue"
                    className="text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer"
                >
                  Publish Quiz
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 7: STUDENTS ROSTER */}
      {/* ------------------------------------------------------------- */}
      {currentView === "students" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Student Enrollment Ledger</h1>
              <p className="text-xs text-slate-500">
                Track active students, progress percentages, completed lectures, and certificate
                records.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Filter student..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="h-8.5 pl-8 text-xs w-44"
                />
              </div>

              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="h-8.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="all">All Courses</option>
                {rows.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full table-fixed text-left text-[11px] sm:text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <tr>
                  <th className="break-words px-2 py-3 sm:px-3">Learner</th>
                  <th className="px-4 py-3">Certificates Earned</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Lessons Done</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Completed At</th>
                  <th className="px-4 py-3">Assignments</th>
                  <th className="px-4 py-3">Quizzes</th>
                  <th className="px-4 py-3">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="break-words px-2 py-3 sm:px-3">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                          <UserAvatar
                            src={
                              (s as unknown as Record<string, string>)["studentAvatar"] ||
                              (s as unknown as Record<string, string>)["avatar_url"]
                            }
                            name={s.studentName}
                            className="size-8 text-xs border border-slate-200 shadow-2xs"
                          />
                          <div>
                            <div className="break-words font-bold text-slate-900 dark:text-white">{s.studentName}</div>
                            <div className="break-all text-[10px] text-slate-500 dark:text-slate-400">{s.studentEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                          {
                            students.filter(
                              (item) => item.studentId === s.studentId && item.certificateEarned,
                            ).length
                          }
                        </span>
                      </td>
                      <td className="break-words px-2 py-3 font-semibold text-teal-800 dark:text-teal-300 sm:px-3">{s.courseTitle}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-10 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden sm:w-14">
                            <div
                              className="h-full bg-teal-700 rounded-full"
                              style={{ width: `${s.progress}%` }}
                            />
                          </div>
                          <span className="font-bold">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="break-words px-2 py-3 text-slate-600 font-medium dark:text-slate-300 sm:px-3">
                        {s.completedLessons ?? s.completedLectures ?? 0} /{" "}
                        {s.totalRequiredLessons ?? s.totalLectures ?? 3}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            s.progress >= 100 || s.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {s.progress >= 100 || s.status === "completed"
                            ? "Completed"
                            : "In Progress"}
                        </span>
                      </td>
                      <td className="break-words px-2 py-3 text-slate-500 text-[11px] dark:text-slate-400 sm:px-3">
                        {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="break-words px-2 py-3 text-slate-600 text-[11px] dark:text-slate-300 sm:px-3">
                        {s.assignmentStatus || "No submissions"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[11px]">
                        {s.quizStatus || "No quizzes"}
                      </td>
                      <td className="break-words px-2 py-3 font-mono text-[11px] sm:px-3">
                        {s.certificateEarned || s.certificateId ? (
                          <span className="text-amber-700 font-bold">
                            {s.certificateId || "Earned"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-xs text-slate-500">
                      No student enrollments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 8: SUBMISSIONS & GRADING WORKBENCH */}
      {/* ------------------------------------------------------------- */}
      {currentView === "submissions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                Grading Workbench & Submissions
              </h1>
              <p className="text-xs text-slate-500">
                Evaluate student repositories, assign rubric marks, and publish feedback.
              </p>
            </div>

            <div className="flex gap-1.5">
              {(["all", "pending", "approved"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSubmissionFilter(filter)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                    submissionFilter === filter
                      ? "bg-teal-700 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      src={
                        (sub as unknown as Record<string, string>)["studentAvatar"] ||
                        (sub as unknown as Record<string, string>)["avatar_url"]
                      }
                      name={sub.studentName}
                      className="size-10 text-xs border border-slate-200 mt-0.5"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900">{sub.studentName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{sub.studentEmail}</span>
                        <span className="text-slate-400">·</span>
                        <span
                          className={`font-bold ${
                            sub.status === "approved"
                              ? "text-emerald-700"
                              : sub.status === "needs_revision"
                                ? "text-red-700"
                                : "text-amber-700"
                          }`}
                        >
                          {sub.status === "approved"
                            ? `Approved (${sub.score}/${sub.maxScore})`
                            : sub.status === "needs_revision"
                              ? "Needs Revision"
                              : "Pending Review"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {sub.assignmentTitle}
                      </h3>
                      <p className="text-xs font-semibold text-teal-800">{sub.courseTitle}</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleOpenGrading(sub)}
                    className="self-start bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer"
                  >
                    {sub.status === "pending" ? "Launch Rubric Grading" : "Edit Grade"}
                  </Button>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700">
                  <span className="font-bold text-slate-900 block mb-0.5">
                    Submitted Architecture Summary:
                  </span>
                  <p className="leading-relaxed">{sub.solutionNotes}</p>
                  {sub.githubUrl && (
                    <a
                      href={sub.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-bold text-teal-700 hover:underline"
                    >
                      <ExternalLink className="size-3" /> Inspect Code Repository
                    </a>
                  )}
                </div>

                {sub.feedback && (
                  <div className="mt-3 rounded-xl bg-teal-50/70 border border-teal-200 p-3 text-xs text-teal-900">
                    <span className="font-bold">Faculty Review Notes: </span>
                    <span>{sub.feedback}</span>
                    {sub.gradedBy && (
                      <span className="block mt-1 text-[11px] text-teal-700 font-semibold">
                        Signed: {sub.gradedBy}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 9: ANALYTICS */}
      {/* ------------------------------------------------------------- */}
      {currentView === "analytics" && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">
              Financial Ledger & Cohort Analytics
            </h1>
            <p className="text-xs text-slate-500">
              Gross revenue breakdown, enrollment velocity, and completion outputs.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">
                Gross Revenue per Curriculum Asset
              </h3>
              <div className="space-y-3 text-xs">
                {rows.map((course) => {
                  const courseStudents = students.filter((s) => s.courseSlug === course.slug);
                  const rev = courseStudents.reduce((acc, s) => acc + s.pricePaidInr, 0);
                  return (
                    <div
                      key={course.slug}
                      className="flex items-center justify-between border-b border-slate-100 pb-2.5"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{course.title}</p>
                        <p className="text-slate-500 text-[11px]">
                          {courseStudents.length} students · ₹{course.price_inr} unit fee
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-teal-800">
                        ₹{rev.toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Academic Output Statistics</h3>
              <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Curriculum Completion Ratio</span>
                  <span className="font-bold text-teal-800">{avgCompletion}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 rounded-full"
                    style={{ width: `${avgCompletion}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-center text-xs">
                <div className="rounded-xl border border-slate-200 p-4">
                  <span className="text-slate-500 font-medium">Diplomas Issued</span>
                  <p className="mt-1 text-2xl font-extrabold text-amber-600">
                    {students.filter((s) => s.certificateEarned).length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <span className="text-slate-500 font-medium">Graded Projects</span>
                  <p className="mt-1 text-2xl font-extrabold text-teal-700">
                    {submissions.filter((s) => s.status === "approved").length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 10: PROFILE */}
      {/* ------------------------------------------------------------- */}
      {currentView === "profile" && (
        <div className="space-y-6 max-w-3xl">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">Faculty Profile</h1>
            <p className="text-xs text-slate-500">
              Change your profile picture and display name. These details appear throughout the
              Instructor Studio.
            </p>
          </div>

          {user && (
            <ProfileEditor
              user={user}
              accent="teal"
              roleLabel="Verified Faculty Lead & Department Chair"
            />
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-slate-500">Faculty Role</span>
              <p className="mt-1 font-bold text-slate-900">
                Senior Systems Architecture Instructor
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-slate-500">Department</span>
              <p className="mt-1 font-bold text-slate-900">
                Software Systems & Distributed Computing
              </p>
            </div>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* VIEW 11: SETTINGS */}
      {/* ------------------------------------------------------------- */}
      {currentView === "settings" && (
        <div className="space-y-6 max-w-2xl">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">Faculty Settings</h1>
            <p className="text-xs text-slate-500">
              Configure grading alerts, payouts, and certificate automation.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="font-bold text-slate-900">Appearance</p>
                <p className="text-slate-500 mt-0.5">
                  Switch between the light and dark Skillbridge theme.
                </p>
              </div>
              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Immediate Submission Alerts</p>
                <p className="text-slate-500 mt-0.5">
                  Email whenever a student submits a repository milestone.
                </p>
              </div>
              <input type="checkbox" defaultChecked className="size-4 text-teal-700 rounded" />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <p className="font-bold text-slate-900">Automatic Certificate Generation</p>
                <p className="text-slate-500 mt-0.5">
                  Issue cryptographic diploma IDs when a student reaches 100% completion.
                </p>
              </div>
              <input type="checkbox" defaultChecked className="size-4 text-teal-700 rounded" />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Button
                onClick={() => setMsg({ text: "Faculty preferences updated successfully!" })}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW: CODE LAB (SANDBOX FOR INSTRUCTORS & STUDENTS) */}
      {/* ------------------------------------------------------------- */}
      {currentView === "codelab" && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">
              Faculty Code Lab & Interactive Sandbox
            </h1>
            <p className="text-xs text-slate-500">
              Test programming challenges, verify test runner assertions, and experiment with
              starter code solutions.
            </p>
          </div>
          <CodeLabView />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW: SMART RECALL DECKS (FLASHCARDS) */}
      {/* ------------------------------------------------------------- */}
      {currentView === "recall" && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">
              Smart Recall Decks & Flashcards
            </h1>
            <p className="text-xs text-slate-500">
              Review and preview spaced-repetition recall decks across Frontend, TypeScript, and
              System Architecture.
            </p>
          </div>
          <RecallDecksView />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW: FOCUS STUDIO & POMODORO */}
      {/* ------------------------------------------------------------- */}
      {currentView === "focus" && (
        <div className="space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">
              Faculty Focus & Deep Work Studio
            </h1>
            <p className="text-xs text-slate-500">
              Customizable Pomodoro timer, ambient soundscapes, and grading task lists.
            </p>
          </div>
          <FocusStudioView />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* GRADING DIALOG */}
      {/* ------------------------------------------------------------- */}
      {gradingSub && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-xs p-4 font-sans text-slate-900">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Evaluate Student Submission</h3>
              <p className="text-xs text-teal-700 mt-0.5">
                {gradingSub.assignmentTitle} · {gradingSub.studentName}
              </p>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Verdict</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGradeStatus("approved")}
                    className={`rounded-lg border p-2.5 font-bold transition-all cursor-pointer ${
                      gradeStatus === "approved"
                        ? "border-teal-700 bg-teal-50 text-teal-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ✓ Approve Submission
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradeStatus("needs_revision")}
                    className={`rounded-lg border p-2.5 font-bold transition-all cursor-pointer ${
                      gradeStatus === "needs_revision"
                        ? "border-red-600 bg-red-50 text-red-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ⚠ Request Revision
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Assigned Score (0–100)</span>
                  <span className="font-extrabold text-teal-800">{gradeScore} / 100</span>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={gradeScore}
                  onChange={(e) =>
                    setGradeScore(Math.min(100, Math.max(0, Number(e.target.value))))
                  }
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Faculty Feedback & Architectural Notes
                </label>
                <Textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Detail suggestions, code refactoring advice, and performance observations..."
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
              <Button variant="outline" size="sm" onClick={() => setGradingSub(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveGrade}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer"
              >
                Record Grade & Feedback
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
