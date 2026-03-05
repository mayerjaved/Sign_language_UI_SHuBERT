import { type Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function MessageBubble({ message }: { message: Message }) {
    const isUser = message.sender === "user";

    return (
        <div
            className={cn(
                "relative flex flex-col max-w-[80%]",
                isUser ? "items-end" : "items-start"
            )}
        >
            <div
                className={cn(
                    "px-4 py-3 rounded-2xl shadow-sm text-sm md:text-base",
                    isUser
                        ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm"
                        : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm"
                )}
            >
                {/* Render Text Content */}
                {message.type === "text" && (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}

                {/* Render Video Content */}
                {message.type === "video" && (
                    <div className="relative rounded-lg overflow-hidden bg-black/40 mb-1 max-w-[280px]">
                        <video
                            src={message.content}
                            controls
                            className="w-full h-auto object-cover max-h-[300px]"
                        />
                        {message.isTranslating && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                <span className="text-xs font-medium">Translating...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <span className="text-[10px] text-slate-500 mt-1 px-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {message.type === 'video' && ` • ${message.language}`}
            </span>
        </div>
    );
}
