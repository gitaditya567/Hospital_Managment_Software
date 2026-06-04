import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../../store/useAuthStore';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to their default dashboard
    switch (user.role) {
      case 'SUPER_ADMIN': return <Navigate to="/super-admin" replace />;
      case 'HOSPITAL_ADMIN': return <Navigate to="/hospital-admin" replace />;
      case 'RECEPTIONIST': return <Navigate to="/receptionist" replace />;
      case 'DOCTOR': return <Navigate to="/doctor" replace />;
      case 'PHARMACY': return <Navigate to="/pharmacy" replace />;
      default: return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
