"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Camera,
  ChevronDown,
  FileUp,
  GraduationCap,
  LogOut,
  Mail,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  Video,
  Youtube,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AvatarPlayer from "@/components/AvatarPlayer";
import LanguageSelector from "@/components/LanguageSelector";
import TrslWordRecorder from "@/components/TrslWordRecorder";
import VideoRecorder from "@/components/VideoRecorder";
import {
  generateTextAvatar,
  getLanguages,
  translateTrslWordWithMeta,
  translateVideo,
} from "@/lib/api";
import {
  TRSL_WORD_MAX_WORDS,
  TRSL_WORD_PAUSE_SECONDS,
  TRSL_WORD_RECORDING_SECONDS,
} from "@/lib/config";
import { type SignLanguage } from "@/lib/types";
import { WAITLIST_SIGN_LANGUAGES } from "@/data/signLanguages";

type HomeTab = "sign2text" | "text2sign";
type ThemeMode = "light" | "dark";
type WaitlistStatusKind = "success" | "error";

const WAITLIST_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The hero opens on an avatar already signing "hello friend". The clip is a
// pre-baked GLB (see public/avatars/) so it plays instantly on the deployed
// site without needing the local text-to-avatar backend.
const HELLO_FRIEND_PROMPT = "hello friend";
const HELLO_FRIEND_GLB = "/avatars/hello-friend-asl.glb";
const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=vDq4UVGzmkQ";
const CONTACT_EMAIL = "mayerjaved@gesturebridge.com";

function getInitials(email?: string | null, fullName?: string | null) {
  const source = fullName?.trim() || email?.split("@")[0] || "User";
  const initials = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");
  return initials || "GB";
}

