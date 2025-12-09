import { ShellNavItem } from './AppShell';

export const adminNavItems: ShellNavItem[] = [
  { to: '/admin/overview', label: 'System Overview' },
  { to: '/admin/users', label: 'User Management' },
  { to: '/admin/jobs', label: 'Job Management' }
];

export const hrNavItems: ShellNavItem[] = [
  { to: '/hr/dashboard', label: 'Dashboard' },
  { to: '/hr/jobs/overview', label: 'Job Workflows', disabled: true }
];

export const candidateNavItems: ShellNavItem[] = [
  { to: '/candidate/dashboard', label: 'Dashboard' },
  { to: '/candidate/resumes', label: 'Resumes' },
  { to: '/candidate/recommendations', label: 'Recommendations' },
  { to: '/candidate/jobs', label: 'Jobs' },
  { to: '/candidate/applications', label: 'Applications' }
];


