import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { authApi, refreshCsrfToken, type User } from '../lib/api';

type UserRole = 'admin' | 'teacher' | 'student';

interface AuthContextType {
  role: UserRole;
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Check if user is already logged in on mount.
  // We also pre-fetch the CSRF token here to warm up the session before
  // the user interacts with any form. This eliminates the "first login fails"
  // race condition where the session store hasn't been fully initialised yet.
  useEffect(() => {
    const checkAuth = async () => {
      // AWAIT the CSRF token fetch before anything else.
      // This ensures the SQLite session store finishes its first write
      // before the loading spinner disappears and the user can click "Login".
      // Without this await, a race condition occurs: the CSRF fetch and the
      // login request both try to write to sessions.db simultaneously, causing
      // SQLite to return SQLITE_BUSY and the login to fail with a 500 error
      // on the first attempt only.
      await refreshCsrfToken().catch(() => { /* server unreachable — will fail gracefully on submit */ });

      try {
        const { user } = await authApi.getCurrentUser();
        setUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        // Expected when not logged in
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { user } = await authApi.login(email, password);
      await refreshCsrfToken().catch(() => { /* refreshed on the next mutation */ });
      setUser(user);
      setIsAuthenticated(true);
      // Yönlendirme auth.tsx'de yapılıyor, burada yapma
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean | string> => {
    try {
      const { user } = await authApi.register(name, email, password);
      await refreshCsrfToken().catch(() => { /* refreshed on the next mutation */ });
      setUser(user);
      setIsAuthenticated(true);
      return true;
    } catch (error: any) {
      console.error('Registration failed:', error);
      return error.message || "Kayıt başarısız oldu.";
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      // Ana sayfaya yönlendir (misafir kullanıcı home page'ini görecek)
      setLocation('/');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      role: user?.role || 'student',
      user, 
      isAuthenticated,
      loading,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
