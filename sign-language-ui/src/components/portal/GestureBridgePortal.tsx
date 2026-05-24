"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Languages,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Medal,
  Search,
  Star,
  Target,
  Trophy,
  UserPlus,
  Video,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  getSignLibrary,
  type LibraryLanguage,
  type SignLibraryEntry,
  scoreLearningAttempt,
  type LearningScoreResponse,
} from "@/lib/api";
import { TRSL_WORD_PAUSE_SECONDS, TRSL_WORD_RECORDING_SECONDS } from "@/lib/config";
import TrslWordRecorder from "@/components/TrslWordRecorder";

type AuthMode = "login" | "signup";
type PortalSection = "learn" | "library" | "progress";

interface PortalShellProps {
  activeSection: PortalSection;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

interface NavItem {
  id: PortalSection;
  label: string;
  href: string;
  icon: LucideIcon;
}

interface MasteryItem {
  word: string;
  value: number;
  status: string;
}

const navItems: NavItem[] = [
  { id: "learn", label: "Learn", href: "/learn", icon: GraduationCap },
  { id: "library", label: "Library", href: "/library", icon: BookOpen },
  { id: "progress", label: "Progress", href: "/progress", icon: BarChart3 },
];

const masteryItems: MasteryItem[] = [
  { word: "Thank You", value: 100, status: "Mastered" },
  { word: "Family", value: 100, status: "Mastered" },
  { word: "Hello", value: 96, status: "Mastered" },
  { word: "Help", value: 82, status: "Needs Review" },
  { word: "Water", value: 61, status: "In Progress" },
  { word: "Please", value: 34, status: "Just Started" },
];

function IconBadge({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${className}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function ProgressRing({ value, color }: { value: number; color: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;

  return (
    <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke="#d9e2ec"
        strokeWidth="8"
      />
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="8"
      />
    </svg>
  );
}

function getInitials(email?: string | null, fullName?: string | null) {
  const source = fullName?.trim() || email?.split("@")[0] || "Learner";
  const initials = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");
  return initials || "GB";
}

function getAuthRedirectMessage(params: URLSearchParams) {
  const error = params.get("auth_error") ?? params.get("error");
  const errorCode = params.get("auth_error_code") ?? params.get("error_code");
  const description = params.get("auth_error_description") ?? params.get("error_description");

  if (!error && !errorCode && !description) {
    return null;
  }

  if (errorCode === "otp_expired" || /invalid|expired/i.test(description ?? error ?? "")) {
    return "That confirmation link is invalid or expired. Use the newest email link, or sign up again to send a fresh confirmation email.";
  }

  return description ?? error ?? "Authentication failed. Please try again.";
}

function getAuthRedirectErrorFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const queryMessage = getAuthRedirectMessage(new URLSearchParams(window.location.search));
  if (queryMessage) {
    return queryMessage;
  }

  if (!window.location.hash.startsWith("#")) {
    return null;
  }

  return getAuthRedirectMessage(new URLSearchParams(window.location.hash.slice(1)));
}

function toLearningWordKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getLearningScoreWord(entry: SignLibraryEntry) {
  if (entry.learning_word) {
    return entry.learning_word;
  }
  if (entry.language === "TRSL" && entry.translation) {
    return toLearningWordKey(entry.translation);
  }
  return toLearningWordKey(entry.word);
}

function AuthStatusScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 text-[#102033]">
      <div className="w-full max-w-md rounded-lg border border-[#d9e2ec] bg-white p-6 text-center shadow-[0_18px_55px_rgba(16,32,51,0.08)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#edf3f8] text-[#14213d]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-[#50627a]">{message}</p>
      </div>
    </main>
  );
}

function PortalShell({ activeSection, eyebrow, title, subtitle, children }: PortalShellProps) {
  const router = useRouter();
  const { configurationError, isConfigured, isLoading, signOut, user } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const displayName =
    typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const initials = getInitials(user?.email, displayName);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current?.contains(event.target as Node)) return;
      setIsUserMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await signOut();
    router.replace("/");
  };

  if (!isConfigured) {
    return <AuthStatusScreen message="Supabase environment variables are not configured yet." />;
  }

  if (configurationError) {
    return <AuthStatusScreen message={configurationError} />;
  }

