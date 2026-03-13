"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Send, Square, Video } from "lucide-react";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";

interface VideoRecorderProps {
  onSend: (blob: Blob) => void;
  onCancel: () => void;
}

export default function VideoRecorder({ onSend, onCancel }: VideoRecorderProps) {
  const {
    isRecording,
    elapsed,
    videoBlob,
    previewStream,
    startRecording,
    stopRecording,
    resetRecording,
    maxSeconds,
  } = useMediaRecorder();

  const previewRef = useRef<HTMLVideoElement>(null);

  const recordedUrl = useMemo(
    () => (videoBlob ? URL.createObjectURL(videoBlob) : null),
    [videoBlob],
  );

  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    if (previewStream) {
      preview.srcObject = previewStream;
      preview
        .play()
        .catch(() => {
          // Ignore autoplay errors; user gesture will start playback.
        });
    } else {
      preview.srcObject = null;
    }
  }, [previewStream]);

  const progressPercent = (elapsed / maxSeconds) * 100;
  const showLivePreview = Boolean(previewStream) && !videoBlob;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="absolute bottom-full left-0 mb-4 w-full overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur-xl"
      >
        {isRecording && (
          <div
            className="absolute left-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-300"
            style={{ width: `${progressPercent}%` }}
          />
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-2 font-medium">
              {isRecording && (
                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
              )}
              <span>
                {isRecording
                  ? "Recording gesture"
                  : videoBlob
                    ? "Review your take"
                    : "Ready to record"}
              </span>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-500">
              0:{elapsed.toString().padStart(2, "0")} / 0:
              {maxSeconds.toString().padStart(2, "0")}
            </span>
          </div>

          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/95 shadow-inner">
            {showLivePreview ? (
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
                onLoadedMetadata={() => {
                  previewRef.current?.play().catch(() => {});
                }}
              />
            ) : videoBlob && recordedUrl ? (
              <video
                src={recordedUrl}
                controls
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-300">
                <Video className="h-6 w-6" />
                <p className="text-xs uppercase tracking-[0.2em]">Camera Preview</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isRecording && !videoBlob ? (
              <button
                onClick={startRecording}
                className="group flex items-center gap-3 rounded-full border border-rose-200/60 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-rose-300 hover:text-slate-900 hover:shadow-md"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_8px_18px_-8px_rgba(244,63,94,0.8)]">
                  <span className="block h-3 w-3 rounded-full bg-white/90" />
                </span>
                Start recording
              </button>
            ) : isRecording ? (
              <button
                onClick={() => stopRecording()}
                className="flex items-center gap-3 rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-16px_rgba(244,63,94,0.9)] transition-all hover:bg-rose-400"
              >
                <Square className="h-4 w-4 fill-white" />
                Stop recording
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={resetRecording}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-slate-300 hover:text-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
                <button
                  onClick={() => videoBlob && onSend(videoBlob)}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)] transition-all hover:from-sky-500 hover:to-blue-500"
                >
                  Send video
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onCancel}
            className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-600"
          >
            Cancel recording
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
