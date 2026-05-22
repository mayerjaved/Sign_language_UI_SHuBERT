const VIDEO_MIME_CANDIDATES = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=h264",
    "video/mp4",
];

export function getSupportedVideoMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
        return undefined;
    }

    return VIDEO_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function createVideoMediaRecorder(stream: MediaStream): MediaRecorder {
    if (typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support MediaRecorder video capture.");
    }

    const mimeType = getSupportedVideoMimeType();
    if (mimeType) {
        return new MediaRecorder(stream, { mimeType });
    }

    return new MediaRecorder(stream);
}

export function getRecordedVideoMimeType(recorder: MediaRecorder | null): string {
    return recorder?.mimeType || getSupportedVideoMimeType() || "video/webm";
}

export function getVideoFileName(blob: Blob, baseName: string): string {
    const mimeType = blob.type.toLowerCase();
    if (mimeType.includes("mp4")) {
        return `${baseName}.mp4`;
    }
    if (mimeType.includes("quicktime")) {
        return `${baseName}.mov`;
    }
    if (mimeType.includes("webm")) {
        return `${baseName}.webm`;
    }
    return `${baseName}.webm`;
}

export function getCameraRecordingUnavailableMessage(error: unknown): string {
    if (typeof window !== "undefined" && !window.isSecureContext) {
        return "Camera recording requires HTTPS or localhost. Open the app from a secure URL and try again.";
    }

    const name =
        typeof DOMException !== "undefined" && error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
        return "Camera access was blocked. Allow camera permission and try again.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
        return "No usable camera was found for recording.";
    }
    if (name === "NotReadableError" || name === "AbortError") {
        return "The camera is already in use or could not be started.";
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Unable to start camera recording in this browser.";
}
