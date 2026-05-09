"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
    endAppSession,
    recordPageView,
    recordSessionHeartbeat,
    startAppSession,
} from "@/lib/supabase/activity";

interface AuthContextValue {
    accessToken: string | null;
    isConfigured: boolean;
    isLoading: boolean;
    session: Session | null;
    user: User | null;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, fullName: string) => Promise<string | null>;
    signInWithGoogle: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getRedirectUrl(path: string) {
    if (typeof window === "undefined") {
        return path;
    }
    return `${window.location.origin}${path}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [supabase] = useState<SupabaseClient | null>(() =>
        isSupabaseConfigured ? createClient() : null,
    );
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
    const appSessionIdRef = useRef<string | null>(null);
    const pageViewPathRef = useRef<string | null>(null);

    useEffect(() => {
        if (!supabase) {
            return;
        }

        let isMounted = true;
        void supabase.auth.getSession().then(({ data }) => {
            if (!isMounted) return;
            setSession(data.session);
            setIsLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setIsLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [supabase]);

    useEffect(() => {
        if (!supabase || !session?.user) {
            return;
        }

        let isMounted = true;
        const user = session.user;

        const startTracking = async () => {
            try {
                const appSessionId = await startAppSession(supabase, user);
                if (!isMounted) {
                    await endAppSession(supabase, user, appSessionId);
                    return;
                }
                appSessionIdRef.current = appSessionId;
                pageViewPathRef.current = typeof window === "undefined" ? null : window.location.pathname;
            } catch (error) {
                console.warn("[Auth] Unable to start app session tracking.", error);
            }
        };

        void startTracking();

        const heartbeatId = window.setInterval(() => {
            const appSessionId = appSessionIdRef.current;
            if (!appSessionId) return;
            void recordSessionHeartbeat(supabase, user, appSessionId);
        }, 30000);

        const pageViewId = window.setInterval(() => {
            const appSessionId = appSessionIdRef.current;
            if (!appSessionId || typeof window === "undefined") return;

            const currentPath = window.location.pathname;
            if (currentPath === pageViewPathRef.current) return;

            pageViewPathRef.current = currentPath;
            void recordPageView(supabase, user, appSessionId);
        }, 1000);

        const handleVisibilityChange = () => {
            const appSessionId = appSessionIdRef.current;
            if (!appSessionId || document.visibilityState !== "hidden") return;
            void recordSessionHeartbeat(supabase, user, appSessionId);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            isMounted = false;
            window.clearInterval(heartbeatId);
            window.clearInterval(pageViewId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);

            const appSessionId = appSessionIdRef.current;
            appSessionIdRef.current = null;
            pageViewPathRef.current = null;
            if (appSessionId) {
                void endAppSession(supabase, user, appSessionId);
            }
        };
    }, [session?.user, supabase]);

    const signInWithEmail = useCallback(
        async (email: string, password: string) => {
            if (!supabase) throw new Error("Supabase is not configured.");

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        },
        [supabase],
    );

    const signUpWithEmail = useCallback(
        async (email: string, password: string, fullName: string) => {
            if (!supabase) throw new Error("Supabase is not configured.");

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                    emailRedirectTo: getRedirectUrl("/auth/callback?next=/learn"),
                },
            });
            if (error) throw error;
            return data.session ? null : "Check your email to confirm your account before signing in.";
        },
        [supabase],
    );

    const signInWithGoogle = useCallback(async () => {
        if (!supabase) throw new Error("Supabase is not configured.");

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: getRedirectUrl("/auth/callback?next=/learn"),
            },
        });
        if (error) throw error;
    }, [supabase]);

    const resetPassword = useCallback(
        async (email: string) => {
            if (!supabase) throw new Error("Supabase is not configured.");

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: getRedirectUrl("/auth/callback?next=/learn"),
            });
            if (error) throw error;
        },
        [supabase],
    );

    const signOut = useCallback(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }, [supabase]);

    const value = useMemo<AuthContextValue>(
        () => ({
            accessToken: session?.access_token ?? null,
            isConfigured: isSupabaseConfigured,
            isLoading,
            session,
            user: session?.user ?? null,
            signInWithEmail,
            signUpWithEmail,
            signInWithGoogle,
            resetPassword,
            signOut,
        }),
        [
            isLoading,
            resetPassword,
            session,
            signInWithEmail,
            signInWithGoogle,
            signOut,
            signUpWithEmail,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider.");
    }
    return context;
}
