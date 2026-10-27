import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  component: RemovedStudentAssignmentsPage,
});

/** The standalone student assignments page has been retired. */
function RemovedStudentAssignmentsPage() {
  useEffect(() => {
    window.location.replace("/student?view=dashboard");
  }, []);

  return null;
}
