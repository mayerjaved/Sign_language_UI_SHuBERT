"use client";

import { useEffect, useState } from "react";
import { Send, Settings2, Video } from "lucide-react";
import ChatWindow from "@/components/ChatWindow";
import LanguageSelector from "@/components/LanguageSelector";
import VideoRecorder from "@/components/VideoRecorder";
import { getLanguages, translateVideo } from "@/lib/api";
import { type Message, type SignLanguage } from "@/lib/types";

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

  const handleSendVideo = async (blob: Blob) => {
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
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0c10] text-slate-200 font-sans selection:bg-indigo-500/30">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-800/60 bg-[#0b0c10]/80 px-4 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <span className="font-bold tracking-tighter text-white">S</span>
          </div>
          <h1 className="hidden text-lg font-semibold tracking-tight sm:block">
            Sign Language AI
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSelector
            languages={languages}
            selected={targetLang}
            onChange={setTargetLang}
          />
          <button className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col pb-24 pt-4 md:pb-28">
        <ChatWindow messages={messages} />
      </div>

      <footer className="fixed bottom-0 left-0 z-20 w-full border-t border-slate-800/60 bg-[#0b0c10]/90 px-4 pb-safe pt-3 backdrop-blur-xl md:pb-6">
        <div className="relative mx-auto w-full max-w-4xl">
          {showVideoRecorder && (
            <VideoRecorder
              onSend={handleSendVideo}
              onCancel={() => setShowVideoRecorder(false)}
            />
          )}

          <div className="flex items-end gap-2 rounded-3xl border border-slate-800 bg-slate-900 p-2 shadow-lg transition-all focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 md:gap-3">
            <button
              onClick={() => setShowVideoRecorder(!showVideoRecorder)}
              className={`flex-shrink-0 rounded-full p-3 transition-all ${
                showVideoRecorder
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
              title="Record Gesture"
            >
              <Video className="h-5 w-5" />
            </button>

            <div className="min-h-[44px] flex-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message targeting ${targetLang} Avatar...`}
                className="max-h-32 w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-3 text-[15px] leading-tight text-slate-200 outline-none placeholder:text-slate-500 focus:ring-0"
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
              className="mt-auto flex-shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 p-3 text-white shadow-md transition-all disabled:grayscale disabled:opacity-50"
            >
              <Send className="ml-0.5 h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
