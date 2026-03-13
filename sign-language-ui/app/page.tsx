"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Home as HomeIcon,
  MessageCircle,
  Send,
  Settings2,
  Video,
} from "lucide-react";
import ChatWindow from "@/components/ChatWindow";
import LanguageSelector from "@/components/LanguageSelector";
import VideoRecorder from "@/components/VideoRecorder";
import { getLanguages, translateVideo } from "@/lib/api";
import { type Message, type SignLanguage } from "@/lib/types";

type HomeTab = "sign2text" | "text2sign";
type NavTab = "home" | "messages" | "learning";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "system-1",
      sender: "bot",
      type: "text",
      content:
        "Hello! I am ready to translate your sign language gestures into text. Select your language and tap the video icon to get started.",
      language: "System",
      timestamp: new Date(),
    },
  ]);
  const [languages, setLanguages] = useState<SignLanguage[]>(["ASL", "TRSL"]);
  const [targetLang, setTargetLang] = useState<SignLanguage>("ASL");
  const [inputText, setInputText] = useState("");
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [homeTab, setHomeTab] = useState<HomeTab>("sign2text");
  const [activeNav, setActiveNav] = useState<NavTab>("home");

  const isHome = activeNav === "home";
  const isSign2Text = homeTab === "sign2text";

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
    if (!isSign2Text) {
      setShowVideoRecorder(false);
    }
  }, [isSign2Text]);

  const handleSendVideo = async (blob: Blob) => {
    if (!isSign2Text) return;

    const videoUrl = URL.createObjectURL(blob);
    const userMsgId = Date.now().toString();

    const userVideoMsg: Message = {
      id: userMsgId,
      sender: "user",
      type: "video",
      content: videoUrl,
      language: targetLang,
      timestamp: new Date(),
      isTranslating: true,
    };

    setMessages((prev) => [...prev, userVideoMsg]);
    setShowVideoRecorder(false);

    try {
      const textResponse = await translateVideo(blob, targetLang);

      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, isTranslating: false } : m)),
      );

      const botResponseMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        type: "text",
        content: textResponse,
        language: targetLang,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botResponseMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, isTranslating: false } : m)),
      );
      alert("Failed to translate video. Ensure the backend is running.");
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) {
      return;
    }

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      type: "text",
      content: inputText,
      language: targetLang,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    if (homeTab === "text2sign") {
      setTimeout(() => {
        const botResponseMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          type: "text",
          content: "[Avatar generation pending. Phase 2 implementation required.]",
          language: "System",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botResponseMsg]);
      }, 1000);
    }
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
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--page)] text-slate-900 selection:bg-blue-200/60">
      <div className="pointer-events-none absolute -top-48 right-[-20%] h-[420px] w-[420px] rounded-full bg-sky-200/70 blur-[140px]" />
      <div className="pointer-events-none absolute -top-64 left-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-200/70 blur-[160px]" />
      <div className="pointer-events-none absolute bottom-[-30%] left-[15%] h-[520px] w-[520px] rounded-full bg-blue-200/50 blur-[160px]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-200/60">
                <span className="text-xs font-semibold tracking-tight">SL</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Sign Language AI
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  Two-way Translation
                </p>
              </div>
            </div>

            <button className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:text-slate-800 hover:shadow-md">
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="flex-1 px-4 pb-40 pt-6 md:px-8">
          {isHome ? (
            <div className="mx-auto w-full max-w-5xl animate-rise rounded-[28px] border border-slate-200/80 bg-white/70 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sm font-semibold text-sky-600">
                    AI
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Home workspace</p>
                    <p className="text-xs text-slate-500">
                      Gesture to text now, avatar generation in Phase 2
                    </p>
                  </div>
                </div>

                <div className="flex items-center rounded-full bg-slate-100 p-1 text-sm font-medium text-slate-500">
                  <button
                    onClick={() => setHomeTab("sign2text")}
                    className={`rounded-full px-4 py-2 transition-all ${
                      isSign2Text
                        ? "bg-white text-slate-900 shadow-sm"
                        : "hover:text-slate-700"
                    }`}
                  >
                    Sign2Text
                  </button>
                  <button
                    onClick={() => setHomeTab("text2sign")}
                    className={`rounded-full px-4 py-2 transition-all ${
                      !isSign2Text
                        ? "bg-white text-slate-900 shadow-sm"
                        : "hover:text-slate-700"
                    }`}
                  >
                    Text2Sign
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-3">
                {isSign2Text ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        From
                      </span>
                      <LanguageSelector
                        languages={languages}
                        selected={targetLang}
                        onChange={setTargetLang}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        To
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                        English
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        From
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                        English
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        To
                      </span>
                      <LanguageSelector
                        languages={languages}
                        selected={targetLang}
                        onChange={setTargetLang}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Powered by SHuBERT
                </p>
              </div>

              <ChatWindow messages={messages} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl animate-rise rounded-[28px] border border-slate-200/80 bg-white/70 px-8 py-16 text-center shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                {activeNav === "messages" ? "Messaging" : "Learning"}
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-800">
                {activeNav === "messages"
                  ? "Team messaging is coming next."
                  : "Learning modules will live here."}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Tell me what you want in this section and I will build it.
              </p>
            </div>
          )}
        </section>

        <footer className="fixed bottom-0 left-0 z-30 w-full border-t border-slate-200/70 bg-white/80 px-4 pb-safe pt-3 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-5xl space-y-3">
            {isHome && (
              <>
                {showVideoRecorder && isSign2Text && (
                  <VideoRecorder
                    onSend={handleSendVideo}
                    onCancel={() => setShowVideoRecorder(false)}
                  />
                )}

                <div className="flex items-end gap-2 rounded-[24px] border border-slate-200 bg-white/90 p-2 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.6)] transition-all focus-within:border-blue-400/40 focus-within:ring-4 focus-within:ring-blue-200/50 md:gap-3">
                  {isSign2Text && (
                    <button
                      onClick={() => setShowVideoRecorder(!showVideoRecorder)}
                      className={`flex-shrink-0 rounded-full p-3 transition-all ${
                        showVideoRecorder
                          ? "bg-blue-600/10 text-blue-700"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                      title="Record Gesture"
                    >
                      <Video className="h-5 w-5" />
                    </button>
                  )}

                  <div className="min-h-[44px] flex-1">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        isSign2Text
                          ? "Type a note or paste text..."
                          : `Type English for ${targetLang} avatar...`
                      }
                      className="max-h-32 w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-3 text-[15px] leading-tight text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendText();
                        }
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSendText}
                    disabled={!inputText.trim()}
                    className="mt-auto flex-shrink-0 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 p-3 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.85)] transition-all hover:from-sky-500 hover:to-blue-500 disabled:opacity-40 disabled:shadow-none"
                  >
                    <Send className="ml-0.5 h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            <nav className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-slate-900 text-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.8)]"
                        : "text-slate-500 hover:text-slate-700"
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
