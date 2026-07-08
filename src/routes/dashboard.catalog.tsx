import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/catalog")({
  component: () => <Outlet />,
});
