import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../auth-context';
import { authApi } from '../../lib/api';
import React from 'react';

// Mock authApi
vi.mock('../../lib/api', () => ({
  authApi: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  refreshCsrfToken: vi.fn().mockResolvedValue('token'),
}));

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()]
}));

describe('Auth Context & useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('initializes with logged-out state if no user session', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Not logged in'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('initializes with logged-in state if user session exists', async () => {
    const mockUser = { id: '1', name: 'Admin', role: 'admin', email: 'admin@test.com' };
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ user: mockUser as any });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.role).toBe('admin');
  });

  it('login updates context state on success', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Not logged in'));
    
    const mockUser = { id: '2', name: 'Student', role: 'student', email: 'student@test.com' };
    vi.mocked(authApi.login).mockResolvedValue({ user: mockUser as any });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@test.com', 'password');
    });

    expect(loginResult).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('login handles failure correctly', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Not logged in'));
    vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult;
    await act(async () => {
      loginResult = await result.current.login('test@test.com', 'wrong');
    });

    expect(loginResult).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logout clears user state', async () => {
    const mockUser = { id: '1', name: 'Admin', role: 'admin', email: 'admin@test.com' };
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({ user: mockUser as any });
    vi.mocked(authApi.logout).mockResolvedValue({ message: 'OK' });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });
});
