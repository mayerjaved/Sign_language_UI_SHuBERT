"use client";

import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { Video, Square, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface VideoRecorderProps {
    onSend: (blob: Blob) => void;
    onCancel: () => void;
}

export default function VideoRecorder({ onSend, onCancel }: VideoRecorderProps) {
    const {
        isRecording,
        elapsed,
        videoBlob,
        startRecording,
        stopRecording,
        resetRecording,
        maxSeconds
    } = useMediaRecorder();

    const progressPercent = (elapsed / maxSeconds) * 100;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full absolute bottom-full left-0 mb-4 bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
            >
                {/* Glowing border effect */}
                {isRecording && (
                    <div className="absolute top-0 left-0 h-1 bg-red-500/80 w-full transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        style={{ width: `${progressPercent}%` }}
                    />
                )}

                <div className="flex flex-col items-center gap-4">
                    {/* Header */}
                    <div className="w-full flex items-center justify-between text-slate-400 text-sm font-medium">
                        <div className="flex items-center gap-2">
                            {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                            <span>{isRecording ? "Recording Gesture" : videoBlob ? "Review Gesture" : "Ready to Record"}</span>
                        </div>
                        <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded">
                            0:{elapsed.toString().padStart(2, '0')} / 0:{maxSeconds.toString().padStart(2, '0')}
                        </span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4 justify-center py-2">
                        {!isRecording && !videoBlob ? (
                            <button
                                onClick={startRecording}
                                className="group relative w-16 h-16 rounded-full bg-slate-800 border-2 border-red-500/50 flex items-center justify-center hover:bg-slate-700 hover:border-red-400 transition-all shadow-[0_0_0_0_rgba(239,68,68,0)] hover:shadow-[0_0_20px_0_rgba(239,68,68,0.3)]"
                            >
                                <div className="w-6 h-6 rounded-full bg-red-500 group-hover:scale-110 transition-transform" />
                            </button>
                        ) : isRecording ? (
                            <button
                                onClick={stopRecording}
                                className="w-16 h-16 rounded-full bg-slate-800 border-2 border-red-500 flex items-center justify-center hover:bg-slate-700 transition-all animate-pulse"
                            >
                                <Square className="w-6 h-6 text-red-500 fill-red-500" />
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={resetRecording}
                                    className="px-4 py-2.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors border border-slate-700"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span>Retake</span>
                                </button>
                                <button
                                    onClick={() => videoBlob && onSend(videoBlob)}
                                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:from-violet-500 hover:to-indigo-500 flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/25"
                                >
                                    <span>Send Video</span>
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Cancel Footer */}
                    <button
                        onClick={onCancel}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Cancel Recording
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
