import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ReactNode } from "react";
import { Plane } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: "admin" | "atc" | "staff";
}

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Plane className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Loading AeroControl...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireRole === "admin" && role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (requireRole === "atc" && role !== "admin" && role !== "atc") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
