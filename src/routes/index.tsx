import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { isReady, isAuthenticated } = useAuth();
  if (!isReady) return null;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}
