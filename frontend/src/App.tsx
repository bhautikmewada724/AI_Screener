import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import HrLayout from './layouts/HrLayout';
import LoginPage from './pages/LoginPage';
import HrDashboardPage from './pages/HrDashboardPage';
import JobDetailPage from './pages/JobDetailPage';
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
      <Route path="*" element={<Navigate to="/hr/dashboard" replace />} />
    </Routes>
  );
};

export default App;