export default function Home() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [languages, setLanguages] = useState<SignLanguage[]>(["ASL", "TRSL"]);
  const [targetLang, setTargetLang] = useState<SignLanguage>("ASL");
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [lastVideoUrl, setLastVideoUrl] = useState<string | null>(null);
  const [translationText, setTranslationText] = useState("");
  const [trslWords, setTrslWords] = useState<string[]>([]);
  const [lastTrslWord, setLastTrslWord] = useState<string | null>(null);
  const [trslTranslationProgress, setTrslTranslationProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [homeTab, setHomeTab] = useState<HomeTab>("text2sign");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("slai-theme");
    if (stored === "light" || stored === "dark") {
      setThemeMode(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setThemeMode("dark");
    }
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [homeAvatarPrompt, setHomeAvatarPrompt] = useState(HELLO_FRIEND_PROMPT);
  const [isGeneratingHomeAvatar, setIsGeneratingHomeAvatar] = useState(false);
  const [homeAvatarGlbUrl, setHomeAvatarGlbUrl] = useState<string | null>(HELLO_FRIEND_GLB);
  const [homeAvatarStatus, setHomeAvatarStatus] = useState<string | null>(
    `Signing: "${HELLO_FRIEND_PROMPT}"`,
  );
  const [homeAvatarError, setHomeAvatarError] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLanguageName, setWaitlistLanguageName] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<{
    kind: WaitlistStatusKind;
    message: string;
  } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const aslVideoUploadInputRef = useRef<HTMLInputElement>(null);

  const accountDisplayName =
    typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const accountInitials = getInitials(user?.email, accountDisplayName);
  const isSign2Text = homeTab === "sign2text";
  const isTrslWordMode = isSign2Text && targetLang === "TRSL";
  const assembledTrslSentence = trslWords.join(" ");
  const activeSign2TextResult = isTrslWordMode ? assembledTrslSentence : translationText;

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("slai-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const closeOnClick = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener("mousedown", closeOnClick);
    return () => document.removeEventListener("mousedown", closeOnClick);
  }, []);

  useEffect(() => {
    if (!showAccountMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAccountMenu]);

  const handleSignOut = async () => {
    setShowAccountMenu(false);
    await signOut();
    router.replace("/");
  };

  useEffect(() => {
    getLanguages().then((langs) => {
      if (langs && langs.length > 0) {
        setLanguages(langs as SignLanguage[]);
        if (!langs.includes(targetLang)) {
          setTargetLang(langs[0] as SignLanguage);
        }
      }
    });
  }, [targetLang]);

  useEffect(() => {
    setShowVideoRecorder(false);
    setIsTranslating(false);
    setTrslTranslationProgress(null);

    if (targetLang === "TRSL") {
      setTranslationText("");
      return;
    }

    setTrslWords([]);
    setLastTrslWord(null);
  }, [targetLang]);

  useEffect(() => {
    return () => {
      if (lastVideoUrl) {
        URL.revokeObjectURL(lastVideoUrl);
      }
    };
  }, [lastVideoUrl]);

  const handleSendVideo = async (blob: Blob) => {
    if (!isSign2Text) return;
    if (targetLang === "TRSL") return;

    if (lastVideoUrl) {
      URL.revokeObjectURL(lastVideoUrl);
    }

    setLastVideoUrl(URL.createObjectURL(blob));
    setIsTranslating(true);
    setTranslationText("");
    setShowVideoRecorder(false);

    try {
      const textResponse = await translateVideo(blob, targetLang);
      setTranslationText(textResponse);
    } catch (error) {
      console.error(error);
      const detail =
        error instanceof Error
          ? error.message
          : "Failed to translate video. Ensure the backend is running.";
      alert(detail);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleOpenAslUploadPicker = () => {
    if (isTrslWordMode || isTranslating) {
      return;
    }
    aslVideoUploadInputRef.current?.click();
  };

  const handleAslVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) {
      return;
    }
    if (!selectedFile.type.startsWith("video/")) {
      alert("Please choose a valid video file.");
      return;
    }
    await handleSendVideo(selectedFile);
  };

  const handleTrslWordCaptureComplete = async (wordClips: Blob[]) => {
    if (!isSign2Text || targetLang !== "TRSL") {
      return;
    }
    if (wordClips.length === 0) {
      return;
    }

    setShowVideoRecorder(false);
    setIsTranslating(true);
    setTrslTranslationProgress({ done: 0, total: wordClips.length });
    setTrslWords([]);
    setLastTrslWord(null);
    setTranslationText("");
    const requestId = `ui-trsl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.info(
      `[TRSL UI] Starting word translation run request_id=${requestId} clips=${wordClips.length}`,
    );

    try {
      for (let index = 0; index < wordClips.length; index += 1) {
        const wordIndex = index + 1;
        console.info(
          `[TRSL UI] Sending word ${wordIndex}/${wordClips.length} request_id=${requestId}`,
        );
        const translatedWord = await translateTrslWordWithMeta(wordClips[index], {
          requestId,
          wordIndex,
          wordTotal: wordClips.length,
        });
        console.info(
          `[TRSL UI] Received word ${wordIndex}/${wordClips.length}: "${translatedWord}" request_id=${requestId}`,
        );
        setTrslWords((prev) => [...prev, translatedWord]);
        setLastTrslWord(translatedWord);
        setTrslTranslationProgress({ done: wordIndex, total: wordClips.length });
      }
    } catch (error) {
      console.error(`[TRSL UI] Translation run failed request_id=${requestId}`, error);
      const detail =
        error instanceof Error
          ? error.message
          : "Failed to translate TRSL word clips. Ensure the backend is running.";
      alert(detail);
    } finally {
      setIsTranslating(false);
      setTrslTranslationProgress(null);
    }
  };

  const handleUndoTrslWord = () => {
    setTrslWords((prev) => prev.slice(0, -1));
  };

  const handleClearTrslSentence = () => {
    setTrslWords([]);
    setLastTrslWord(null);
    setTrslTranslationProgress(null);
    if (lastVideoUrl) {
      URL.revokeObjectURL(lastVideoUrl);
      setLastVideoUrl(null);
    }
  };

  const handleHomeAvatarPreview = async () => {
    const trimmed = homeAvatarPrompt.trim();
    if (!trimmed) {
      return;
    }

    setHomeAvatarError(null);
    setHomeAvatarStatus(null);
    setHomeAvatarGlbUrl(null);

    if (targetLang !== "ASL") {
      setHomeAvatarError("Text-to-avatar is currently available only when ASL is selected.");
      return;
    }

    setIsGeneratingHomeAvatar(true);
    try {
      const response = await generateTextAvatar(trimmed, targetLang);
      setHomeAvatarGlbUrl(response.glb_src);
      const missing = response.missing_words ?? [];
      setHomeAvatarStatus(
        `Signing: "${response.resolved_sentence}"` +
          (missing.length ? ` (skipped: ${missing.join(", ")})` : ""),
      );
    } catch (error) {
      console.error(error);
      const detail =
        error instanceof Error
          ? error.message
          : "Failed to generate avatar. Ensure the backend is running.";
      setHomeAvatarError(detail);
    } finally {
      setIsGeneratingHomeAvatar(false);
    }
  };

  const handleWaitlistSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = waitlistEmail.trim().toLowerCase();
    const normalizedLanguageName = waitlistLanguageName.trim().toLowerCase();
    const selectedLanguage = WAITLIST_SIGN_LANGUAGES.find(
      (language) => language.name.toLowerCase() === normalizedLanguageName,
    );

    if (!WAITLIST_EMAIL_REGEX.test(normalizedEmail)) {
      setWaitlistStatus({
        kind: "error",
        message: "Please enter a valid email address before joining.",
      });
      return;
    }

    if (!selectedLanguage) {
      setWaitlistStatus({
        kind: "error",
        message: "Please choose a sign language from the dropdown list.",
      });
      return;
    }

    setIsSubmittingWaitlist(true);
    setWaitlistStatus(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          languageCode: selectedLanguage.code,
          languageName: selectedLanguage.name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save waitlist request right now.");
      }

      setWaitlistStatus({
        kind: "success",
        message:
          payload?.message ||
          `You're on the waitlist for ${selectedLanguage.name}. We'll reach out when it's ready.`,
      });
      setWaitlistEmail("");
      setWaitlistLanguageName("");
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Unable to save waitlist request right now. Please try again.";
      setWaitlistStatus({ kind: "error", message: detail });
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  const switchHomeTab = (nextTab: HomeTab) => {
    setHomeTab(nextTab);
    if (nextTab === "text2sign") {
      setShowVideoRecorder(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[color:var(--page)] text-[color:var(--ink)] selection:bg-blue-200/60">
      <div className="pointer-events-none absolute -top-48 right-[-20%] h-[420px] w-[420px] rounded-full bg-sky-200/40 blur-[160px]" />
      <div className="pointer-events-none absolute -top-64 left-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-200/35 blur-[180px]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-cyan-300/25 via-sky-300/10 to-slate-900/55 p-0.5 shadow-[0_12px_30px_-18px_rgba(8,145,178,0.8)]">
                <Image
                  src="/logo-bridge.png"
                  alt="Gesture Bridge logo"
                  width={56}
                  height={56}
                  className="h-full w-full rounded-[13px] object-cover"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-[0.01em] text-[color:var(--ink)] md:text-lg">
                  Gesture Bridge
                </p>
                <p className="truncate text-xs text-[color:var(--muted)] md:text-sm">
                  Connecting the world through sign language.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div ref={settingsRef} className="relative">
                <button
                  onClick={() => setShowSettings((prev) => !prev)}
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-[color:var(--muted)] shadow-sm transition-all hover:text-[color:var(--ink)]"
                  aria-label="Open settings"
                >
                  <Settings2 className="h-5 w-5" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-sm shadow-lg">
                    <p className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Appearance
                    </p>
                    <button
                      onClick={() => setThemeMode("light")}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-all ${
                        themeMode === "light"
                          ? "bg-[color:var(--chip)] text-[color:var(--chip-text)]"
                          : "text-[color:var(--ink)] hover:bg-[color:var(--surface-soft)]"
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                      Light mode
                    </button>
                    <button
                      onClick={() => setThemeMode("dark")}
                      className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-all ${
                        themeMode === "dark"
                          ? "bg-[color:var(--chip)] text-[color:var(--chip-text)]"
                          : "text-[color:var(--ink)] hover:bg-[color:var(--surface-soft)]"
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                      Dark mode
                    </button>
                  </div>
                )}
              </div>

              {user && (
                <div ref={accountMenuRef} className="relative">
                  <button
                    onClick={() => setShowAccountMenu((prev) => !prev)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-sm transition-all hover:from-sky-400 hover:to-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200/30"
                    title={user.email ?? "Signed in"}
                    aria-label="Open account menu"
                    aria-haspopup="menu"
                    aria-expanded={showAccountMenu}
                  >
                    {accountInitials}
                  </button>

                  {showAccountMenu && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] text-sm text-[color:var(--ink)] shadow-lg"
                    >
                      <div className="border-b border-[color:var(--border)] px-4 py-3">
                        <p className="truncate font-bold">
                          {accountDisplayName ?? "GestureBridge user"}
                        </p>
                        {user.email && (
                          <p className="mt-1 truncate text-xs font-semibold text-[color:var(--muted)]">
                            {user.email}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left font-bold text-[color:var(--ink)] transition-all hover:bg-[color:var(--surface-soft)]"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="flex-1 px-4 pb-16 pt-6 md:px-8">
          <div className="mx-auto w-full max-w-5xl space-y-8">
            {/* Hero: minimal value proposition */}
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-xl font-semibold leading-tight text-[color:var(--ink)] md:text-3xl">
                The global sign language translation engine.
              </h1>
            </div>

            {/* Interactive demo card */}
            <div className="relative animate-rise overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-5 shadow-[0_34px_82px_-56px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-8">
              <div className="pointer-events-none absolute -right-20 top-[-120px] h-[320px] w-[320px] rounded-full bg-sky-300/25 blur-[120px]" />
              <div className="pointer-events-none absolute -left-20 bottom-[-150px] h-[320px] w-[320px] rounded-full bg-cyan-200/25 blur-[130px]" />

              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[color:var(--ink)]">Try it live</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1 text-sm font-semibold text-[color:var(--muted)] shadow-sm">
                    <button
                      onClick={() => switchHomeTab("text2sign")}
                      className={`rounded-full px-4 py-2 transition-all ${
                        !isSign2Text
                          ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                          : "hover:text-[color:var(--ink)]"
                      }`}
                    >
                      Text to Sign
                    </button>
                    <ArrowLeftRight
                      className="h-4 w-4 flex-shrink-0 text-sky-500"
                      aria-hidden="true"
                    />
                    <button
                      onClick={() => switchHomeTab("sign2text")}
                      className={`rounded-full px-4 py-2 transition-all ${
                        isSign2Text
                          ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                          : "hover:text-[color:var(--ink)]"
                      }`}
                    >
                      Sign to Text
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    {isSign2Text ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[color:var(--muted)]">From</span>
                          <LanguageSelector
                            languages={languages}
                            selected={targetLang}
                            onChange={setTargetLang}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[color:var(--muted)]">To</span>
                          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
                            English
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[color:var(--muted)]">From</span>
                          <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
                            English
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[color:var(--muted)]">To</span>
                          <LanguageSelector
                            languages={languages}
                            selected={targetLang}
                            onChange={setTargetLang}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {isSign2Text ? (
                  <div className="mt-4">
                    {showVideoRecorder ? (
                      <div>
                        {isTrslWordMode ? (
                          <TrslWordRecorder
                            inline
                            maxWords={TRSL_WORD_MAX_WORDS}
                            recordSeconds={TRSL_WORD_RECORDING_SECONDS}
                            pauseSeconds={TRSL_WORD_PAUSE_SECONDS}
                            onComplete={handleTrslWordCaptureComplete}
                            onCancel={() => setShowVideoRecorder(false)}
                          />
                        ) : (
                          <VideoRecorder
                            inline
                            onSend={handleSendVideo}
                            onCancel={() => setShowVideoRecorder(false)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/93 p-4 text-white">
                        <input
                          ref={aslVideoUploadInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          className="hidden"
                          onChange={handleAslVideoUpload}
                        />
                        <div className="aspect-video rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_rgba(15,23,42,0.86)_56%)] p-5">
                          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                            <Camera className="h-6 w-6 text-sky-300" />
                            <p className="text-sm font-semibold">
                              {isTrslWordMode
                                ? "Capture TRSL words with auto timing"
                                : "Capture a short signing clip"}
                            </p>
                            <p className="max-w-xs text-xs text-slate-300">
                              {isTrslWordMode
                                ? `Recorder runs automatically: green ${TRSL_WORD_RECORDING_SECONDS}s word, red ${TRSL_WORD_PAUSE_SECONDS}s reset, up to ${TRSL_WORD_MAX_WORDS} words.`
                                : "Record up to 10 seconds and get translated text in moments."}
                            </p>
                            <button
                              onClick={() => setShowVideoRecorder(true)}
                              className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20"
                            >
                              {isTrslWordMode ? "Start TRSL word capture" : "Open Camera"}
                              <Video className="h-4 w-4" />
                            </button>
                            {!isTrslWordMode && targetLang === "ASL" && (
                              <button
                                onClick={handleOpenAslUploadPicker}
                                disabled={isTranslating}
                                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 disabled:opacity-50"
                              >
                                Upload Video
                                <FileUp className="h-4 w-4" />
                              </button>
                            )}
                            {isTrslWordMode && (
                              <p className="text-[11px] text-slate-300/90">
                                One run can capture up to {TRSL_WORD_MAX_WORDS} words.
                              </p>
                            )}
                            {!isTrslWordMode && targetLang === "ASL" && (
                              <p className="text-[11px] text-slate-300/90">
                                You can record live or upload `.mp4`, `.webm`, or `.mov`.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                      <p className="text-xs font-medium text-[color:var(--muted)]">Result</p>
                      <p className="mt-2 text-sm text-[color:var(--ink)]">
                        {isTranslating
                          ? isTrslWordMode
                            ? trslTranslationProgress
                              ? `Translating words ${trslTranslationProgress.done}/${trslTranslationProgress.total}...`
                              : "Translating TRSL words..."
                            : "Translating video..."
                          : activeSign2TextResult ||
                            (isTrslWordMode
                              ? "Your word-by-word sentence appears here."
                              : "Your translated text appears here after recording.")}
                      </p>
                      {isTrslWordMode && (
                        <>
                          {lastTrslWord && (
                            <p className="mt-2 text-xs text-[color:var(--muted)]">
                              Last word:{" "}
                              <span className="font-semibold text-[color:var(--ink)]">
                                {lastTrslWord}
                              </span>
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {trslWords.map((word, index) => (
                              <span
                                key={`${index}-${word}`}
                                className="rounded-full border border-sky-200/70 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800"
                              >
                                {index + 1}. {word}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={handleUndoTrslWord}
                              disabled={trslWords.length === 0 || isTranslating}
                              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] transition-all hover:bg-[color:var(--surface-soft)] disabled:opacity-45"
                            >
                              Undo last word
                            </button>
                            <button
                              onClick={handleClearTrslSentence}
                              disabled={trslWords.length === 0 || isTranslating}
                              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-45"
                            >
                              Clear sentence
                            </button>
                          </div>
                        </>
                      )}
                      {lastVideoUrl && (
                        <video
                          src={lastVideoUrl}
                          controls
                          className="mt-3 w-full overflow-hidden rounded-xl border border-[color:var(--border)]"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
                    {/* Avatar signing on top */}
                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm">
                      {isGeneratingHomeAvatar ? (
                        <p className="text-[color:var(--ink)]">Generating avatar...</p>
                      ) : (
                        <p className="text-[color:var(--ink)]">
                          {homeAvatarStatus || "Your signed avatar will appear here."}
                        </p>
                      )}
                      {homeAvatarError && (
                        <p className="mt-2 text-sm font-medium text-rose-600">{homeAvatarError}</p>
                      )}
                      {homeAvatarGlbUrl && <AvatarPlayer glbUrl={homeAvatarGlbUrl} className="mt-3" />}
                      {!isGeneratingHomeAvatar && !homeAvatarError && targetLang !== "ASL" && (
                        <p className="mt-2 text-xs text-[color:var(--muted)]">
                          Select ASL to enable sentence-to-avatar generation.
                        </p>
                      )}
                    </div>

                    {/* Type-a-message input below the avatar */}
                    <p className="mt-4 text-xs font-medium text-[color:var(--muted)]">Type a message</p>
                    <textarea
                      value={homeAvatarPrompt}
                      onChange={(event) => {
                        setHomeAvatarPrompt(event.target.value);
                        if (homeAvatarError) {
                          setHomeAvatarError(null);
                        }
                      }}
                      placeholder={`Type a message for the ${targetLang} avatar...`}
                      className="mt-1.5 h-24 w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-all focus:border-blue-400/40 focus:ring-4 focus:ring-blue-200/30"
                    />
                    <button
                      onClick={handleHomeAvatarPreview}
                      disabled={!homeAvatarPrompt.trim() || isGeneratingHomeAvatar}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)] transition-all hover:from-sky-500 hover:to-blue-500 disabled:opacity-55"
                    >
                      {isGeneratingHomeAvatar ? "Generating Avatar..." : "Generate Sign Output"}
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Waitlist */}
            <div className="mx-auto w-full max-w-3xl rounded-[26px] border border-[color:var(--border)] bg-[color:var(--surface)]/88 p-5 shadow-sm md:p-6">
              <form id="waitlist-form" onSubmit={handleWaitlistSubmit}>
                <p className="text-sm font-semibold text-[color:var(--ink)]">Join the waitlist</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Pick your sign language and we&apos;ll reach out when it&apos;s ready (
                  {WAITLIST_SIGN_LANGUAGES.length} options).
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <label className="text-xs font-medium text-[color:var(--muted)]">
                    Email
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={waitlistEmail}
                      onChange={(event) => {
                        setWaitlistEmail(event.target.value);
                        if (waitlistStatus) {
                          setWaitlistStatus(null);
                        }
                      }}
                      placeholder="you@example.com"
                      className="mt-1.5 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-all focus:border-blue-400/40 focus:ring-4 focus:ring-blue-200/30"
                    />
                  </label>

                  <label className="text-xs font-medium text-[color:var(--muted)]">
                    Sign language preference
                    <input
                      list="waitlist-sign-language-list"
                      required
                      value={waitlistLanguageName}
                      onChange={(event) => {
                        setWaitlistLanguageName(event.target.value);
                        if (waitlistStatus) {
                          setWaitlistStatus(null);
                        }
                      }}
                      placeholder="Search and choose a sign language"
                      className="mt-1.5 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-all focus:border-blue-400/40 focus:ring-4 focus:ring-blue-200/30"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmittingWaitlist}
                    className="h-fit rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)] transition-all hover:from-sky-500 hover:to-blue-500 disabled:opacity-55 md:self-end"
                  >
                    {isSubmittingWaitlist ? "Saving..." : "Join Waitlist"}
                  </button>
                </div>

                <datalist id="waitlist-sign-language-list">
                  {WAITLIST_SIGN_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.name}>
                      {language.code.toUpperCase()}
                    </option>
                  ))}
                </datalist>

                {waitlistStatus && (
                  <p
                    className={`mt-3 text-sm font-medium ${
                      waitlistStatus.kind === "success" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {waitlistStatus.message}
                  </p>
                )}
              </form>
            </div>

            {/* About us (expandable, single bordered box) */}
            <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/88 shadow-sm">
              <button
                type="button"
                onClick={() => setAboutOpen((prev) => !prev)}
                aria-expanded={aboutOpen}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-all hover:bg-[color:var(--surface-soft)]"
              >
                <span className="text-sm font-semibold text-[color:var(--ink)]">About us</span>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-[color:var(--muted)] transition-transform ${
                    aboutOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {aboutOpen && (
                <div className="border-t border-[color:var(--border)] px-5 py-4 text-sm leading-relaxed text-[color:var(--muted)]">
                  <p>
                    There are over{" "}
                    <span className="font-semibold text-[color:var(--ink)]">70 million</span> deaf
                    people around the world. They are the fabric of our society, just as smart and
                    just as capable as us. But a lack of accessible communication holds them back.
                    That&apos;s where{" "}
                    <span className="font-semibold text-[color:var(--ink)]">Gesture Bridge</span>{" "}
                    comes in: the two-way, global sign language app.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="border-t border-[color:var(--border)] bg-[color:var(--surface-glass)] px-4 py-6 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <a
                href={DEMO_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Watch the GestureBridge demo on YouTube"
                title="Watch the demo"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] shadow-sm transition-all hover:scale-105 hover:border-red-300/50 hover:text-red-500"
              >
                <Youtube className="h-5 w-5" />
              </a>
              <Link
                href="/learn"
                aria-label="Learn sign language with GestureBridge"
                title="Learn"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] shadow-sm transition-all hover:scale-105 hover:border-emerald-300/50 hover:text-emerald-500"
              >
                <GraduationCap className="h-5 w-5" />
              </Link>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                aria-label={`Email us at ${CONTACT_EMAIL}`}
                title={CONTACT_EMAIL}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] shadow-sm transition-all hover:scale-105 hover:border-sky-300/50 hover:text-sky-500"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
            <p className="text-xs text-[color:var(--muted)]">
              Gesture Bridge · Connecting the world through sign language.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
