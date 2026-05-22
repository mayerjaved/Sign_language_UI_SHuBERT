import { useCallback, useRef, useState } from "react";
import { MAX_RECORDING_SECONDS } from "@/lib/config";
import {
  createVideoMediaRecorder,
  getCameraRecordingUnavailableMessage,
  getRecordedVideoMimeType,
} from "@/lib/mediaRecorder";

interface UseMediaRecorderOptions {
  maxSeconds?: number;
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}) {
  const maxSeconds = options.maxSeconds ?? MAX_RECORDING_SECONDS;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const discardNextBlobRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setPreviewStream(null);
  }, []);

  const stopRecording = useCallback((discard = false) => {
    if (discard) {
      discardNextBlobRef.current = true;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
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
      chunksRef.current = [];
      discardNextBlobRef.current = false;
      setVideoBlob(null);

      const recorder = createVideoMediaRecorder(stream);
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: getRecordedVideoMimeType(recorder),
        });
        if (!discardNextBlobRef.current) {
          setVideoBlob(blob);
        }
        discardNextBlobRef.current = false;
        stopStream();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setElapsed(0);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to access webcam:", err);
      stopStream();
      alert(getCameraRecordingUnavailableMessage(err));
    }
  }, [maxSeconds, stopRecording, stopStream]);

  const resetRecording = useCallback(() => {
    if (isRecording) {
      stopRecording(true);
    }
    chunksRef.current = [];
    setVideoBlob(null);
    setElapsed(0);
    stopStream();
  }, [isRecording, stopRecording, stopStream]);

  return {
    isRecording,
    elapsed,
    videoBlob,
    previewStream,
    startRecording,
    stopRecording,
    resetRecording,
    maxSeconds,
  };
}
