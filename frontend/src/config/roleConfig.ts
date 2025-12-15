import type { UserRole } from '../types/api';
import type { ShellNavItem } from '../layouts/AppShell';

export type RoleKey = 'admin' | 'hr' | 'candidate';

export interface RoleDefinition {
  key: RoleKey;
  allowedRoles: UserRole[];
  title: string;
  subtitle?: (userName?: string) => string | undefined;
  navItems: ShellNavItem[];
  landing: string;
}

const notificationsNav = { to: '/notifications', label: 'Notifications' };
const notificationSettingsNav = { to: '/settings/notifications', label: 'Notification Settings' };

export const ROLE_CONFIG: Record<RoleKey, RoleDefinition> = {
  admin: {
    key: 'admin',
    allowedRoles: ['admin'],
    title: 'Admin Console',
    subtitle: (name) => (name ? `Welcome, ${name}` : undefined),
    landing: '/admin/overview',
    navItems: [
      { to: '/admin/overview', label: 'System Overview' },
      { to: '/admin/users', label: 'User Management' },
      { to: '/admin/jobs', label: 'Job Management' },
      notificationsNav,
      notificationSettingsNav
    ]
  },
  hr: {
    key: 'hr',
    allowedRoles: ['hr', 'admin'],
    title: 'HR Workspace',
    subtitle: (name) => (name ? `Signed in as ${name}` : undefined),
    landing: '/hr/dashboard',
    navItems: [
      { to: '/hr/dashboard', label: 'Dashboard' },
      { to: '/hr/jobs/overview', label: 'Job Workflows', disabled: true },
      notificationsNav,
      notificationSettingsNav
    ]
  },
  candidate: {
    key: 'candidate',
    allowedRoles: ['candidate'],
    title: 'Candidate Portal',
    subtitle: (name) => (name ? `Welcome, ${name}` : undefined),
    landing: '/candidate/dashboard',
    navItems: [
      { to: '/candidate/dashboard', label: 'Dashboard' },
      { to: '/candidate/resumes', label: 'Resumes' },
      { to: '/candidate/recommendations', label: 'Recommendations' },
      { to: '/candidate/jobs', label: 'Jobs' },
      { to: '/candidate/applications', label: 'Applications' },
      notificationsNav,
      notificationSettingsNav
    ]
  }
};


