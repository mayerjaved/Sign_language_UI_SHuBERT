import { API_BASE } from "@/lib/config";

export async function translateVideo(videoBlob: Blob, lang: string): Promise<string> {
    const formData = new FormData();
    formData.append("video", videoBlob, "recording.webm");
    formData.append("lang", lang);

    const res = await fetch(`${API_BASE}/api/translate_video`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) throw new Error(`Translation failed: ${res.statusText}`);
    const data = await res.json();
    return data.text;
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
