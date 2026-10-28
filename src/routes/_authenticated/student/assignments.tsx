import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  component: StudentAssignmentsRedirect,
});

/** Keep the legacy URL working, but render assignments inside the normal student portal. */
function StudentAssignmentsRedirect() {
  useEffect(() => {
    window.location.replace("/student?view=assignments");
  }, []);

  return null;
}
