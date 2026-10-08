import tsThumb from "@/assets/course-typescript.jpg";
import reactThumb from "@/assets/course-react.jpg";
import systemThumb from "@/assets/course-system-design.jpg";
import dsaThumb from "@/assets/course-dsa.jpg";

const FALLBACK_THUMBNAIL = tsThumb;

export function getCourseThumbnail(slug: string, thumbnail?: string | null): string {
  if (thumbnail) return thumbnail;

  switch (slug) {
    case "advanced-typescript":
      return tsThumb;
    case "react-performance":
      return reactThumb;
    case "system-design":
      return systemThumb;
    case "dsa":
      return dsaThumb;
    default:
      return FALLBACK_THUMBNAIL;
  }
}
