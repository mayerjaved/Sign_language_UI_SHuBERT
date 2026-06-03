"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Clock3, Square, Video } from "lucide-react";
import {
  createVideoMediaRecorder,
  getCameraRecordingUnavailableMessage,
  getRecordedVideoMimeType,
} from "@/lib/mediaRecorder";

type CapturePhase = "idle" | "countdown" | "recording" | "pause";

interface TrslWordRecorderProps {
  onComplete: (wordClips: Blob[]) => void | Promise<void>;
  onCancel: () => void;
  autoStart?: boolean;
  inline?: boolean;
  maxWords?: number;
  recorderLabel?: string;
  recordSeconds?: number;
  pauseSeconds?: number;
  prepSeconds?: number;
}

export default function TrslWordRecorder({
  onComplete,
  onCancel,
  autoStart = false,
  inline = false,
  maxWords = 5,
  recorderLabel = "TRSL",
  recordSeconds = 3,
  pauseSeconds = 1,
  prepSeconds = 3,
}: TrslWordRecorderProps) {
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentWordNumber, setCurrentWordNumber] = useState(1);
  const [capturedCount, setCapturedCount] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const capturedRef = useRef<Blob[]>([]);
  const stopRequestedRef = useRef(false);
  const discardNextClipRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const phaseTimeoutRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const nextWordAfterPauseRef = useRef<number>(1);
  const autoStartedRef = useRef(false);
  const startSessionRef = useRef<(() => Promise<void>) | null>(null);

  const isRecording = phase === "recording";
  const isCountdown = phase === "countdown";
  const isPause = phase === "pause";
  const activeSeconds = isCountdown ? prepSeconds : isPause ? pauseSeconds : recordSeconds;
  const progressPercent = Math.min((elapsedMs / (activeSeconds * 1000)) * 100, 100);
  const countdownSecondsLeft = Math.max(
    1,
    Math.ceil((activeSeconds * 1000 - elapsedMs) / 1000),
  );
  const barClassName = isCountdown
    ? "bg-gradient-to-r from-sky-600 via-blue-500 to-cyan-400"
    : isPause
    ? "bg-gradient-to-r from-rose-600 via-rose-500 to-red-400"
    : "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400";
  const shouldShowProgressBar = isRecording || isPause;
  const containerClassName = inline
    ? "w-full overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-4 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur-xl"
    : "absolute bottom-full left-0 mb-4 w-full overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-4 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur-xl";

  const stopTick = () => {
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  const stopPhaseTimeout = () => {
    if (phaseTimeoutRef.current) {
      window.clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }
  };

  const stopTimers = () => {
    stopTick();
    stopPhaseTimeout();
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setPreviewStream(null);
  };

  const resetSessionState = () => {
    stopTimers();
    isSessionActiveRef.current = false;
    setIsSessionActive(false);
    stopRequestedRef.current = false;
    discardNextClipRef.current = false;
    chunksRef.current = [];
    capturedRef.current = [];
    setCapturedCount(0);
    setCurrentWordNumber(1);
    setElapsedMs(0);
    setPhase("idle");
  };

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    if (previewStream) {
      preview.srcObject = previewStream;
      preview.play().catch(() => {});
    } else {
      preview.srcObject = null;
    }
  }, [previewStream]);

  useEffect(() => {
    return () => {
      discardNextClipRef.current = true;
      stopTick();
      stopPhaseTimeout();
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {}
      stopStream();
    };
  }, []);

  const beginProgressTicker = (durationMs: number) => {
    stopTick();
    const startedAt = Date.now();
    setElapsedMs(0);
    tickIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(Math.min(elapsed, durationMs));
    }, 50);
  };

  const completeSession = () => {
    if (!isSessionActiveRef.current) {
      return;
    }

    const clips = [...capturedRef.current];
    resetSessionState();
    stopStream();
    if (clips.length > 0) {
      void Promise.resolve(onComplete(clips)).catch((err) => {
        console.error("Failed to handle TRSL word clips:", err);
      });
    }
  };

  const beginPausePhase = (nextWordNumber: number) => {
    if (!isSessionActiveRef.current) return;
    setPhase("pause");
    nextWordAfterPauseRef.current = nextWordNumber;
    const pauseDurationMs = pauseSeconds * 1000;
    beginProgressTicker(pauseDurationMs);
    stopPhaseTimeout();
    phaseTimeoutRef.current = window.setTimeout(() => {
      stopPhaseTimeout();
      stopTick();
      if (!isSessionActiveRef.current) return;
      if (stopRequestedRef.current) {
        completeSession();
        return;
      }
      beginRecordingPhase(nextWordAfterPauseRef.current);
    }, pauseDurationMs);
  };

  const beginCountdownPhase = (wordNumber: number) => {
    if (!isSessionActiveRef.current) return;
    setPhase("countdown");
    setCurrentWordNumber(wordNumber);
    setError(null);
    const prepDurationMs = prepSeconds * 1000;
    beginProgressTicker(prepDurationMs);
    stopPhaseTimeout();
    phaseTimeoutRef.current = window.setTimeout(() => {
      stopPhaseTimeout();
      stopTick();
      if (!isSessionActiveRef.current) return;
      if (stopRequestedRef.current) {
        completeSession();
        return;
      }
      beginRecordingPhase(wordNumber);
    }, prepDurationMs);
  };

  const beginRecordingPhase = (wordNumber: number) => {
    if (!isSessionActiveRef.current) return;
    setPhase("recording");
    setCurrentWordNumber(wordNumber);
    setError(null);
    chunksRef.current = [];

    try {
      if (!streamRef.current) {
        throw new Error("Camera stream is not ready yet.");
      }
      recorderRef.current = createVideoMediaRecorder(streamRef.current);
    } catch (err) {
      console.error("Failed to start TRSL recorder:", err);
      setError(getCameraRecordingUnavailableMessage(err));
      resetSessionState();
      stopStream();
      return;
    }

    const recorder = recorderRef.current;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      recorderRef.current = null;
      stopTick();

      if (discardNextClipRef.current) {
        discardNextClipRef.current = false;
        return;
      }

      const clip = new Blob(chunksRef.current, {
        type: getRecordedVideoMimeType(recorder),
      });
      if (clip.size <= 0) {
        if (stopRequestedRef.current) {
          completeSession();
          return;
        }
        beginPausePhase(wordNumber + 1);
        return;
      }

      capturedRef.current = [...capturedRef.current, clip];
      setCapturedCount(capturedRef.current.length);

      if (stopRequestedRef.current || capturedRef.current.length >= maxWords) {
        completeSession();
        return;
      }

      beginPausePhase(wordNumber + 1);
    };

    recorder.onerror = (event) => {
      console.error("TRSL recorder error:", event);
      setError("Recording stopped unexpectedly. Please try again.");
    };

    try {
      recorder.start();
    } catch (err) {
      console.error("Failed to start TRSL recorder:", err);
      setError(getCameraRecordingUnavailableMessage(err));
      recorderRef.current = null;
      resetSessionState();
      stopStream();
      return;
    }

    const recordDurationMs = recordSeconds * 1000;
    beginProgressTicker(recordDurationMs);
    stopPhaseTimeout();
    phaseTimeoutRef.current = window.setTimeout(() => {
      stopPhaseTimeout();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    }, recordDurationMs);
  };

  const startSession = async () => {
    if (isSessionActiveRef.current) {
      return;
    }

    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera recording is not available in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      setPreviewStream(stream);
    } catch (err) {
      console.error("Failed to access webcam:", err);
      setError(getCameraRecordingUnavailableMessage(err));
      return;
    }

    isSessionActiveRef.current = true;
    setIsSessionActive(true);
    stopRequestedRef.current = false;
    discardNextClipRef.current = false;
    capturedRef.current = [];
    setCapturedCount(0);
    setCurrentWordNumber(1);
    beginCountdownPhase(1);
  };
  startSessionRef.current = startSession;

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || isSessionActiveRef.current) {
      return;
    }
    autoStartedRef.current = true;
    void startSessionRef.current?.();
  }, [autoStart]);

  const stopNow = () => {
    if (!isSessionActiveRef.current) {
      return;
    }

    stopRequestedRef.current = true;
    if (isRecording && recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      return;
    }

    if (isPause) {
      completeSession();
    }

    if (isCountdown) {
      completeSession();
    }
  };

  const handleCancel = () => {
    discardNextClipRef.current = true;
    stopRequestedRef.current = true;
    isSessionActiveRef.current = false;
    setIsSessionActive(false);
    stopTimers();
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {}
    recorderRef.current = null;
    stopStream();
    setPhase("idle");
    setElapsedMs(0);
    onCancel();
  };

  const phaseLabel = useMemo(() => {
    if (isRecording) {
      return `Recording word ${currentWordNumber} / ${maxWords}`;
    }
    if (isCountdown) {
      return `Get ready: recording starts in ${countdownSecondsLeft}`;
    }
    if (isPause) {
      return "Reset for next word";
    }
    return maxWords === 1
      ? `Ready for ${recorderLabel} one-word capture`
      : `Ready for ${recorderLabel} ${maxWords}-word capture`;
  }, [countdownSecondsLeft, currentWordNumber, isCountdown, isPause, isRecording, maxWords, recorderLabel]);

  const startButtonLabel = maxWords === 1 ? "Start one-word capture" : `Start ${maxWords}-word capture`;
  const idleInstruction =
    maxWords === 1
      ? "Press start to auto-capture one word."
      : `Press start to auto-capture up to ${maxWords} words in one run.`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className={containerClassName}
      >
        {shouldShowProgressBar && (
          <div
            className={`absolute left-0 top-0 h-1 ${barClassName}`}
            style={{ width: `${progressPercent}%` }}
          />
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
            <div className="flex items-center gap-2 font-medium">
              {(isRecording || isPause || isCountdown) && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    isCountdown ? "bg-sky-500" : isPause ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
              )}
              <span>{phaseLabel}</span>
            </div>
            <span className="rounded-full bg-[color:var(--surface-soft)] px-3 py-1 font-mono text-xs text-[color:var(--muted)]">
              Words: {capturedCount}/{maxWords}
            </span>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[color:var(--border)] bg-slate-950/95 shadow-inner">
            {previewStream ? (
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
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-300">
                {isCountdown ? <Clock3 className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                <p className="text-xs uppercase tracking-[0.2em]">
                  {recorderLabel} Word Recorder
                </p>
              </div>
            )}
            {isCountdown && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/55 px-4 text-center text-white backdrop-blur-[1px]">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-100">
                  Step back
                </p>
                <div className="mt-3 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/80 bg-white/15 text-6xl font-black shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
                  {countdownSecondsLeft}
                </div>
                <p className="mt-3 text-sm font-bold text-sky-50">
                  Recording starts after the countdown.
                </p>
                <p className="mt-1 max-w-xs text-xs font-semibold text-white/85">
                  Keep your torso and both hands in the camera view.
                </p>
              </div>
            )}
          </div>

          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              isCountdown
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : isPause
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : isRecording
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--muted)]"
            }`}
          >
            {isCountdown && `Step back now. Recording starts in ${countdownSecondsLeft}s.`}
            {isRecording && "Green: sign one word now (3s clip)."}
            {isPause && "Red: short reset pause (1s) before the next word."}
            {!isCountdown && !isRecording && !isPause && idleInstruction}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Keep your whole torso and both hands inside the camera frame for the full recording.
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isSessionActive ? (
              <button
                onClick={startSession}
                className="group flex items-center gap-3 rounded-full border border-emerald-200/70 bg-[color:var(--surface)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_18px_-8px_rgba(16,185,129,0.8)]">
                  <Camera className="h-4 w-4" />
                </span>
                {startButtonLabel}
              </button>
            ) : (
              <button
                onClick={isCountdown ? handleCancel : stopNow}
                className="flex items-center gap-3 rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-16px_rgba(244,63,94,0.9)] transition-all hover:bg-rose-400"
              >
                <Square className="h-4 w-4 fill-white" />
                {isCountdown ? "Cancel countdown" : "Stop and translate"}
              </button>
            )}
          </div>

          <button
            onClick={handleCancel}
            className="text-xs font-medium uppercase tracking-[0.2em] text-[color:var(--muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            Cancel recording
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