  if (isLoading || !user) {
    return <AuthStatusScreen message="Checking your session..." />;
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#102033]">
      <header className="sticky top-0 z-40 border-b border-[#d9e2ec] bg-white/92 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/learn" className="flex items-center gap-3" aria-label="GestureBridge home">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#c9d6e2] bg-white shadow-sm">
              <Image src="/logo-bridge.png" alt="" width={30} height={30} priority />
            </span>
            <span className="text-xl font-bold text-[#132238]">GestureBridge</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeSection;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#14213d] text-white"
                      : "text-[#5d6b7c] hover:bg-[#edf3f8] hover:text-[#102033]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hidden h-10 w-10 items-center justify-center rounded-lg text-[#50627a] transition hover:bg-[#edf3f8] sm:inline-flex"
              aria-label="Change language"
            >
              <Languages className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="relative h-10 w-10 rounded-lg text-[#50627a] transition hover:bg-[#edf3f8]"
              aria-label="Notifications"
            >
              <Bell className="mx-auto h-5 w-5" aria-hidden="true" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e85d5d]" />
            </button>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14213d] text-sm font-bold text-white shadow-sm transition hover:bg-[#24385f] focus:outline-none focus:ring-4 focus:ring-[#2563eb]/20"
                title={user.email ?? "Signed in learner"}
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                {initials}
              </button>

              {isUserMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-[#d9e2ec] bg-white text-[#102033] shadow-[0_18px_45px_rgba(16,32,51,0.16)]"
                >
                  <div className="border-b border-[#e3ebf3] px-4 py-3">
                    <p className="truncate text-sm font-bold">
                      {displayName ?? "GestureBridge learner"}
                    </p>
                    {user.email && (
                      <p className="mt-1 truncate text-xs font-semibold text-[#5d6b7c]">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <section className="mb-6 flex flex-col gap-3 border-b border-[#d9e2ec] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0f766e]">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#102033] sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[#5d6b7c]">{subtitle}</p>
          </div>
        </section>

        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 z-50 w-full border-t border-[#d9e2ec] bg-white px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 shadow-[0_-12px_30px_rgba(16,32,51,0.08)] md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#14213d] text-white"
                    : "text-[#5d6b7c] hover:bg-[#edf3f8] hover:text-[#102033]"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function LoginPage() {
  const router = useRouter();
  const {
    isConfigured,
    isLoading,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    resendSignUpConfirmation,
    resetPassword,
    configurationError,
    user,
  } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = authMode === "signup";
  const authMessage = errorMessage ?? configurationError;
  const canResendConfirmation = Boolean(errorMessage?.toLowerCase().includes("confirmation link"));
  const isAuthUnavailable = !isConfigured || Boolean(configurationError);

  useEffect(() => {
    const redirectError = getAuthRedirectErrorFromLocation();
    if (!redirectError) return;

    setErrorMessage(redirectError);
    setStatusMessage(null);
    window.history.replaceState(null, "", window.location.pathname || "/");
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/learn");
    }
  }, [isLoading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }
    if (isSignup && !fullName.trim()) {
      setErrorMessage("Full name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignup) {
        const message = await signUpWithEmail(normalizedEmail, password, fullName.trim());
        if (message) {
          setStatusMessage(message);
          return;
        }
      } else {
        await signInWithEmail(normalizedEmail, password);
      }
      router.replace("/learn");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Google sign-in failed.");
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Enter your email first, then request a reset link.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(normalizedEmail);
      setStatusMessage("Password reset email sent.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Enter your email first, then send a new confirmation email.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resendSignUpConfirmation(normalizedEmail);
      setStatusMessage("Confirmation email sent. Use the newest link in your inbox.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send confirmation email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-8 text-[#102033] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-3" aria-label="GestureBridge">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#d9e2ec] bg-white shadow-sm">
              <Image src="/logo-bridge.png" alt="" width={32} height={32} priority />
            </span>
            <span className="text-2xl font-bold text-[#102033]">GestureBridge</span>
          </Link>
          <p className="mt-3 text-sm text-[#5d6b7c]">
            {isSignup ? "Create your learning account." : "Sign in to your learning account."}
          </p>
        </div>

        <div className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_55px_rgba(16,32,51,0.08)] sm:p-8">
          <div>
            <h1 className="text-2xl font-bold text-[#102033]">
              {isSignup ? "Create account" : "Log in"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#5d6b7c]">
              {isSignup
                ? "Set up a profile for lessons, library, and progress."
                : "Enter your email and password to continue."}
            </p>
          </div>

            {!isConfigured && (
              <div className="mt-5 rounded-lg border border-[#f5c2c7] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#9f1239]">
                Supabase is not configured yet. Add the project URL and publishable key to the environment.
              </div>
            )}

            {authMessage && (
              <div className="mt-5 rounded-lg border border-[#f5c2c7] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#9f1239]">
                <p>{authMessage}</p>
                {canResendConfirmation && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isAuthUnavailable || isSubmitting}
                    className="mt-3 rounded-md border border-[#f3a7b3] bg-white px-3 py-2 text-xs font-bold text-[#9f1239] transition hover:bg-[#fff7f8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send New Confirmation Email
                  </button>
                )}
              </div>
            )}

            {statusMessage && (
              <div className="mt-5 rounded-lg border border-[#b7eadf] bg-[#ecfdf5] px-4 py-3 text-sm font-semibold text-[#0f766e]">
                {statusMessage}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 rounded-lg bg-[#edf3f8] p-1">
              {(["login", "signup"] as AuthMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAuthMode(mode)}
                  className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                    authMode === mode ? "bg-white text-[#102033] shadow-sm" : "text-[#5d6b7c]"
                  }`}
                >
                  {mode === "login" ? "Log In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {isSignup && (
                <label className="block text-sm font-semibold text-[#102033]">
                  Full Name
                  <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#c9d6e2] bg-white px-4 py-3 focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/12">
                    <UserPlus className="h-5 w-5 text-[#6b7c90]" aria-hidden="true" />
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-[#8493a5]"
                      placeholder="Sarah Greene"
                      autoComplete="name"
                    />
                  </span>
                </label>
              )}

              <label className="block text-sm font-semibold text-[#102033]">
                Email Address
                <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#c9d6e2] bg-white px-4 py-3 focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/12">
                  <Mail className="h-5 w-5 text-[#6b7c90]" aria-hidden="true" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[#8493a5]"
                    placeholder="learner@example.com"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </span>
              </label>

              <label className="block text-sm font-semibold text-[#102033]">
                Password
                <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#c9d6e2] bg-white px-4 py-3 focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/12">
                  <Lock className="h-5 w-5 text-[#6b7c90]" aria-hidden="true" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[#8493a5]"
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="rounded-md p-1 text-[#6b7c90] transition hover:bg-[#edf3f8] hover:text-[#102033]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>

              {!isSignup && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isAuthUnavailable || isSubmitting}
                    className="text-sm font-semibold text-[#2563eb] hover:text-[#174ea6] disabled:cursor-not-allowed disabled:text-[#8493a5]"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthUnavailable || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#14213d] px-4 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(20,33,61,0.22)] transition hover:bg-[#24385f] disabled:cursor-not-allowed disabled:bg-[#9ba7b5] disabled:shadow-none"
              >
                {isSubmitting ? "Working..." : isSignup ? "Create Account" : "Sign In"}
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : isSignup ? (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isAuthUnavailable || isSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#c9d6e2] bg-white px-4 py-3.5 text-sm font-bold text-[#102033] transition hover:bg-[#f7fafc] disabled:cursor-not-allowed disabled:text-[#8493a5]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#d9e2ec] text-xs font-black">
                  G
                </span>
                Continue with Google
              </button>
            </form>

            <form action="/auth/demo" method="post" className="mt-3">
              <input type="hidden" name="next" value="/learn" />
              <button
                type="submit"
                disabled={isAuthUnavailable || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b5d57] disabled:cursor-not-allowed disabled:bg-[#9ba7b5]"
              >
                Try Demo Account
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

        </div>
      </div>
    </main>
  );
}

export function LearnPage() {
  const { accessToken, user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<LibraryLanguage>("TRSL");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SignLibraryEntry[]>([]);
  const [counts, setCounts] = useState<Record<LibraryLanguage, number>>({ ASL: 0, TRSL: 0 });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isScoringAttempt, setIsScoringAttempt] = useState(false);
  const [recordingEntryId, setRecordingEntryId] = useState<string | null>(null);
  const [attemptVideoUrl, setAttemptVideoUrl] = useState<string | null>(null);
  const [attemptResult, setAttemptResult] = useState<LearningScoreResponse | null>(null);
  const [attemptMessage, setAttemptMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLibrary = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await getSignLibrary(selectedLanguage);
        if (!isMounted) return;
        setEntries(response.entries);
        setCounts(response.language_counts);
        setSelectedEntryId((current) =>
          current && response.entries.some((entry) => entry.id === current)
            ? current
            : response.entries[0]?.id ?? null,
        );
      } catch (error) {
        if (!isMounted) return;
        setEntries([]);
        setSelectedEntryId(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load learning words from the library API.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadLibrary();
    return () => {
      isMounted = false;
    };
  }, [selectedLanguage]);

  useEffect(() => {
    setQuery("");
    setSelectedEntryId(null);
  }, [selectedLanguage]);

  useEffect(() => {
    return () => {
      if (attemptVideoUrl) {
        URL.revokeObjectURL(attemptVideoUrl);
      }
    };
  }, [attemptVideoUrl]);

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) =>
      [
        entry.word,
        entry.display_word,
        entry.translation,
        entry.language,
        entry.dataset,
        entry.source,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [entries, query]);

  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? entries[0] ?? null;
  const wordDeck = filteredEntries.slice(0, 80);

  const handleNextWord = () => {
    const source = filteredEntries.length > 0 ? filteredEntries : entries;
    if (source.length === 0) return;
    const currentIndex = selectedEntry
      ? source.findIndex((entry) => entry.id === selectedEntry.id)
      : -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % source.length : 0;
    setSelectedEntryId(source[nextIndex].id);
  };

  const clearAttemptVideo = () => {
    setAttemptVideoUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  };

  const handleStartRecording = () => {
    if (!selectedEntry) return;
    setRecordingEntryId(selectedEntry.id);
    setAttemptResult(null);
    setAttemptMessage(null);
    clearAttemptVideo();
    setIsRecorderOpen(true);
  };

  const handlePracticeCaptureComplete = async (wordClips: Blob[]) => {
    const clip = wordClips[0];
    const targetEntry =
      entries.find((entry) => entry.id === recordingEntryId) ?? selectedEntry;

    setIsRecorderOpen(false);
    if (!clip || !targetEntry) {
      setAttemptMessage("No recording was captured. Please try again.");
      return;
    }

    clearAttemptVideo();
    setAttemptVideoUrl(URL.createObjectURL(clip));
    setAttemptResult(null);
    setAttemptMessage(null);

    if (targetEntry.language !== "TRSL") {
      setAttemptMessage("Recording captured. Automatic scoring is currently available for TRSL words only.");
      return;
    }

    setIsScoringAttempt(true);
    try {
      const scoreResponse = await scoreLearningAttempt(
        clip,
        getLearningScoreWord(targetEntry),
        user?.id ?? "anonymous",
        {
          authToken: accessToken,
          referenceVideoId: targetEntry.video_id,
          referenceWeight: 0.7,
        },
      );
      setAttemptResult(scoreResponse);
    } catch (error) {
      setAttemptMessage(
        error instanceof Error
          ? error.message
          : "Recording captured, but scoring failed. Please try again.",
      );
    } finally {
      setIsScoringAttempt(false);
    }
  };

  return (
    <PortalShell
      activeSection="learn"
      eyebrow="Learning"
      title="Practice a selected word"
      subtitle="Pick ASL or TRSL, choose a word from the dataset, then watch the matching reference clip before recording your attempt."
    >
      <section className="mb-6 rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-lg bg-[#edf3f8] p-1">
            {(["TRSL", "ASL"] as LibraryLanguage[]).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => setSelectedLanguage(language)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                  selectedLanguage === language
                    ? "bg-white text-[#102033] shadow-sm"
                    : "text-[#5d6b7c] hover:text-[#102033]"
                }`}
              >
                {language}
                <span className="ml-2 text-xs font-semibold text-[#6b7c90]">
                  {counts[language].toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search words</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6b7c90]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-[#c9d6e2] bg-white py-3 pl-12 pr-4 text-sm outline-none transition placeholder:text-[#8493a5] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12"
              placeholder={`Search ${selectedLanguage} words`}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#5d6b7c]">
          <span className="font-semibold text-[#102033]">
            {isLoading
              ? "Loading words..."
              : `${filteredEntries.length.toLocaleString()} matching ${selectedLanguage} words`}
          </span>
          <span className="h-1 w-1 rounded-full bg-[#9aabbc]" />
          <span>Reference clip updates whenever the selected word changes.</span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <div className="overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-sm">
          <div className="relative aspect-video bg-[#132238]">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" />
              </div>
            ) : selectedEntry ? (
              <video
                key={selectedEntry.id}
                src={selectedEntry.video_url}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              >
                <track kind="captions" srcLang="en" label="English captions" />
              </video>
            ) : (
              <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm font-semibold text-white">
                No reference clip is available for this selection.
              </div>
            )}
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            {[
              {
                label: "Current word",
                value: selectedEntry?.display_word ?? "Select a word",
                icon: BookOpen,
              },
              {
                label: "Language",
                value: selectedEntry?.language ?? selectedLanguage,
                icon: Languages,
              },
              {
                label: "Dataset clips",
                value: selectedEntry ? selectedEntry.clip_count.toLocaleString() : "0",
                icon: Video,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-[#e3ebf3] bg-[#f7fafc] p-4">
                  <Icon className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
                  <p className="mt-3 text-sm text-[#5d6b7c]">{item.label}</p>
                  <p className="mt-1 text-lg font-bold text-[#102033]">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <IconBadge icon={Camera} className="bg-[#e8f3ff] text-[#2563eb]" />
            <div>
              <h2 className="text-xl font-bold text-[#102033]">Practice Zone</h2>
              <p className="text-sm text-[#5d6b7c]">Live attempt</p>
            </div>
          </div>

          <div className="mt-5">
            {isRecorderOpen ? (
              <TrslWordRecorder
                autoStart
                inline
                maxWords={1}
                recorderLabel={selectedEntry?.language ?? selectedLanguage}
                recordSeconds={TRSL_WORD_RECORDING_SECONDS}
                pauseSeconds={TRSL_WORD_PAUSE_SECONDS}
                onComplete={handlePracticeCaptureComplete}
                onCancel={() => setIsRecorderOpen(false)}
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[#b9c8d8] bg-[#edf3f8]">
                {attemptVideoUrl ? (
                  <video
                    src={attemptVideoUrl}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white text-[#50627a] shadow-sm">
                      <Video className="h-8 w-8" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-[#50627a]">Camera preview</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isRecorderOpen && (
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={!selectedEntry || isScoringAttempt}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b5d57] disabled:cursor-not-allowed disabled:bg-[#9ba7b5]"
            >
              {isScoringAttempt ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-4 w-4" aria-hidden="true" />
              )}
              {isScoringAttempt ? "Scoring Attempt" : "Start Recording"}
            </button>
          )}

          {attemptResult && (
            <div className="mt-4 rounded-lg border border-[#bfe7d7] bg-[#f0fff8] p-4 text-sm text-[#14594a]">
              <p className="font-bold text-[#0f766e]">
                Score: {Math.round(attemptResult.feedback.score)} / 100
              </p>
              <p className="mt-1">{attemptResult.feedback.grade.message}</p>
            </div>
          )}

          {attemptMessage && (
            <div className="mt-4 rounded-lg border border-[#f3d58a] bg-[#fff9e8] p-4 text-sm text-[#76530e]">
              {attemptMessage}
            </div>
          )}

          <div className="mt-5 border-t border-[#d9e2ec] pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#5d6b7c]">
                Word Deck
              </h3>
              <button
                type="button"
                onClick={handleNextWord}
                disabled={isLoading || entries.length === 0}
                className="rounded-lg border border-[#c9d6e2] px-3 py-1.5 text-xs font-bold text-[#29425f] transition hover:bg-[#edf3f8] disabled:opacity-50"
              >
                Next Word
              </button>
            </div>

            {errorMessage ? (
              <div className="mt-3 rounded-lg border border-[#f1b7b7] bg-[#fff7f7] p-3 text-sm text-[#8a2525]">
                {errorMessage}
              </div>
            ) : (
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[58px] animate-pulse rounded-lg border border-[#e3ebf3] bg-[#f7fafc]"
                    />
                  ))
                ) : wordDeck.length === 0 ? (
                  <p className="rounded-lg border border-[#e3ebf3] bg-[#f7fafc] p-3 text-sm text-[#5d6b7c]">
                    No words match that search.
                  </p>
                ) : (
                  wordDeck.map((entry) => {
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedEntryId(entry.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                          isSelected
                            ? "border-[#0f766e] bg-[#e8fff7]"
                            : "border-[#e3ebf3] bg-[#f7fafc] hover:border-[#c9d6e2] hover:bg-white"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[#102033]">
                            {entry.display_word}
                          </span>
                          <span className="block truncate text-xs text-[#5d6b7c]">
                            {entry.translation ? `${entry.translation} - ` : ""}
                            {entry.clip_count.toLocaleString()} clips
                          </span>
                        </span>
                        <span className="ml-3 rounded-full bg-white px-2 py-1 text-xs font-bold text-[#0f766e]">
                          {entry.language}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>
      </section>
    </PortalShell>
  );
}

export function LibraryPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<LibraryLanguage>("TRSL");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SignLibraryEntry[]>([]);
  const [counts, setCounts] = useState<Record<LibraryLanguage, number>>({ ASL: 0, TRSL: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(48);

  useEffect(() => {
    let isMounted = true;

    const loadLibrary = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await getSignLibrary(selectedLanguage);
        if (!isMounted) return;
        setEntries(response.entries);
        setCounts(response.language_counts);
      } catch (error) {
        if (!isMounted) return;
        setEntries([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the sign library from the API.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadLibrary();
    return () => {
      isMounted = false;
    };
  }, [selectedLanguage]);

  useEffect(() => {
    setVisibleCount(48);
  }, [query, selectedLanguage]);

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) =>
      [
        entry.word,
        entry.display_word,
        entry.translation,
        entry.language,
        entry.dataset,
        entry.source,
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [entries, query]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEntries.length;

  return (
    <PortalShell
      activeSection="library"
      eyebrow="Library"
      title="Browse real dataset clips"
      subtitle="TRSL and ASL words now come from the local datasets, with one representative clip selected for each word."
    >
      <section className="mb-6 rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-lg bg-[#edf3f8] p-1">
            {(["TRSL", "ASL"] as LibraryLanguage[]).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => setSelectedLanguage(language)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                  selectedLanguage === language
                    ? "bg-white text-[#102033] shadow-sm"
                    : "text-[#5d6b7c] hover:text-[#102033]"
                }`}
              >
                {language}
                <span className="ml-2 text-xs font-semibold text-[#6b7c90]">
                  {counts[language].toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          <label className="relative w-full lg:max-w-md">
            <span className="sr-only">Search library</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6b7c90]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-[#c9d6e2] bg-white py-3 pl-12 pr-4 text-sm outline-none transition placeholder:text-[#8493a5] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12"
              placeholder={`Search ${selectedLanguage} words`}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#5d6b7c]">
          <span className="font-semibold text-[#102033]">
            {isLoading
              ? "Loading library..."
              : `${filteredEntries.length.toLocaleString()} ${selectedLanguage} words`}
          </span>
          <span className="h-1 w-1 rounded-full bg-[#9aabbc]" />
          <span>Representative clips are selected from available local videos.</span>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-[#f1b7b7] bg-[#fff7f7] p-5 text-[#8a2525]">
          <h2 className="text-lg font-bold">Library API unavailable</h2>
          <p className="mt-2 text-sm leading-6">{errorMessage}</p>
          <p className="mt-2 text-sm leading-6">
            Start or redeploy the backend tunnel so `/api/library` can read the local dataset folders.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[292px] animate-pulse rounded-lg border border-[#d9e2ec] bg-white"
                  >
                    <div className="aspect-video rounded-t-lg bg-[#dbe5ee]" />
                    <div className="space-y-3 p-4">
                      <div className="h-5 w-2/3 rounded bg-[#dbe5ee]" />
                      <div className="h-4 w-1/2 rounded bg-[#e6edf4]" />
                      <div className="h-4 w-full rounded bg-[#e6edf4]" />
                    </div>
                  </div>
                ))
              : visibleEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#b9c8d8] hover:shadow-md"
                  >
                    <div className="relative aspect-video bg-[#132238]">
                      <video
                        src={entry.video_url}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-contain"
                      >
                        <track kind="captions" srcLang="en" label="English captions" />
                      </video>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-bold text-[#102033]">
                            {entry.display_word}
                          </h2>
                          <p className="mt-1 text-sm text-[#5d6b7c]">
                            {entry.language}
                            {entry.translation ? ` - ${entry.translation}` : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            entry.language === "TRSL"
                              ? "bg-[#e8fff7] text-[#047857]"
                              : "bg-[#e8f3ff] text-[#2563eb]"
                          }`}
                        >
                          {entry.language}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-[#f4f7fb] px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.12em] text-[#6b7c90]">
                            Clips
                          </p>
                          <p className="mt-1 font-semibold text-[#102033]">
                            {entry.clip_count.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-lg bg-[#f4f7fb] px-3 py-2">
                          <p className="font-bold uppercase tracking-[0.12em] text-[#6b7c90]">
                            Source
                          </p>
                          <p className="mt-1 truncate font-semibold text-[#102033]">
                            {entry.source || entry.dataset}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
          </section>

          {!isLoading && filteredEntries.length === 0 && (
            <section className="rounded-lg border border-[#d9e2ec] bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-[#102033]">No words found</h2>
              <p className="mt-2 text-sm text-[#5d6b7c]">
                Try a different search term or switch language datasets.
              </p>
            </section>
          )}

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + 48)}
                className="rounded-lg border border-[#c9d6e2] bg-white px-5 py-3 text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
              >
                Load More Words
              </button>
            </div>
          )}
        </>
      )}
    </PortalShell>
  );
}

export function ProgressPage() {
  return (
    <PortalShell
      activeSection="progress"
      eyebrow="Progress"
      title="Track your fluency milestones"
      subtitle="Review streaks, accuracy, mastered vocabulary, and the signs that need another pass."
    >
      <section className="grid gap-5 lg:grid-cols-3">
        {[
          {
            label: "Learning Streak",
            value: "14",
            unit: "days",
            note: "2 days until milestone",
            icon: Flame,
            color: "bg-[#fff3dc] text-[#c2410c]",
          },
          {
            label: "Words Mastered",
            value: "128",
            unit: "signs",
            note: "+12 this week",
            icon: BookOpen,
            color: "bg-[#e8fff7] text-[#047857]",
          },
          {
            label: "Overall Accuracy",
            value: "92",
            unit: "%",
            note: "Excellent trend",
            icon: Target,
            color: "bg-[#e8f3ff] text-[#2563eb]",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#5d6b7c]">{stat.label}</p>
                  <p className="mt-4 text-5xl font-bold text-[#102033]">
                    {stat.value}
                    <span className="ml-2 text-lg font-semibold text-[#5d6b7c]">{stat.unit}</span>
                  </p>
                </div>
                <IconBadge icon={Icon} className={stat.color} />
              </div>
              <p className="mt-5 text-sm font-semibold text-[#0f766e]">{stat.note}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#102033]">Word Mastery</h2>
              <p className="mt-1 text-sm text-[#5d6b7c]">Individual sign progress.</p>
            </div>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-lg border border-[#c9d6e2] px-4 py-2 text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
            >
              View Library
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {masteryItems.map((item) => (
              <article
                key={item.word}
                className="rounded-lg border border-[#e3ebf3] bg-[#f7fafc] p-4 text-center transition hover:border-[#c9d6e2] hover:bg-white"
              >
                <div className="relative mx-auto h-24 w-24">
                  <ProgressRing value={item.value} color={item.value >= 90 ? "#0f766e" : "#2563eb"} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {item.value === 100 ? (
                      <CheckCircle2 className="h-8 w-8 text-[#0f766e]" aria-hidden="true" />
                    ) : (
                      <span className="text-sm font-bold text-[#102033]">{item.value}%</span>
                    )}
                  </div>
                </div>
                <h3 className="mt-3 text-lg font-bold text-[#102033]">{item.word}</h3>
                <p className="mt-1 text-sm font-semibold text-[#5d6b7c]">{item.status}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <article className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#102033]">Milestones</h2>
              <Trophy className="h-5 w-5 text-[#c2410c]" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: "Level 4 Learner", done: true, icon: Medal },
                { label: "100 signs mastered", done: true, icon: BadgeCheck },
                { label: "30 day streak", done: false, icon: Flame },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-[#e3ebf3] bg-[#f7fafc] px-3 py-3"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-[#102033]">
                      <Icon className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
                      {item.label}
                    </span>
                    {item.done ? (
                      <Check className="h-4 w-4 text-[#0f766e]" aria-hidden="true" />
                    ) : (
                      <Star className="h-4 w-4 text-[#c9d6e2]" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-lg border border-[#d9e2ec] bg-[#132238] p-5 text-white shadow-sm">
            <h2 className="text-lg font-bold">Next Focus</h2>
            <p className="mt-2 text-sm leading-6 text-[#d9eaff]">
              Help and Water are the best words to review before your next milestone.
            </p>
            <Link
              href="/learn"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#132238] transition hover:bg-[#edf3f8]"
            >
              Practice Now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        </aside>
      </section>
    </PortalShell>
  );
}
