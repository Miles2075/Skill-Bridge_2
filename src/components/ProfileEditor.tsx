import { useState, useRef, useEffect } from "react";
import { Loader2, Save, Upload, Link as LinkIcon, Trash2, Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lmsClient } from "@/lib/lms-client";
import { updateLocalSessionProfile, type LocalUser } from "@/lib/local-db";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";

const AVATAR_PRESETS = [
  {
    id: "1",
    label: "Software Engineer",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "2",
    label: "Tech Lead",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "3",
    label: "Lead Instructor",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "4",
    label: "System Architect",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "5",
    label: "Senior Engineer",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "6",
    label: "Fullstack Mentor",
    url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "7",
    label: "Data Faculty",
    url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "8",
    label: "Algorithms Coach",
    url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "9",
    label: "Frontend Specialist",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "10",
    label: "DevOps Expert",
    url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=180&auto=format&fit=crop&q=80",
  },
  {
    id: "11",
    label: "Robot Techie",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=SkillbridgeDev",
  },
  {
    id: "12",
    label: "Illustrated Coder",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=CodePro",
  },
];

export function ProfileEditor({
  user,
  accent = "indigo",
  roleLabel,
  onSaved,
}: {
  user: LocalUser;
  accent?: "indigo" | "teal";
  roleLabel: string;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(user.user_metadata?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.user_metadata?.avatar_url || null);

  useEffect(() => {
    setName(user.user_metadata?.display_name || "");
    setAvatarUrl(user.user_metadata?.avatar_url || null);
  }, [user.id, user.user_metadata?.display_name, user.user_metadata?.avatar_url]);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [showUrlField, setShowUrlField] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const styles =
    accent === "teal"
      ? {
          button: "bg-teal-700 hover:bg-teal-800 text-white",
          text: "text-teal-400",
          border: "border-teal-500/30",
          bg: "bg-teal-950/20",
        }
      : {
          button: "bg-indigo-600 hover:bg-indigo-700 text-white",
          text: "text-indigo-600",
          border: "border-indigo-200",
          bg: "bg-indigo-50/50",
        };

  // Resize uploaded image file to lightweight canvas DataURL
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image file (JPG, PNG, WebP).");
      setMsgType("error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatarUrl(resizedDataUrl);
          setMessage("Custom photo selected.");
          setMsgType("success");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function applyCustomUrl() {
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    setAvatarUrl(trimmed);
    setShowUrlField(false);
    setCustomUrlInput("");
    setMessage("Avatar URL applied.");
    setMsgType("success");
  }

  async function save() {
    const displayName = name.trim();
    if (!displayName) {
      setMessage("Please enter your name.");
      setMsgType("error");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await lmsClient.updateProfile({ displayName, avatarUrl });
      updateLocalSessionProfile({ displayName, avatarUrl });
      setMessage("Profile and avatar updated successfully!");
      setMsgType("success");
      window.dispatchEvent(new CustomEvent("local_auth_changed"));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("lms_data_updated"));
      onSaved?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to update profile.");
      setMsgType("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar Header & Live Preview */}
      <div
        className={`rounded-xl border ${styles.border} ${styles.bg} p-5 flex flex-col sm:flex-row items-center gap-5`}
      >
        <div className="relative group">
          <UserAvatar
            src={avatarUrl}
            name={name || user.email}
            className="size-20 text-2xl border-2 border-background shadow-md"
            badge={
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-transform cursor-pointer"
                title="Change Photo"
              >
                <Camera className="size-3.5" />
              </button>
            }
          />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1">
          <h3 className="text-base font-bold">{name || "Learner"}</h3>
          <p className="text-xs text-muted-foreground">
            {user.email} · <span className="font-semibold text-foreground">{roleLabel}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            This profile picture will be visible to your instructors, students, and peers across
            Skillbridge.
          </p>

          {/* Quick Avatar Actions */}
          <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" /> Upload Photo
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8"
              onClick={() => setShowUrlField((prev) => !prev)}
            >
              <LinkIcon className="size-3.5" /> Image Link
            </Button>

            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 h-8 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setAvatarUrl(null);
                  setMessage("Avatar reset to default initials.");
                  setMsgType("success");
                }}
              >
                <Trash2 className="size-3.5" /> Remove Photo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* URL Input Box */}
      {showUrlField && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-in fade-in">
          <label className="text-xs font-bold text-foreground">Paste Image URL</label>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/my-photo.jpg"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              className="text-xs"
            />
            <Button type="button" size="sm" onClick={applyCustomUrl}>
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* Curated Preset Grid */}
      <div>
        <label className="text-xs font-bold text-foreground mb-2 block">
          Choose from Curated Avatar Presets
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
          {AVATAR_PRESETS.map((preset) => {
            const isSelected = avatarUrl === preset.url;
            return (
              <button
                type="button"
                key={preset.id}
                onClick={() => {
                  setAvatarUrl(preset.url);
                  setMessage(`Selected "${preset.label}" preset.`);
                  setMsgType("success");
                }}
                className={`relative group flex flex-col items-center rounded-lg p-2 border transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-xs"
                    : "border-border hover:border-primary/50 hover:bg-secondary"
                }`}
                title={preset.label}
              >
                <img
                  src={preset.url}
                  alt={preset.label}
                  className="size-11 rounded-full object-cover"
                  loading="lazy"
                />
                <span className="mt-1 text-[10px] text-muted-foreground truncate max-w-full font-medium">
                  {preset.label.split(" ")[0]}
                </span>
                {isSelected && (
                  <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground text-[9px]">
                    <Check className="size-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Appearance & Theme Preference Section */}
      <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 space-y-2`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Appearance & Theme Mode
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select your preferred color theme (Light, Dark, or System mode).
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Personal Info Form */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <label className="text-xs font-bold text-foreground">Display Name</label>
          <Input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-foreground">Email Address</label>
          <Input
            value={user.email}
            disabled
            className="mt-1.5 bg-secondary text-muted-foreground"
          />
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {message && (
            <span
              className={`text-xs font-medium ${
                msgType === "error" ? "text-destructive" : "text-emerald-500 font-semibold"
              }`}
            >
              {message}
            </span>
          )}
          <Button
            onClick={() => void save()}
            disabled={saving}
            className={`ml-auto ${styles.button}`}
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save Profile & Avatar
          </Button>
        </div>
      </div>
    </div>
  );
}
