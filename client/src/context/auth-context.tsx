import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { authApi, type User } from '../lib/api';

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

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await authApi.getCurrentUser();
        setUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        // Expected error when not logged in
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
      setUser(user);
      setIsAuthenticated(true);
      // Yönlendirme auth.tsx'de yapılıyor, burada yapma
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const { user } = await authApi.register(name, email, password);
      setUser(user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
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
