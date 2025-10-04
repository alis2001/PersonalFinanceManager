import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from './authService';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  defaultCurrency: string;
  accountType?: 'personal' | 'business';
  companyName?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; message?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; message?: string }>;
  logout: () => Promise<void>;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType?: 'personal' | 'business';
  companyName?: string;
  defaultCurrency: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        const userProfile = await authService.getProfile();
        if (userProfile) {
          setUser(userProfile);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await authService.login(email, password);
      
      if (result.success && result.user && result.tokens) {
        await authService.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
        setUser(result.user);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error,
          requiresVerification: result.requiresVerification,
          message: result.message,
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const result = await authService.register(userData);
      
      if (result.success && result.user && result.tokens) {
        await authService.setTokens(result.tokens.accessToken, result.tokens.refreshToken);
        setUser(result.user);
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error,
          requiresVerification: result.requiresVerification,
          message: result.message,
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails on server, clear local state
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};