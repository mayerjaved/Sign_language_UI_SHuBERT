"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  GraduationCap,
  Hand,
  Home as HomeIcon,
  Languages,
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
import VideoRecorder from "@/components/VideoRecorder";
import { getLanguages, translateVideo } from "@/lib/api";
import { type Message, type SignLanguage } from "@/lib/types";

type HomeTab = "sign2text" | "text2sign";
type NavTab = "home" | "messages" | "learning";
type ThemeMode = "light" | "dark";
type SendMode = "avatar" | "text";

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

export default function Home() {
  const [languages, setLanguages] = useState<SignLanguage[]>(["ASL", "TRSL"]);
  const [targetLang, setTargetLang] = useState<SignLanguage>("ASL");
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [lastVideoUrl, setLastVideoUrl] = useState<string | null>(null);
  const [translationText, setTranslationText] = useState("");
  const [threads, setThreads] = useState<MessagingThread[]>(makeSeedThreads);
  const [activeThreadId, setActiveThreadId] = useState("amina");
  const [sendMode, setSendMode] = useState<SendMode>("avatar");
  const [threadComposerText, setThreadComposerText] = useState("");
  const [homeTab, setHomeTab] = useState<HomeTab>("sign2text");
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
  const [homeAvatarPreview, setHomeAvatarPreview] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const activeThreadIdRef = useRef(activeThreadId);

  const isHome = activeNav === "home";
  const isSign2Text = homeTab === "sign2text";
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

  const handleSendVideo = async (blob: Blob) => {
    if (!isSign2Text) return;
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

  const handleHomeAvatarPreview = () => {
    const trimmed = homeAvatarPrompt.trim();
    if (!trimmed) {
      return;
    }

    setHomeAvatarPreview(`Preview for ${targetLang} avatar: "${trimmed}"`);
  };

  const switchHomeTab = (nextTab: HomeTab) => {
    setHomeTab(nextTab);
    if (nextTab === "text2sign") {
      setShowVideoRecorder(false);
    }
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
      <div className="pointer-events-none absolute -top-48 right-[-20%] h-[420px] w-[420px] rounded-full bg-sky-200/70 blur-[140px]" />
      <div className="pointer-events-none absolute -top-64 left-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-200/70 blur-[160px]" />
      <div className="pointer-events-none absolute bottom-[-30%] left-[15%] h-[520px] w-[520px] rounded-full bg-blue-200/50 blur-[160px]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-200/60">
                <Hand className="h-4 w-4" />
                <span className="absolute -bottom-1 -right-1 rounded-full border border-white/40 bg-slate-900/80 p-1 text-white">
                  <Languages className="h-2.5 w-2.5" />
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Sign Language AI
                </p>
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  Two-way Translation
                </p>
              </div>
            </div>

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
        </header>

        <section className="flex-1 px-4 pb-28 pt-6 md:px-8">
          {isHome ? (
            <div className="mx-auto w-full max-w-6xl">
              <div className="relative animate-rise overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-6 shadow-[0_34px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl md:p-8">
                <div className="pointer-events-none absolute -right-24 top-[-110px] h-[280px] w-[280px] rounded-full bg-sky-300/40 blur-[110px]" />
                <div className="pointer-events-none absolute -left-24 bottom-[-120px] h-[280px] w-[280px] rounded-full bg-cyan-200/40 blur-[110px]" />

                <div className="relative z-10 grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
                      <Sparkles className="h-3.5 w-3.5" />
                      Intro Screen
                    </p>
                    <h1 className="mt-4 text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-4xl">
                      Instant sign communication, designed for real conversations.
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
                      Record gestures and convert to text, or type text and relay it
                      as avatar gestures. This home page is now the primary experience,
                      focused on clarity and immediate action.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Step 1</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                          Select language
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Step 2</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                          Translate video or text
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Step 3</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                          Share clear output
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Guided Quick Start
                      </p>
                      <div className="flex items-center rounded-full bg-[color:var(--surface-soft)] p-1 text-xs font-semibold text-[color:var(--muted)]">
                        <button
                          onClick={() => switchHomeTab("sign2text")}
                          className={`rounded-full px-3 py-1.5 transition-all ${
                            isSign2Text
                              ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                              : "hover:text-[color:var(--ink)]"
                          }`}
                        >
                          Sign2Text
                        </button>
                        <button
                          onClick={() => switchHomeTab("text2sign")}
                          className={`rounded-full px-3 py-1.5 transition-all ${
                            !isSign2Text
                              ? "bg-[color:var(--surface)] text-[color:var(--ink)] shadow-sm"
                              : "hover:text-[color:var(--ink)]"
                          }`}
                        >
                          Text2Sign
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      {isSign2Text ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                              From
                            </span>
                            <LanguageSelector
                              languages={languages}
                              selected={targetLang}
                              onChange={setTargetLang}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
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
                            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                              From
                            </span>
                            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
                              English
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
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

                    {isSign2Text ? (
                      <div className="mt-4">
                        {showVideoRecorder ? (
                          <VideoRecorder
                            inline
                            onSend={handleSendVideo}
                            onCancel={() => setShowVideoRecorder(false)}
                          />
                        ) : (
                          <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/90 p-4 text-white">
                            <div className="aspect-video rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_rgba(15,23,42,0.8)_55%)] p-5">
                              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                                <Camera className="h-6 w-6 text-sky-300" />
                                <p className="text-sm font-semibold">
                                  Bigger center recording section
                                </p>
                                <button
                                  onClick={() => setShowVideoRecorder(true)}
                                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-white/20"
                                >
                                  Record Now
                                  <Video className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Translation Result
                          </p>
                          <p className="mt-2 text-sm text-[color:var(--ink)]">
                            {isTranslating
                              ? "Translating video..."
                              : translationText || "Record a clip to see live translated text here."}
                          </p>
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
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          Type Message For Avatar
                        </p>
                        <textarea
                          value={homeAvatarPrompt}
                          onChange={(event) => setHomeAvatarPrompt(event.target.value)}
                          placeholder={`Type a message for ${targetLang} avatar...`}
                          className="mt-3 h-24 w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-all focus:border-blue-400/40 focus:ring-4 focus:ring-blue-200/30"
                        />
                        <button
                          onClick={handleHomeAvatarPreview}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Generate Avatar Preview
                          <Sparkles className="h-4 w-4" />
                        </button>
                        {homeAvatarPreview && (
                          <div className="mt-3 rounded-xl border border-sky-300/45 bg-sky-500/10 p-3 text-sm text-[color:var(--ink)]">
                            {homeAvatarPreview}
                          </div>
                        )}
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
                      4 Users
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
                    <div className="flex items-center gap-2 text-[color:var(--muted)]">
                      <Search className="h-4 w-4" />
                      <span className="text-sm">Search dummy users</span>
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
