import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

import NotificationBell from '../NotificationBell';
import { AuthContext } from '../../context/AuthContext';
import * as notificationsApi from '../../api/notifications';

vi.mock('../../api/notifications', () => ({
  fetchNotifications: vi.fn(),
  markAllRead: vi.fn(),
  markRead: vi.fn()
}));

// Minimal EventSource shim for jsdom.
class MockEventSource {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener() {}
  close() {}
  onerror() {}
}

// @ts-expect-error jsdom lacks EventSource; provide shim for tests.
global.EventSource = MockEventSource;

const renderWithProviders = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <AuthContext.Provider
      value={{
        token: 'test-token',
        isAuthenticated: true,
        isBootstrapping: false,
        user: { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin' },
        lastAuthError: null,
        login: async () => ({ id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin' }),
        logout: () => {},
        refreshCurrentUser: async () => {}
      }}
    >
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </AuthContext.Provider>
  );
};

describe('NotificationBell', () => {
  it('renders unread badge from API response', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [],
      unreadCount: 3,
      pageInfo: { page: 1, pageSize: 5, total: 0, pages: 1 }
    } as any);

    renderWithProviders(<NotificationBell />);

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });
});


