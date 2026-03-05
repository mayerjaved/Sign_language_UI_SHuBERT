"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import { type Message } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface ChatWindowProps {
    messages: Message[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-4">
                    <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(124,58,237,0.3)]">
                        <span className="text-3xl">👋</span>
                    </div>
                    <p className="text-center max-w-md">
                        Start a conversation by typing a message below or recording a sign language gesture.
                    </p>
                </div>
            ) : (
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <MessageBubble message={msg} />
                        </motion.div>
                    ))}
                    <div ref={bottomRef} className="h-4" />
                </AnimatePresence>
            )}
        </div>
    );
}
