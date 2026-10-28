import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  beforeLoad: () => {
    throw redirect({ to: "/student", search: { view: "assignments" } });
  },
  component: () => null,
});
