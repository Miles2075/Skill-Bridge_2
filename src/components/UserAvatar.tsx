import { useState } from "react";

export function UserAvatar({
  src,
  name = "User",
  initials,
  className = "size-9 text-sm",
  badge,
}: {
  src?: string | null;
  name?: string;
  initials?: string;
  className?: string;
  badge?: React.ReactNode;
}) {
  const [imgError, setImgError] = useState(false);

  const displayInitials =
    initials ||
    name
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]!.toUpperCase())
      .join("") ||
    "U";

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className={`rounded-full object-cover shrink-0 ${className}`}
        />
      ) : (
        <div
          className={`grid place-items-center rounded-full bg-violet font-bold text-white shrink-0 shadow-xs ${className}`}
        >
          {displayInitials}
        </div>
      )}
      {badge && <div className="absolute -bottom-0.5 -right-0.5">{badge}</div>}
    </div>
  );
}
