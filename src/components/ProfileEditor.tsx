import { useState } from "react";
import { Loader2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lmsClient } from "@/lib/lms-client";
import { getLocalSession, updateLocalSessionProfile, type LocalUser } from "@/lib/local-db";

export function ProfileEditor({
  user,
  accent = "indigo",
  roleLabel,
}: {
  user: LocalUser;
  accent?: "indigo" | "teal";
  roleLabel: string;
}) {
  const [name, setName] = useState(user.user_metadata?.display_name || "");
  const initialAvatar = user.user_metadata?.avatar_url || "";
  const [avatarUrl, setAvatarUrl] = useState(() => {
    const localUser = getLocalSession();
    if (localUser?.id && /^https:\/\/.+\.public\.blob\.vercel-storage\.com\//.test(initialAvatar)) {
      return `/api/lms/avatar?userId=${encodeURIComponent(localUser.id)}&v=${Date.now()}`;
    }
    return initialAvatar;
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");

  const styles =
    accent === "teal"
      ? {
          button: "bg-teal-700 hover:bg-teal-800 text-white",
          text: "text-teal-700",
        }
      : {
          button: "bg-indigo-600 hover:bg-indigo-700 text-white",
          text: "text-indigo-700",
        };

  async function uploadAvatar(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setMessage("Profile picture must be 4 MB or smaller.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setMessage("Use a JPG, PNG, WebP, or GIF image.");
      return;
    }

    setUploadingAvatar(true);
    setMessage("");
    try {
      const uploaded = await lmsClient.uploadAvatar(file);
      setAvatarUrl(uploaded.avatarUrl);
      updateLocalSessionProfile({ avatarUrl: uploaded.avatarUrl });
      setMessage("Profile picture updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    const displayName = name.trim();
    if (!displayName) {
      setMessage("Please enter your name.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await lmsClient.updateProfile({ displayName });
      updateLocalSessionProfile({ displayName });
      setMessage("Profile updated successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name || "Profile picture"}
                className="h-full w-full object-cover"
                onError={() => setAvatarUrl("")}
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center text-2xl font-bold ${styles.text}`}>
                {(name || user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
          <p className="mt-1 text-xs text-slate-500">
            Update how your profile appears across Skillbridge.
          </p>
          <label className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 ${uploadingAvatar ? "pointer-events-none opacity-60" : ""}`}>
            {uploadingAvatar ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {uploadingAvatar ? "Uploading…" : "Change Profile Picture"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploadingAvatar}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAvatar(file);
                e.target.value = "";
              }}
            />
          </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700">Display Name</label>
          <Input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700">Email</label>
          <Input value={user.email} disabled className="mt-1.5 bg-slate-50" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs ${styles.text}`}>{message}</span>
          <Button onClick={() => void save()} disabled={saving} className={styles.button}>
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save Profile
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
        Account type: <span className="font-semibold text-slate-700">{roleLabel}</span>
      </div>
    </div>
  );
}
