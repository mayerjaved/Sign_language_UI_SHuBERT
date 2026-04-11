"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  FileUp,
  GraduationCap,
  Home as HomeIcon,
  MessageCircle,
  Moon,
  Search,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Video,
} from "lucide-react";
import LanguageSelector from "@/components/LanguageSelector";
import MessageBubble from "@/components/MessageBubble";
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
import { type Message, type SignLanguage } from "@/lib/types";
import { WAITLIST_SIGN_LANGUAGES } from "@/data/signLanguages";

type HomeTab = "sign2text" | "text2sign";
type NavTab = "home" | "messages" | "learning";
type ThemeMode = "light" | "dark";
type SendMode = "avatar" | "text";
type WaitlistStatusKind = "success" | "error";

interface MessagingThread {
  id: string;
  name: string;
  roleLabel: string;
  language: SignLanguage;
  online: boolean;
  unread: number;
  incomingVideoSrc: string;
  incomingTranslation: string;
  messages: Message[];
}

const WAITLIST_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_VIDEO_EMBED_URL = "https://www.youtube.com/embed/7v4QswMwBuA";

const makeSeedTime = (hour: number, minute: number): Date => {
  const stamp = new Date();
  stamp.setHours(hour, minute, 0, 0);
  return stamp;
};

const makeSeedThreads = (): MessagingThread[] => [
  {
    id: "amina",
    name: "Amina Carter",
    roleLabel: "Deaf user",
    language: "ASL",
    online: true,
    unread: 2,
    incomingVideoSrc: "/demo/asl-message.mp4",
    incomingTranslation:
      "Auto-translation: \"Can we use the side entrance? The elevator is down.\"",
    messages: [
      {
        id: "amina-1",
        sender: "bot",
        senderLabel: "Amina Carter",
        type: "video",
        content: "/demo/asl-message.mp4",
        language: "ASL",
        statusTag: "ASL video",
        timestamp: makeSeedTime(9, 11),
      },
      {
        id: "amina-2",
        sender: "bot",
        senderLabel: "Translation Engine",
        type: "text",
        content:
          "Auto-translation: \"Can we use the side entrance? The elevator is down.\"",
        language: "English",
        statusTag: "ASL -> English",
        timestamp: makeSeedTime(9, 12),
      },
    ],
  },
  {
    id: "can",
    name: "Can Yildiz",
    roleLabel: "Hearing user",
    language: "TRSL",
    online: true,
    unread: 0,
    incomingVideoSrc: "/demo/trsl-message.mp4",
    incomingTranslation:
      "Auto-translation: \"Okay, I will arrive in ten minutes.\"",
    messages: [
      {
        id: "can-1",
        sender: "user",
        type: "text",
        content: "Merhaba Can, toplanti odasi degisti.",
        language: "English",
        timestamp: makeSeedTime(10, 20),
      },
      {
        id: "can-2",
        sender: "bot",
        senderLabel: "Avatar Relay",
        type: "avatar",
        content:
          "TRSL avatar delivered: \"Merhaba Can, toplanti odasi degisti.\"",
        language: "TRSL Avatar",
        statusTag: "English -> TRSL avatar",
        timestamp: makeSeedTime(10, 21),
      },
    ],
  },
  {
    id: "lina",
    name: "Lina Brooks",
    roleLabel: "Deaf user",
    language: "ASL",
    online: false,
    unread: 1,
    incomingVideoSrc: "/demo/asl-message.mp4",
    incomingTranslation:
      "Auto-translation: \"I sent the forms already. Did you receive them?\"",
    messages: [
      {
        id: "lina-1",
        sender: "bot",
        senderLabel: "Lina Brooks",
        type: "video",
        content: "/demo/asl-message.mp4",
        language: "ASL",
        statusTag: "ASL video",
        timestamp: makeSeedTime(8, 55),
      },
      {
        id: "lina-2",
        sender: "bot",
        senderLabel: "Translation Engine",
        type: "text",
        content:
          "Auto-translation: \"I sent the forms already. Did you receive them?\"",
        language: "English",
        statusTag: "ASL -> English",
        timestamp: makeSeedTime(8, 56),
      },
    ],
  },
  {
    id: "berk",
    name: "Berk Demir",
    roleLabel: "Deaf user",
    language: "TRSL",
    online: true,
    unread: 0,
    incomingVideoSrc: "/demo/trsl-message.mp4",
    incomingTranslation:
      "Auto-translation: \"Please send the update to the support desk.\"",
    messages: [
      {
        id: "berk-1",
        sender: "user",
        type: "text",
        content: "I will share the status report at 3 PM.",
        language: "English",
        timestamp: makeSeedTime(11, 8),
      },
      {
        id: "berk-2",
        sender: "bot",
        senderLabel: "Avatar Relay",
        type: "avatar",
        content:
          "TRSL avatar delivered: \"I will share the status report at 3 PM.\"",
        language: "TRSL Avatar",
        statusTag: "English -> TRSL avatar",
        timestamp: makeSeedTime(11, 9),
      },
    ],
  },
];

