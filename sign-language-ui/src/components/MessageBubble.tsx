import { Loader2, PlayCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Message } from "@/lib/types";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === "user";

  return (
    <div
      className={cn(
        "relative flex max-w-[82%] flex-col",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-3 text-sm shadow-sm md:text-base",
          isUser
            ? "rounded-br-sm bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.7)]"
            : "rounded-bl-sm border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--ink)]",
        )}
      >
        {message.senderLabel && !isUser && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {message.senderLabel}
          </p>
        )}

        {message.type === "text" && (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}

        {message.type === "video" && (
          <div className="relative mb-1 max-w-[300px] overflow-hidden rounded-xl bg-slate-900/90">
            <video src={message.content} controls className="h-auto w-full" />
            {message.isTranslating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 text-white">
                <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
                <span className="text-xs font-medium uppercase tracking-[0.2em]">
                  Translating
                </span>
              </div>
            )}
          </div>
        )}

        {message.type === "avatar" && (
          <div className="min-w-[230px] rounded-xl border border-dashed border-sky-300/45 bg-sky-500/5 p-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-sky-500">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Avatar Gesture
              </span>
              <PlayCircle className="h-4 w-4" />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">
              {message.content}
            </p>
          </div>
        )}
      </div>

      <span className="mt-1 px-1 text-[10px] text-[color:var(--muted)]">
        {message.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {message.type === "video" && ` - ${message.language}`}
        {message.statusTag && ` - ${message.statusTag}`}
      </span>
    </div>
  );
}
