"use client";

import { useState, useEffect } from "react";
import ChatWindow from "@/components/ChatWindow";
import LanguageSelector from "@/components/LanguageSelector";
import VideoRecorder from "@/components/VideoRecorder";
import { type Message, type SignLanguage } from "@/lib/types";
import { translateVideo, getLanguages } from "@/lib/api";
import { Video, Send, Settings2 } from "lucide-react";

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'system-1',
            sender: 'bot',
            type: 'text',
            content: 'Hello! I am ready to translate your sign language gestures into text. Select your language and tap the video icon to get started.',
            language: 'System',
            timestamp: new Date()
        }
    ]);

    // We start with a default array, then override from API if possible
    const [languages, setLanguages] = useState<SignLanguage[]>(["ASL", "TRSL"]);
    const [targetLang, setTargetLang] = useState<SignLanguage>("ASL");
    const [inputText, setInputText] = useState("");
    const [showVideoRecorder, setShowVideoRecorder] = useState(false);

    useEffect(() => {
        getLanguages().then(langs => {
            if (langs && langs.length > 0) {
                setLanguages(langs as SignLanguage[]);
                if (!langs.includes(targetLang)) setTargetLang(langs[0] as SignLanguage);
            }
        });
    }, []);

    const handleSendVideo = async (blob: Blob) => {
        // 1. Add video message to chat
        const videoUrl = URL.createObjectURL(blob);
        const userMsgId = Date.now().toString();

        const userVideoMsg: Message = {
            id: userMsgId,
            sender: 'user',
            type: 'video',
            content: videoUrl,
            language: targetLang,
            timestamp: new Date(),
            isTranslating: true
        };

        setMessages(prev => [...prev, userVideoMsg]);
        setShowVideoRecorder(false);

        try {
            // 2. Call backend
            const textResponse = await translateVideo(blob, targetLang);

            // 3. Update user message status & add response
            setMessages(prev => prev.map(m =>
                m.id === userMsgId ? { ...m, isTranslating: false } : m
            ));

            const botResponseMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                type: 'text',
                content: textResponse,
                language: targetLang,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botResponseMsg]);

        } catch (error) {
            console.error(error);
            // Handle error state
            setMessages(prev => prev.map(m =>
                m.id === userMsgId ? { ...m, isTranslating: false } : m
            ));
            alert("Failed to translate video. Ensure the backend is running.");
        }
    };

    const handleSendText = () => {
        if (!inputText.trim()) return;

        // Add text message to chat
        const newMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            type: 'text',
            content: inputText,
            language: targetLang,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMsg]);
        setInputText("");

        // TODO (Phase 2): Call avatar translation backend here
        setTimeout(() => {
            const botResponseMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                type: 'text',
                content: "[Avatar generation pending. Phase 2 implementation required.]",
                language: 'System',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botResponseMsg]);
        }, 1000);
    };

    return (
        <main className="flex min-h-screen flex-col bg-[#0b0c10] text-slate-200 font-sans selection:bg-indigo-500/30">
            {/* Top Navigation */}
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-800/60 bg-[#0b0c10]/80 px-4 md:px-8 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <span className="text-white font-bold tracking-tighter">S</span>
                    </div>
                    <h1 className="text-lg font-semibold tracking-tight hidden sm:block">Sign Language AI</h1>
                </div>

                <div className="flex items-center gap-4">
                    <LanguageSelector
                        languages={languages}
                        selected={targetLang}
                        onChange={setTargetLang}
                    />
                    <button className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                        <Settings2 className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 relative flex flex-col pt-4 pb-24 md:pb-28">
                <ChatWindow messages={messages} />
            </div>

            {/* Bottom Input Area */}
            <footer className="fixed bottom-0 w-full left-0 border-t border-slate-800/60 bg-[#0b0c10]/90 backdrop-blur-xl pb-safe pt-3 md:pb-6 px-4 z-20">
                <div className="max-w-4xl mx-auto w-full relative">

                    {/* Render Video Recorder Popover if active */}
                    {showVideoRecorder && (
                        <VideoRecorder
                            onSend={handleSendVideo}
                            onCancel={() => setShowVideoRecorder(false)}
                        />
                    )}

                    {/* Standard Text Input Bar */}
                    <div className="flex items-end gap-2 md:gap-3 bg-slate-900 border border-slate-800 p-2 rounded-3xl shadow-lg transition-all focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10">

                        <button
                            onClick={() => setShowVideoRecorder(!showVideoRecorder)}
                            className={`p-3 rounded-full flex-shrink-0 transition-all ${showVideoRecorder ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="Record Gesture"
                        >
                            <Video className="w-5 h-5" />
                        </button>

                        <div className="flex-1 min-h-[44px]">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={`Message targeting ${targetLang} Avatar...`}
                                className="w-full bg-transparent border-0 resize-none outline-none overflow-hidden max-h-32 text-slate-200 placeholder:text-slate-500 py-3 px-2 text-[15px] focus:ring-0 leading-tight"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendText();
                                    }
                                }}
                            />
                        </div>

                        <button
                            onClick={handleSendText}
                            disabled={!inputText.trim()}
                            className="p-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full flex-shrink-0 disabled:opacity-50 disabled:grayscale transition-all shadow-md mt-auto"
                        >
                            <Send className="w-4 h-4 ml-0.5" />
                        </button>
                    </div>

                </div>
            </footer>
        </main>
    );
}
