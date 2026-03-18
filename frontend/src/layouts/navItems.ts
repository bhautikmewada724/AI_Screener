import type { ShellNavItem } from './AppShell';
import { ROLE_CONFIG } from '../config/roleConfig';

export const adminNavItems: ShellNavItem[] = ROLE_CONFIG.admin.navItems;
export const hrNavItems: ShellNavItem[] = ROLE_CONFIG.hr.navItems;
export const candidateNavItems: ShellNavItem[] = ROLE_CONFIG.candidate.navItems;


