import React from "react";
import { Navigate } from "react-router-dom";
import type { Role, User } from "../../types";

export function ProtectedRoute(props: { user: User | null; allow?: Role[]; children: React.ReactNode }) {
  if (!props.user) return <Navigate to="/auth" replace />;

  if (props.allow && !props.allow.includes(props.user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{props.children}</>;
}