const smoothScrollElementToViewportCenter = (element: HTMLElement, durationMs = 1300) => {
  const startY = window.scrollY;
  const rect = element.getBoundingClientRect();
  const absoluteTop = rect.top + startY;
  const desiredY = absoluteTop - window.innerHeight / 2 + rect.height / 2;
  const maxY = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
  const targetY = Math.min(Math.max(desiredY, 0), maxY);
  const distance = targetY - startY;

  if (Math.abs(distance) < 2) {
    window.scrollTo({ top: targetY, left: 0 });
    return;
  }

  const easeInOutCubic = (progress: number) =>
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  const startTime = performance.now();
  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo({ top: startY + distance * eased, left: 0 });

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

export default function Home() {
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
  const [threads, setThreads] = useState<MessagingThread[]>(makeSeedThreads);
  const [activeThreadId, setActiveThreadId] = useState("amina");
  const [sendMode, setSendMode] = useState<SendMode>("avatar");
  const [threadComposerText, setThreadComposerText] = useState("");
  const [homeTab, setHomeTab] = useState<HomeTab>("sign2text");
  const [pendingHomeScrollTarget, setPendingHomeScrollTarget] = useState<HomeTab | null>(null);
  const [activeNav, setActiveNav] = useState<NavTab>("home");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const stored = window.localStorage.getItem("slai-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [showSettings, setShowSettings] = useState(false);
  const [homeAvatarPrompt, setHomeAvatarPrompt] = useState("");
  const [isGeneratingHomeAvatar, setIsGeneratingHomeAvatar] = useState(false);
  const [homeAvatarVideoUrl, setHomeAvatarVideoUrl] = useState<string | null>(null);
  const [homeAvatarStatus, setHomeAvatarStatus] = useState<string | null>(null);
  const [homeAvatarError, setHomeAvatarError] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLanguageName, setWaitlistLanguageName] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<{
    kind: WaitlistStatusKind;
    message: string;
  } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const sign2TextFocusRef = useRef<HTMLDivElement>(null);
  const text2SignFocusRef = useRef<HTMLDivElement>(null);
  const aslVideoUploadInputRef = useRef<HTMLInputElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const activeThreadIdRef = useRef(activeThreadId);

  const isHome = activeNav === "home";
  const isSign2Text = homeTab === "sign2text";
  const isTrslWordMode = isSign2Text && targetLang === "TRSL";
  const assembledTrslSentence = trslWords.join(" ");
  const activeSign2TextResult = isTrslWordMode ? assembledTrslSentence : translationText;
  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? threads[0];

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

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (!pendingHomeScrollTarget || !isHome) {
      return;
    }

    const element =
      pendingHomeScrollTarget === "sign2text"
        ? sign2TextFocusRef.current
        : text2SignFocusRef.current;
    if (!element) {
      return;
    }

    smoothScrollElementToViewportCenter(element, 1300);
    setPendingHomeScrollTarget(null);
  }, [pendingHomeScrollTarget, homeTab, showVideoRecorder, isHome]);

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
    setHomeAvatarVideoUrl(null);

    if (targetLang !== "ASL") {
      setHomeAvatarError("Text-to-avatar is currently available only when ASL is selected.");
      return;
    }

    setIsGeneratingHomeAvatar(true);
    try {
      const response = await generateTextAvatar(trimmed, targetLang);
      setHomeAvatarVideoUrl(response.video_src);
      setHomeAvatarStatus(`Generated ASL avatar for: "${response.resolved_sentence}"`);
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

  const handleTrySignToText = () => {
    switchHomeTab("sign2text");
    setShowVideoRecorder(true);
    setPendingHomeScrollTarget("sign2text");
  };

  const handleTryTextToSign = () => {
    switchHomeTab("text2sign");
    setPendingHomeScrollTarget("text2sign");
  };

  const makeMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const getThreadPreview = (message: Message) => {
    if (message.type === "text") {
      return message.content;
    }
    if (message.type === "video") {
      return `${message.language} video received`;
    }
    return "Avatar gesture delivered";
  };

  const appendMessagesToThread = (threadId: string, nextMessages: Message[]) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        const isActiveThread = activeThreadIdRef.current === threadId;
        return {
          ...thread,
          unread: isActiveThread ? 0 : thread.unread + nextMessages.length,
          messages: [...thread.messages, ...nextMessages],
        };
      }),
    );
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              unread: 0,
            }
          : thread,
      ),
    );
  };

  const handleSendThreadMessage = () => {
    const trimmed = threadComposerText.trim();
    if (!trimmed || !activeThread) {
      return;
    }

    const threadId = activeThread.id;
    const threadLanguage = activeThread.language;
    const incomingVideoSrc = activeThread.incomingVideoSrc;
    const incomingTranslation = activeThread.incomingTranslation;
    const threadName = activeThread.name;

    setThreadComposerText("");

    appendMessagesToThread(threadId, [
      {
        id: makeMessageId(),
        sender: "user",
        type: "text",
        content: trimmed,
        language: "English",
        timestamp: new Date(),
      },
    ]);

    if (sendMode === "avatar") {
      setTimeout(() => {
        appendMessagesToThread(threadId, [
          {
            id: makeMessageId(),
            sender: "bot",
            senderLabel: "Avatar Relay",
            type: "avatar",
            content: `${threadLanguage} avatar delivered: "${trimmed}"`,
            language: `${threadLanguage} Avatar`,
            statusTag: `English -> ${threadLanguage} avatar`,
            timestamp: new Date(),
          },
        ]);
      }, 280);
    }

    setTimeout(() => {
      appendMessagesToThread(threadId, [
        {
          id: makeMessageId(),
          sender: "bot",
          senderLabel: threadName,
          type: "video",
          content: incomingVideoSrc,
          language: threadLanguage,
          statusTag: `${threadLanguage} video`,
          timestamp: new Date(),
        },
        {
          id: makeMessageId(),
          sender: "bot",
          senderLabel: "Translation Engine",
          type: "text",
          content: incomingTranslation,
          language: "English",
          statusTag: `${threadLanguage} -> English`,
          timestamp: new Date(),
        },
      ]);
    }, sendMode === "avatar" ? 1100 : 820);
  };

  const navItems = useMemo(
    () => [
      { id: "home" as const, label: "Home", icon: HomeIcon },
      { id: "messages" as const, label: "Messaging", icon: MessageCircle },
      { id: "learning" as const, label: "Learning", icon: GraduationCap },
    ],
    [],
  );

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
            </div>
          </div>
        </header>

        <section className="flex-1 px-4 pb-28 pt-6 md:px-8">
          {isHome ? (
            <div className="mx-auto w-full max-w-6xl">
              <div className="relative animate-rise overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-6 shadow-[0_34px_82px_-56px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-10">
                <div className="pointer-events-none absolute -right-20 top-[-120px] h-[320px] w-[320px] rounded-full bg-sky-300/25 blur-[120px]" />
                <div className="pointer-events-none absolute -left-20 bottom-[-150px] h-[320px] w-[320px] rounded-full bg-cyan-200/25 blur-[130px]" />

                <div className="relative z-10 space-y-8">
                  <div className="mx-auto flex w-full max-w-4xl flex-col justify-between">
                    <div>
                      <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
                        <Sparkles className="h-3.5 w-3.5" />
                        Welcome
                      </p>
                      <h1 className="mt-4 text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-5xl">
                        Start signing. Start understanding.
                      </h1>
                      <p className="mt-4 max-w-xl text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
                        Translate sign language to text, or type text and preview
                        sign output. Everything here is built to help you try the app
                        in under a minute.
                      </p>
                    </div>

                    <div className="mt-7 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-600">
                          1
                        </span>
                        <p className="text-sm text-[color:var(--ink)]">
                          Choose your translation language.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-600">
                          2
                        </span>
                        <p className="text-sm text-[color:var(--ink)]">
                          Record a short clip or type a message.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-600">
                          3
                        </span>
                        <p className="text-sm text-[color:var(--ink)]">
                          See your result instantly.
                        </p>
                      </div>
                    </div>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <button
                        onClick={handleTrySignToText}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(37,99,235,0.95)] transition-all hover:from-sky-500 hover:to-blue-500"
                      >
                        Try Sign to Text
                        <Video className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleTryTextToSign}
                        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition-all hover:bg-[color:var(--surface-soft)]"
                      >
                        Try Text to Sign
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mx-auto w-full max-w-4xl rounded-[26px] border border-[color:var(--border)] bg-[color:var(--surface)]/88 p-5 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[color:var(--ink)]">
                          Project demo video
                        </p>
                        <p className="text-xs text-[color:var(--muted)]">
                          Watch the product flow, then join the waitlist below.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-slate-950/90">
                      <div className="aspect-video w-full">
                        <iframe
                          src={DEMO_VIDEO_EMBED_URL}
                          title="Gesture Bridge demo video"
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    </div>

                    <a
                      href="#waitlist-form"
                      className="mt-3 inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] transition-all hover:bg-[color:var(--surface-soft)]"
                    >
                      Join waitlist
                    </a>

                    <form
                      id="waitlist-form"
                      onSubmit={handleWaitlistSubmit}
                      className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                    >
                      <p className="text-sm font-semibold text-[color:var(--ink)]">Join the waitlist</p>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        Select your preferred sign language from the searchable dropdown (
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

                  <div className="mx-auto w-full max-w-4xl rounded-[26px] border border-[color:var(--border)] bg-[color:var(--surface)]/88 p-5 shadow-sm md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[color:var(--ink)]">Try it now</p>
                        <p className="text-xs text-[color:var(--muted)]">
                          Pick a mode and run a quick test.
                        </p>
                      </div>
                      <div className="flex items-center rounded-full bg-[color:var(--surface-soft)] p-1 text-xs font-semibold text-[color:var(--muted)]">
                        <button
                          onClick={() => switchHomeTab("sign2text")}
                          className={`rounded-full px-3 py-1.5 transition-all ${
                            isSign2Text
                              ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                              : "hover:text-[color:var(--ink)]"
                          }`}
                        >
                          Sign to Text
                        </button>
                        <button
                          onClick={() => switchHomeTab("text2sign")}
                          className={`rounded-full px-3 py-1.5 transition-all ${
                            !isSign2Text
                              ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                              : "hover:text-[color:var(--ink)]"
                          }`}
                        >
                          Text to Sign
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-4">
                        {isSign2Text ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[color:var(--muted)]">
                                From
                              </span>
                              <LanguageSelector
                                languages={languages}
                                selected={targetLang}
                                onChange={setTargetLang}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[color:var(--muted)]">
                                To
                              </span>
                              <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
                                English
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[color:var(--muted)]">
                                From
                              </span>
                              <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
                                English
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[color:var(--muted)]">
                                To
                              </span>
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
                          <div ref={sign2TextFocusRef}>
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
                          <div
                            ref={sign2TextFocusRef}
                            className="rounded-2xl border border-[color:var(--border)] bg-slate-950/93 p-4 text-white"
                          >
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
                                  Last word: <span className="font-semibold text-[color:var(--ink)]">{lastTrslWord}</span>
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
                      <div
                        ref={text2SignFocusRef}
                        className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                      >
                        <p className="text-xs font-medium text-[color:var(--muted)]">Type a message</p>
                        <textarea
                          value={homeAvatarPrompt}
                          onChange={(event) => {
                            setHomeAvatarPrompt(event.target.value);
                            if (homeAvatarError) {
                              setHomeAvatarError(null);
                            }
                          }}
                          placeholder={`Type a message for ${targetLang} avatar...`}
                          className="mt-3 h-24 w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-all focus:border-blue-400/40 focus:ring-4 focus:ring-blue-200/30"
                        />
                        <button
                          onClick={handleHomeAvatarPreview}
                          disabled={!homeAvatarPrompt.trim() || isGeneratingHomeAvatar}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)] transition-all hover:from-sky-500 hover:to-blue-500 disabled:opacity-55"
                        >
                          {isGeneratingHomeAvatar ? "Generating Avatar..." : "Generate Sign Output"}
                          <Sparkles className="h-4 w-4" />
                        </button>
                        <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm">
                          <p className="text-xs font-medium text-[color:var(--muted)]">Result</p>
                          {isGeneratingHomeAvatar ? (
                            <p className="mt-2 text-[color:var(--ink)]">
                              Generating ASL avatar video locally...
                            </p>
                          ) : (
                            <p className="mt-2 text-[color:var(--ink)]">
                              {homeAvatarStatus || "Your generated avatar video will appear here."}
                            </p>
                          )}
                          {homeAvatarError && (
                            <p className="mt-2 text-sm font-medium text-rose-600">{homeAvatarError}</p>
                          )}
                          {homeAvatarVideoUrl && (
                            <video
                              src={homeAvatarVideoUrl}
                              controls
                              className="mt-3 w-full overflow-hidden rounded-xl border border-[color:var(--border)]"
                            />
                          )}
                          {!isGeneratingHomeAvatar &&
                            !homeAvatarError &&
                            targetLang !== "ASL" && (
                              <p className="mt-2 text-xs text-[color:var(--muted)]">
                                Select ASL to enable sentence-to-avatar generation.
                              </p>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeNav === "messages" ? (
            <div className="mx-auto w-full max-w-6xl animate-rise">
              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <aside className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-4 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Chats
                    </p>
                    <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600">
                      4 Active threads
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
                    <div className="flex items-center gap-2 text-[color:var(--muted)]">
                      <Search className="h-4 w-4" />
                      <span className="text-sm">Search conversations</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {threads.map((thread) => {
                      const isSelected = thread.id === activeThread?.id;
                      const lastMessage = thread.messages[thread.messages.length - 1];

                      return (
                        <button
                          key={thread.id}
                          onClick={() => handleSelectThread(thread.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition-all ${
                            isSelected
                              ? "border-sky-400/45 bg-sky-500/10"
                              : "border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-soft)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-semibold text-white">
                              {thread.name
                                .split(" ")
                                .map((chunk) => chunk[0])
                                .join("")
                                .slice(0, 2)}
                              <span
                                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] ${
                                  thread.online ? "bg-emerald-400" : "bg-slate-400"
                                }`}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                                  {thread.name}
                                </p>
                                <span className="text-[10px] text-[color:var(--muted)]">
                                  {lastMessage.timestamp.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                                {thread.roleLabel} - {thread.language}
                              </p>
                              <p className="mt-1 truncate text-xs text-[color:var(--muted)]">
                                {getThreadPreview(lastMessage)}
                              </p>
                            </div>
                          </div>

                          {thread.unread > 0 && (
                            <span className="mt-3 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-600 px-1.5 text-[11px] font-semibold text-white">
                              {thread.unread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div className="flex min-h-[640px] flex-col rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  {activeThread ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-semibold text-white">
                            {activeThread.name
                              .split(" ")
                              .map((chunk) => chunk[0])
                              .join("")
                              .slice(0, 2)}
                            <span
                              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] ${
                                activeThread.online ? "bg-emerald-400" : "bg-slate-400"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--ink)]">
                              {activeThread.name}
                            </p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {activeThread.roleLabel} - {activeThread.language}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center rounded-full bg-[color:var(--surface-soft)] p-1 text-xs font-semibold text-[color:var(--muted)]">
                          <button
                            onClick={() => setSendMode("avatar")}
                            className={`rounded-full px-3 py-1.5 transition-all ${
                              sendMode === "avatar"
                                ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                                : "hover:text-[color:var(--ink)]"
                            }`}
                          >
                            Txt2Avatar
                          </button>
                          <button
                            onClick={() => setSendMode("text")}
                            className={`rounded-full px-3 py-1.5 transition-all ${
                              sendMode === "text"
                                ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                                : "hover:text-[color:var(--ink)]"
                            }`}
                          >
                            Text Only
                          </button>
                        </div>
                      </div>

                      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-soft)]/70 px-5 py-3">
                        <p className="text-xs text-[color:var(--muted)]">
                          If you send with{" "}
                          <span className="font-semibold text-[color:var(--ink)]">Txt2Avatar</span>,
                          your message is rendered as an avatar gesture for the receiver.
                          Incoming sign videos are auto-translated into text.
                        </p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar md:p-5">
                        {activeThread.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`mb-4 flex ${
                              message.sender === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <MessageBubble message={message} />
                          </div>
                        ))}
                        <div ref={threadBottomRef} />
                      </div>

                      <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                        <div className="flex items-end gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-2">
                          <textarea
                            value={threadComposerText}
                            onChange={(event) => setThreadComposerText(event.target.value)}
                            placeholder={
                              sendMode === "avatar"
                                ? `Type text to send ${activeThread.language} avatar gesture...`
                                : "Type a direct text message..."
                            }
                            className="h-11 max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                            rows={1}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                handleSendThreadMessage();
                              }
                            }}
                          />
                          <button
                            onClick={handleSendThreadMessage}
                            disabled={!threadComposerText.trim()}
                            className="rounded-full bg-gradient-to-r from-sky-600 to-blue-600 p-3 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.85)] transition-all hover:from-sky-500 hover:to-blue-500 disabled:opacity-40"
                            aria-label="Send message"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-[color:var(--muted)]">
                      Choose a user to start messaging.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl animate-rise rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] px-8 py-16 text-center shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">Learning</p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--ink)]">Learning modules will live here.</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Next phase can include tutorials, lessons, and confidence scores.
              </p>
            </div>
          )}
        </section>

        <footer className="fixed bottom-0 left-0 z-30 w-full border-t border-[color:var(--border)] bg-[color:var(--surface-glass)] px-4 pb-safe pt-3 backdrop-blur-xl">
          <div className="relative mx-auto w-full max-w-5xl space-y-3">
            <nav className="flex items-center justify-between rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 ring-1 ring-cyan-200/70 shadow-[0_10px_24px_-14px_rgba(14,116,144,0.55)]"
                        : "text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
