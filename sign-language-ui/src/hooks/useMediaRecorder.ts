import { useRef, useState, useCallback } from "react";
import { MAX_RECORDING_SECONDS } from "@/lib/config";

export function useMediaRecorder() {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
            chunksRef.current = [];
            setVideoBlob(null);

            recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "video/webm" });
                setVideoBlob(blob);
                stream.getTracks().forEach((t) => t.stop());
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setElapsed(0);

            // Auto-stop timer
            timerRef.current = setInterval(() => {
                setElapsed((prev) => {
                    const next = prev + 1;
                    if (next >= MAX_RECORDING_SECONDS) {
                        stopRecording();
                    }
                    return next;
                });
            }, 1000);
        } catch (err) {
            console.error("Failed to access webcam:", err);
            alert("Please allow webcam access to record gestures.");
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [isRecording]);

    const resetRecording = useCallback(() => {
        setVideoBlob(null);
        setElapsed(0);
    }, []);

    return {
        isRecording,
        elapsed,
        videoBlob,
        startRecording,
        stopRecording,
        resetRecording,
        maxSeconds: MAX_RECORDING_SECONDS
    };
}
