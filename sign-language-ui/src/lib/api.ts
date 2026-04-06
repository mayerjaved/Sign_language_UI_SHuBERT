import { API_BASE } from "@/lib/config";

export type TextAvatarResponse = {
    sentence: string;
    resolved_sentence: string;
    lang: string;
    run_id: string;
    run_dir: string;
    video_url: string;
    video_file: string;
};

async function readErrorDetail(res: Response): Promise<string> {
    let detail: unknown = `${res.status} ${res.statusText}`;
    try {
        const payload = await res.json();
        detail = payload?.detail ?? payload?.text ?? payload;
    } catch {
        const text = await res.text();
        if (text) {
            detail = text;
        }
    }

    if (typeof detail === "string") {
        return detail;
    }
    if (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>)) {
        const message = (detail as Record<string, unknown>).message;
        if (typeof message === "string" && message.trim()) {
            return message;
        }
    }
    try {
        return JSON.stringify(detail);
    } catch {
        return `${res.status} ${res.statusText}`;
    }
}

function toAbsoluteApiUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${API_BASE}${normalizedPath}`;
}

export async function translateVideo(videoBlob: Blob, lang: string): Promise<string> {
    const formData = new FormData();
    formData.append("video", videoBlob, "recording.webm");
    formData.append("lang", lang);

    const res = await fetch(`${API_BASE}/api/translate_video`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Translation failed: ${detail}`);
    }
    const data = await res.json();
    return data.text;
}

export async function generateTextAvatar(
    sentence: string,
    lang: string,
): Promise<TextAvatarResponse & { video_src: string }> {
    const formData = new FormData();
    formData.append("sentence", sentence);
    formData.append("lang", lang);

    const res = await fetch(`${API_BASE}/api/text_to_avatar`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Avatar generation failed: ${detail}`);
    }

    const data = (await res.json()) as TextAvatarResponse;
    return {
        ...data,
        video_src: toAbsoluteApiUrl(data.video_url),
    };
}

export async function getLanguages(): Promise<string[]> {
    try {
        const res = await fetch(`${API_BASE}/api/languages`);
        const data = await res.json();
        return data.languages;
    } catch {
        // Fallback or mock data when backend isn't available
        return ["ASL", "TRSL", "PSL"];
    }
}
