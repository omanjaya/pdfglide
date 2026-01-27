/**
 * Authentication hook for user login, registration, and session management.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// Types
interface User {
    id: string;
    email: string;
    name: string | null;
    tier: 'free' | 'pro' | 'business';
    is_verified: boolean;
    created_at: string;
    limits: TierLimits;
}

interface TierLimits {
    daily_file_limit: number;
    max_file_size: number;
    queue_priority: string;
    show_ads: boolean;
    batch_processing: boolean;
    api_access: boolean;
}

interface AuthTokens {
    access_token: string;
    refresh_token: string;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    tier: string;
    limits: TierLimits | null;
}

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Local storage keys
const ACCESS_TOKEN_KEY = 'pdfglide_access_token';
const REFRESH_TOKEN_KEY = 'pdfglide_refresh_token';

// Default anonymous limits
const ANONYMOUS_LIMITS: TierLimits = {
    daily_file_limit: 3,
    max_file_size: 5 * 1024 * 1024, // 5MB
    queue_priority: 'low',
    show_ads: true,
    batch_processing: false,
    api_access: false,
};

// Auth Context
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        tier: 'anonymous',
        limits: ANONYMOUS_LIMITS,
    });

    // Get stored tokens
    const getTokens = useCallback((): AuthTokens | null => {
        if (typeof window === 'undefined') return null;

        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

        if (accessToken && refreshToken) {
            return { access_token: accessToken, refresh_token: refreshToken };
        }
        return null;
    }, []);

    // Store tokens
    const setTokens = useCallback((tokens: AuthTokens) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    }, []);

    // Clear tokens
    const clearTokens = useCallback(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    }, []);

    // Fetch current user
    const fetchUser = useCallback(async (accessToken: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch {
            return null;
        }
    }, []);

    // Refresh tokens
    const refreshTokens = useCallback(async (refreshToken: string): Promise<AuthTokens | null> => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch {
            return null;
        }
    }, []);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            const tokens = getTokens();

            if (!tokens) {
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            // Try to fetch user with access token
            let user = await fetchUser(tokens.access_token);

            // If failed, try to refresh
            if (!user) {
                const newTokens = await refreshTokens(tokens.refresh_token);
                if (newTokens) {
                    setTokens(newTokens);
                    user = await fetchUser(newTokens.access_token);
                }
            }

            if (user) {
                setState({
                    user,
                    isLoading: false,
                    isAuthenticated: true,
                    tier: user.tier,
                    limits: user.limits,
                });
            } else {
                clearTokens();
                setState({
                    user: null,
                    isLoading: false,
                    isAuthenticated: false,
                    tier: 'anonymous',
                    limits: ANONYMOUS_LIMITS,
                });
            }
        };

        initAuth();
    }, [getTokens, fetchUser, refreshTokens, setTokens, clearTokens]);

    // Login
    const login = useCallback(async (email: string, password: string) => {
        const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }

        const tokens: AuthTokens = await response.json();
        setTokens(tokens);

        const user = await fetchUser(tokens.access_token);
        if (user) {
            setState({
                user,
                isLoading: false,
                isAuthenticated: true,
                tier: user.tier,
                limits: user.limits,
            });
        }
    }, [setTokens, fetchUser]);

    // Register
    const register = useCallback(async (email: string, password: string, name?: string) => {
        const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, name }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }

        const tokens: AuthTokens = await response.json();
        setTokens(tokens);

        const user = await fetchUser(tokens.access_token);
        if (user) {
            setState({
                user,
                isLoading: false,
                isAuthenticated: true,
                tier: user.tier,
                limits: user.limits,
            });
        }
    }, [setTokens, fetchUser]);

    // Logout
    const logout = useCallback(() => {
        clearTokens();
        setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            tier: 'anonymous',
            limits: ANONYMOUS_LIMITS,
        });
    }, [clearTokens]);

    // Refresh user data
    const refreshUser = useCallback(async () => {
        const tokens = getTokens();
        if (!tokens) return;

        const user = await fetchUser(tokens.access_token);
        if (user) {
            setState(prev => ({
                ...prev,
                user,
                tier: user.tier,
                limits: user.limits,
            }));
        }
    }, [getTokens, fetchUser]);

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

// Utility hook for checking limits
export function useUserLimits() {
    const { limits, tier, isAuthenticated } = useAuth();

    const checkFileSize = useCallback((fileSize: number): { allowed: boolean; message?: string } => {
        if (!limits) return { allowed: true };

        if (fileSize > limits.max_file_size) {
            const maxMB = limits.max_file_size / (1024 * 1024);
            const fileMB = fileSize / (1024 * 1024);
            return {
                allowed: false,
                message: `File size (${fileMB.toFixed(1)}MB) exceeds limit of ${maxMB}MB. ${tier === 'free' ? 'Upgrade to Pro for larger files!' : 'Create an account for more!'
                    }`,
            };
        }
        return { allowed: true };
    }, [limits, tier]);

    return {
        limits,
        tier,
        isAuthenticated,
        showAds: limits?.show_ads ?? true,
        canBatch: limits?.batch_processing ?? false,
        checkFileSize,
    };
}
