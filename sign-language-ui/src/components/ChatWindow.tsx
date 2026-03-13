"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "./MessageBubble";
import { type Message } from "@/lib/types";

interface ChatWindowProps {
  messages: Message[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex-1 w-full px-6 py-6 md:px-8 md:py-8 space-y-6 custom-scrollbar">
      {messages.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-slate-500">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
            SL
          </div>
          <p className="max-w-md text-center text-sm">
            Start a conversation by typing a message below or recording a sign language gesture.
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, scale: 0.98, y: 16 }}
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
