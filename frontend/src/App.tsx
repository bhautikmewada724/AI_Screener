import { Navigate, Route, Routes } from 'react-router-dom';

import RoleLayout from './layouts/RoleLayout';
import LoginPage from './pages/LoginPage';
import HrDashboardPage from './pages/HrDashboardPage';
import JobDetailPage from './pages/JobDetailPage';
import AdminOverviewPage from './pages/AdminOverviewPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AdminJobFormPage from './pages/AdminJobFormPage';
import CandidateDashboardPage from './pages/candidate/CandidateDashboardPage';
import CandidateResumesPage from './pages/candidate/CandidateResumesPage';
import CandidateJobsPage from './pages/candidate/CandidateJobsPage';
import CandidateJobDetailPage from './pages/candidate/CandidateJobDetailPage';
import CandidateApplicationsPage from './pages/candidate/CandidateApplicationsPage';
import CandidateRecommendationsPage from './pages/candidate/CandidateRecommendationsPage';
import NotificationsPage from './pages/NotificationsPage';
import NotificationPreferencesPage from './pages/NotificationPreferencesPage';

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={<RoleLayout allowedRoles={['candidate']} navRole="candidate" />}
      >
        <Route path="/candidate/dashboard" element={<CandidateDashboardPage />} />
        <Route path="/candidate/resumes" element={<CandidateResumesPage />} />
        <Route path="/candidate/recommendations" element={<CandidateRecommendationsPage />} />
        <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
        <Route path="/candidate/jobs/:jobId" element={<CandidateJobDetailPage />} />
        <Route path="/candidate/applications" element={<CandidateApplicationsPage />} />
      </Route>
      <Route
        element={<RoleLayout allowedRoles={['hr', 'admin']} navRole="hr" />}
      >
        <Route path="/hr/dashboard" element={<HrDashboardPage />} />
        <Route path="/hr/jobs/:jobId" element={<JobDetailPage />} />
      </Route>
      <Route
        element={<RoleLayout allowedRoles={['admin']} navRole="admin" />}
      >
        <Route path="/admin/overview" element={<AdminOverviewPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
        <Route path="/admin/jobs" element={<AdminJobsPage />} />
        <Route path="/admin/jobs/new" element={<AdminJobFormPage />} />
        <Route path="/admin/jobs/:jobId/edit" element={<AdminJobFormPage />} />
      </Route>
      <Route
        element={<RoleLayout allowedRoles={['admin', 'hr', 'candidate']} navRole="auto" />}
      >
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;


