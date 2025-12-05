import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import HrLayout from './layouts/HrLayout';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import HrDashboardPage from './pages/HrDashboardPage';
import JobDetailPage from './pages/JobDetailPage';
import AdminOverviewPage from './pages/AdminOverviewPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AdminJobFormPage from './pages/AdminJobFormPage';
import { useAuth } from './hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Array<'admin' | 'hr' | 'candidate'>;
}

const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { isAuthenticated, user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#475569' }}>
        Verifying session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute roles={['hr', 'admin']}>
            <HrLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/hr/dashboard" element={<HrDashboardPage />} />
        <Route path="/hr/jobs/:jobId" element={<JobDetailPage />} />
      </Route>
      <Route
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/overview" element={<AdminOverviewPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        <Route path="/admin/jobs" element={<AdminJobsPage />} />
        <Route path="/admin/jobs/new" element={<AdminJobFormPage />} />
        <Route path="/admin/jobs/:jobId/edit" element={<AdminJobFormPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/hr/dashboard" replace />} />
    </Routes>
  );
};

export default App;


