import { X, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileEditor } from "@/components/ProfileEditor";
import type { LocalUser } from "@/lib/local-db";

export function ProfileModal({
  user,
  roleLabel,
  accent = "indigo",
  close,
}: {
  user: LocalUser;
  roleLabel: string;
  accent?: "indigo" | "teal";
  close: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={close}
    >
      <div
        className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserCheck className="size-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Edit Profile & Profile Picture
              </h2>
              <p className="text-xs text-muted-foreground">
                Customize how your profile picture appears to teachers and students.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            className="size-8 rounded-full"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </Button>
        </div>

        <ProfileEditor
          user={user}
          roleLabel={roleLabel}
          accent={accent}
          onSaved={() => {
            setTimeout(() => {
              close();
            }, 800);
          }}
        />
      </div>
    </div>
  );
}
