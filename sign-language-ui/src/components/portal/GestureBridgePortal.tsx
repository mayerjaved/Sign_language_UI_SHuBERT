"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Languages,
  Lock,
  LogIn,
  Mail,
  Medal,
  Play,
  Search,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserPlus,
  Video,
  Volume2,
} from "lucide-react";
import {
  getSignLibrary,
  type LibraryLanguage,
  type SignLibraryEntry,
} from "@/lib/api";

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

interface SignCard {
  word: string;
  topic: string;
  language: "ASL" | "TRSL";
  level: "Starter" | "Intermediate" | "Advanced";
  duration: string;
  progress: number;
  videoSrc: string;
  accent: string;
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

const signCards: SignCard[] = [
  {
    word: "Hello",
    topic: "Greetings",
    language: "ASL",
    level: "Starter",
    duration: "0:04",
    progress: 96,
    videoSrc: "/demo/asl-message.mp4",
    accent: "bg-[#e8f3ff] text-[#075985]",
  },
  {
    word: "Thank You",
    topic: "Greetings",
    language: "ASL",
    level: "Starter",
    duration: "0:06",
    progress: 100,
    videoSrc: "/demo/asl-message.mp4",
    accent: "bg-[#e8fff7] text-[#047857]",
  },
  {
    word: "Help",
    topic: "Emergency",
    language: "TRSL",
    level: "Intermediate",
    duration: "0:05",
    progress: 82,
    videoSrc: "/demo/trsl-message.mp4",
    accent: "bg-[#fff3dc] text-[#92400e]",
  },
  {
    word: "Family",
    topic: "People",
    language: "ASL",
    level: "Starter",
    duration: "0:07",
    progress: 88,
    videoSrc: "/demo/asl-message.mp4",
    accent: "bg-[#f1ecff] text-[#5b21b6]",
  },
  {
    word: "Water",
    topic: "Daily Needs",
    language: "TRSL",
    level: "Starter",
    duration: "0:03",
    progress: 61,
    videoSrc: "/demo/trsl-message.mp4",
    accent: "bg-[#e6fffb] text-[#0f766e]",
  },
  {
    word: "Please",
    topic: "Manners",
    language: "ASL",
    level: "Starter",
    duration: "0:05",
    progress: 34,
    videoSrc: "/demo/asl-message.mp4",
    accent: "bg-[#fff1f2] text-[#be123c]",
  },
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

function DemoVideo({ src, className }: { src: string; className?: string }) {
  return (
    <video
      className={className}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="Sign language lesson preview"
    >
      <track kind="captions" srcLang="en" label="English captions" />
    </video>
  );
}

function PortalShell({ activeSection, eyebrow, title, subtitle, children }: PortalShellProps) {
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
            <Link
              href="/TranslationDemo"
              className="ml-2 rounded-lg border border-[#c9d6e2] px-4 py-2 text-sm font-semibold text-[#29425f] transition hover:bg-[#edf3f8]"
            >
              Translation Demo
            </Link>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14213d] text-sm font-bold text-white">
              SG
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
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = authMode === "signup";

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

            <form className="mt-6 space-y-4">
              {isSignup && (
                <label className="block text-sm font-semibold text-[#102033]">
                  Full Name
                  <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#c9d6e2] bg-white px-4 py-3 focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/12">
                    <UserPlus className="h-5 w-5 text-[#6b7c90]" aria-hidden="true" />
                    <input
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
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[#8493a5]"
                    placeholder="learner@example.com"
                    type="email"
                    autoComplete="email"
                  />
                </span>
              </label>

              <label className="block text-sm font-semibold text-[#102033]">
                Password
                <span className="mt-2 flex items-center gap-3 rounded-lg border border-[#c9d6e2] bg-white px-4 py-3 focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/12">
                  <Lock className="h-5 w-5 text-[#6b7c90]" aria-hidden="true" />
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[#8493a5]"
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
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
                  <Link href="/learn" className="text-sm font-semibold text-[#2563eb] hover:text-[#174ea6]">
                    Forgot password?
                  </Link>
                </div>
              )}

              <Link
                href="/learn"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#14213d] px-4 py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(20,33,61,0.22)] transition hover:bg-[#24385f]"
              >
                {isSignup ? "Create Account" : "Sign In"}
                {isSignup ? (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                )}
              </Link>
            </form>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#d9e2ec] pt-5 text-sm">
              <span className="text-[#5d6b7c]">Need the original translator?</span>
              <Link href="/TranslationDemo" className="font-bold text-[#0f766e] hover:text-[#0b5d57]">
                TranslationDemo
              </Link>
            </div>
        </div>
      </div>
    </main>
  );
}

export function LearnPage() {
  return (
    <PortalShell
      activeSection="learn"
      eyebrow="Learning"
      title="Practice signs with guided feedback"
      subtitle="Watch a reference sign, record your attempt, and keep your daily learning rhythm moving."
    >
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:w-auto">
          <span className="sr-only">Select sign language</span>
          <select className="w-full appearance-none rounded-lg border border-[#c9d6e2] bg-white py-3 pl-4 pr-11 text-sm font-bold text-[#14213d] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/12 sm:w-[280px]">
            <option>ASL - American Sign Language</option>
            <option>TRSL - Turkish Sign Language</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#50627a]" />
        </label>

        <div className="flex items-center gap-3 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 shadow-sm">
          <IconBadge icon={Flame} className="bg-[#fff3dc] text-[#c2410c]" />
          <div className="min-w-[150px]">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-semibold text-[#5d6b7c]">Daily Goal</span>
              <span className="font-bold text-[#0f766e]">75%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#d9e2ec]">
              <div className="h-full w-3/4 rounded-full bg-[#0f766e]" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <div className="overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-sm">
          <div className="relative aspect-video bg-[#132238]">
            <DemoVideo src="/demo/asl-message.mp4" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,34,56,0.05),rgba(19,34,56,0.72))]" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/30">
                <div className="h-full w-[42%] rounded-full bg-[#96f2df]" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#132238]"
                    aria-label="Play lesson"
                  >
                    <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                  </button>
                  <button type="button" className="text-white" aria-label="Volume">
                    <Volume2 className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="text-sm font-semibold">01:24 / 04:05</span>
                </div>
                <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur">
                  Hello - ASL
                </span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            {[
              { label: "Current word", value: "Hello", icon: Sparkles },
              { label: "Session", value: "7 min", icon: Clock },
              { label: "Target score", value: "90%", icon: Target },
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

          <div className="mt-5 flex aspect-[4/3] items-center justify-center rounded-lg border-2 border-dashed border-[#b9c8d8] bg-[#edf3f8]">
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-white text-[#50627a] shadow-sm">
                <Video className="h-8 w-8" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-semibold text-[#50627a]">Camera preview</p>
            </div>
          </div>

          <button
            type="button"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#0b5d57]"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Start Recording
          </button>

          <div className="mt-5 border-t border-[#d9e2ec] pt-5">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#5d6b7c]">
              Today Deck
            </h3>
            <div className="mt-3 space-y-2">
              {signCards.slice(0, 4).map((card) => (
                <Link
                  href="/library"
                  key={card.word}
                  className="flex items-center justify-between rounded-lg border border-[#e3ebf3] bg-[#f7fafc] px-3 py-2 transition hover:border-[#c9d6e2] hover:bg-white"
                >
                  <span>
                    <span className="block text-sm font-bold text-[#102033]">{card.word}</span>
                    <span className="block text-xs text-[#5d6b7c]">
                      {card.topic} - {card.language}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[#0f766e]">{card.progress}%</span>
                </Link>
              ))}
            </div>
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
