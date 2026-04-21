import { API_BASE, LEARNING_API_BASE } from "@/lib/config";

export type TextAvatarResponse = {
    sentence: string;
    resolved_sentence: string;
    lang: string;
    run_id: string;
    run_dir: string;
    video_url: string;
    video_file: string;
};

export interface LearningReferenceClip {
    filename: string;
    word?: string;
    is_medoid?: boolean;
    feature_path?: string;
    similarity?: number;
}

export interface LearningConfusionWord {
    word: string;
    similarity: number;
}

export interface LearningWordInfo {
    clip_count?: number;
    [key: string]: unknown;
}

export interface LearningWordChallenge {
    word: string;
    reference_video: string | null;
    reference_clips: LearningReferenceClip[];
    confusion_words: LearningConfusionWord[];
    word_info: LearningWordInfo | null;
}

export interface LearningFeedbackGrade {
    grade: string;
    message: string;
    score: number;
    emoji?: string;
}

export interface LearningFeedbackDetails {
    target_similarity: number;
    target_percentile: number;
    margin: number;
    raw_score: number;
}

export interface LearningFeedback {
    score: number;
    grade: LearningFeedbackGrade;
    hints: string[];
    confusion: {
        word: string;
        similarity: number;
        warning: string;
    } | null;
    nearest_match: LearningReferenceClip | null;
    target_word: string;
    details: LearningFeedbackDetails;
}

export interface LearningScoring {
    target_word: string;
    target_similarity: number;
    target_percentile: number;
    nearest_wrong_word: string;
    wrong_word_similarity: number;
    margin: number;
    nearest_clips: LearningReferenceClip[];
    raw_score: number;
    calibrated_score: number;
}

export interface LearningScoreResponse {
    attempt_id: string;
    feedback: LearningFeedback;
    scoring: LearningScoring;
}

export interface LearningStats {
    total_attempts: number;
    words_practiced: number;
    avg_score: number;
    best_score: number;
    recent_words: string[];
}

export interface LearningHealth {
    status: "ok" | "error";
    words_available?: number;
    detail?: string;
}

const FALLBACK_LEARNING_WORDS = [
    "hello",
    "thanks",
    "please",
    "yes",
    "no",
    "help",
    "good",
    "water",
    "friend",
    "again",
];
const FALLBACK_REFERENCE_VIDEO = "/demo/trsl-message.mp4";

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
    if (detail && typeof detail === "object") {
        const record = detail as Record<string, unknown>;
        const message = record.message;
        const requestId = record.request_id;
        if (typeof message === "string" && message.trim()) {
            if (typeof requestId === "string" && requestId.trim()) {
                return `${message} (request_id=${requestId})`;
            }
            return message;
        }
    }
    try {
        return JSON.stringify(detail);
    } catch {
        return `${res.status} ${res.statusText}`;
    }
}

function toAbsoluteApiUrl(pathOrUrl: string, base: string = API_BASE): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${base}${normalizedPath}`;
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    return fallback;
}

function asReferenceClips(value: unknown): LearningReferenceClip[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const clips: LearningReferenceClip[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") {
            continue;
        }

        const record = entry as Record<string, unknown>;
        const filename = asString(record.filename).trim();
        if (!filename) {
            continue;
        }

        const similarityValue = asNumber(record.similarity, NaN);
        clips.push({
            filename,
            word: asString(record.word) || undefined,
            is_medoid: typeof record.is_medoid === "boolean" ? record.is_medoid : undefined,
            feature_path: asString(record.feature_path) || undefined,
            similarity: Number.isFinite(similarityValue) ? similarityValue : undefined,
        });
    }
    return clips;
}

function asConfusionWords(value: unknown): LearningConfusionWord[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }
            const record = entry as Record<string, unknown>;
            const word = asString(record.word).trim();
            if (!word) {
                return null;
            }
            return {
                word,
                similarity: asNumber(record.similarity, 0),
            };
        })
        .filter((entry): entry is LearningConfusionWord => Boolean(entry));
}

function normalizeReferenceVideoUrl(pathOrUrl: unknown): string | null {
    const raw = asString(pathOrUrl).trim();
    if (!raw) {
        return null;
    }
    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }
    if (raw.startsWith("/demo/")) {
        return raw;
    }
    if (/^[A-Za-z]:\\/.test(raw) || raw.startsWith("\\\\")) {
        const encodedPath = encodeURIComponent(raw);
        return `${LEARNING_API_BASE}/api/learning/reference-video?path=${encodedPath}`;
    }
    if (raw.startsWith("/")) {
        return toAbsoluteApiUrl(raw, LEARNING_API_BASE);
    }
    if (/\.(mp4|webm|mov)$/i.test(raw)) {
        const encodedPath = encodeURIComponent(raw);
        return `${LEARNING_API_BASE}/api/learning/reference-video?path=${encodedPath}`;
    }
    return null;
}

function parseLearningWordChallenge(payload: unknown): LearningWordChallenge {
    const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const word = asString(record.word).trim().toLowerCase() || FALLBACK_LEARNING_WORDS[0];
    const referenceVideo = normalizeReferenceVideoUrl(record.reference_video);
    const wordInfo =
        record.word_info && typeof record.word_info === "object"
            ? (record.word_info as LearningWordInfo)
            : null;

    return {
        word,
        reference_video: referenceVideo || FALLBACK_REFERENCE_VIDEO,
        reference_clips: asReferenceClips(record.reference_clips),
        confusion_words: asConfusionWords(record.confusion_words),
        word_info: wordInfo,
    };
}

function defaultLearningScoreResponse(word: string): LearningScoreResponse {
    const normalizedWord = word.trim().toLowerCase();
    return {
        attempt_id: "",
        feedback: {
            score: 0,
            grade: {
                grade: "Try Again",
                message: "We could not score this attempt. Please retry.",
                score: 0,
            },
            hints: ["Try to keep both hands in frame and repeat the sign."],
            confusion: null,
            nearest_match: null,
            target_word: normalizedWord,
            details: {
                target_similarity: 0,
                target_percentile: 0,
                margin: 0,
                raw_score: 0,
            },
        },
        scoring: {
            target_word: normalizedWord,
            target_similarity: 0,
            target_percentile: 0,
            nearest_wrong_word: "",
            wrong_word_similarity: 0,
            margin: 0,
            nearest_clips: [],
            raw_score: 0,
            calibrated_score: 0,
        },
    };
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

export async function translateTrslWord(videoBlob: Blob): Promise<string> {
    return translateTrslWordWithMeta(videoBlob);
}

export interface TrslWordRequestMeta {
    requestId?: string;
    wordIndex?: number;
    wordTotal?: number;
}

export async function translateTrslWordWithMeta(
    videoBlob: Blob,
    meta: TrslWordRequestMeta = {},
): Promise<string> {
    const formData = new FormData();
    formData.append("video", videoBlob, "recording.webm");
    formData.append("lang", "TRSL");

    const headers: Record<string, string> = {};
    if (meta.requestId) {
        headers["X-TRSL-Request-Id"] = meta.requestId;
    }
    if (typeof meta.wordIndex === "number") {
        headers["X-TRSL-Word-Index"] = String(meta.wordIndex);
    }
    if (typeof meta.wordTotal === "number") {
        headers["X-TRSL-Word-Total"] = String(meta.wordTotal);
    }

    const res = await fetch(`${API_BASE}/api/translate_trsl_word`, {
        method: "POST",
        headers,
        body: formData,
    });

    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`TRSL word translation failed: ${detail}`);
    }

    const data = await res.json();
    const word = data.word ?? data.text;
    if (typeof word !== "string" || !word.trim()) {
        throw new Error("TRSL word translation returned an empty result.");
    }

    return word.trim();
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

export async function getLearningWords(): Promise<string[]> {
    try {
        const res = await fetch(`${LEARNING_API_BASE}/api/learning/words`);
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }

        const payload = await res.json();
        const words = Array.isArray(payload?.words)
            ? payload.words
                  .map((value: unknown) => asString(value).trim().toLowerCase())
                  .filter((value: string) => Boolean(value))
            : [];
        return words.length > 0 ? words : FALLBACK_LEARNING_WORDS;
    } catch {
        return FALLBACK_LEARNING_WORDS;
    }
}

export async function getLearningHealth(): Promise<LearningHealth> {
    try {
        const res = await fetch(`${LEARNING_API_BASE}/api/learning/health`, {
            cache: "no-store",
        });
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }
        const payload = (await res.json()) as Record<string, unknown>;
        const status = asString(payload.status, "ok").toLowerCase() === "ok" ? "ok" : "error";
        const wordsAvailable = asNumber(payload.words_available, NaN);
        return {
            status,
            words_available: Number.isFinite(wordsAvailable) ? wordsAvailable : undefined,
            detail: status === "error" ? asString(payload.detail) || undefined : undefined,
        };
    } catch (error) {
        return {
            status: "error",
            detail: error instanceof Error ? error.message : "Learning API is unavailable.",
        };
    }
}

export async function getLearningNextWord(): Promise<LearningWordChallenge> {
    const res = await fetch(`${LEARNING_API_BASE}/api/learning/next`);
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Failed to fetch learning challenge: ${detail}`);
    }
    return parseLearningWordChallenge(await res.json());
}

export async function getLearningWord(word: string): Promise<LearningWordChallenge> {
    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) {
        throw new Error("Word is required.");
    }

    try {
        const res = await fetch(
            `${LEARNING_API_BASE}/api/learning/word/${encodeURIComponent(normalizedWord)}`,
        );
        if (res.ok) {
            return parseLearningWordChallenge(await res.json());
        }
    } catch {
        // Endpoint is optional in current backend revisions.
    }

    return {
        word: normalizedWord,
        reference_video: FALLBACK_REFERENCE_VIDEO,
        reference_clips: [],
        confusion_words: [],
        word_info: null,
    };
}

export async function scoreLearningAttempt(
    videoBlob: Blob,
    word: string,
    userId = "anonymous",
): Promise<LearningScoreResponse> {
    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) {
        throw new Error("Target word is required for scoring.");
    }

    const formData = new FormData();
    formData.append("video", videoBlob, "attempt.webm");
    formData.append("word", normalizedWord);
    formData.append("user_id", userId);

    const res = await fetch(`${LEARNING_API_BASE}/api/learning/score`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Learning score failed: ${detail}`);
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const fallback = defaultLearningScoreResponse(normalizedWord);

    const scoringRecord =
        payload.scoring && typeof payload.scoring === "object"
            ? (payload.scoring as Record<string, unknown>)
            : {};
    const feedbackRecord =
        payload.feedback && typeof payload.feedback === "object"
            ? (payload.feedback as Record<string, unknown>)
            : {};
    const gradeRecord =
        feedbackRecord.grade && typeof feedbackRecord.grade === "object"
            ? (feedbackRecord.grade as Record<string, unknown>)
            : {};
    const detailsRecord =
        feedbackRecord.details && typeof feedbackRecord.details === "object"
            ? (feedbackRecord.details as Record<string, unknown>)
            : {};
    const confusionRecord =
        feedbackRecord.confusion && typeof feedbackRecord.confusion === "object"
            ? (feedbackRecord.confusion as Record<string, unknown>)
            : null;
    const nearestMatchRecord =
        feedbackRecord.nearest_match && typeof feedbackRecord.nearest_match === "object"
            ? (feedbackRecord.nearest_match as Record<string, unknown>)
            : null;

    return {
        attempt_id: asString(payload.attempt_id),
        scoring: {
            target_word: asString(scoringRecord.target_word, normalizedWord),
            target_similarity: asNumber(scoringRecord.target_similarity, 0),
            target_percentile: asNumber(scoringRecord.target_percentile, 0),
            nearest_wrong_word: asString(scoringRecord.nearest_wrong_word),
            wrong_word_similarity: asNumber(scoringRecord.wrong_word_similarity, 0),
            margin: asNumber(scoringRecord.margin, 0),
            nearest_clips: asReferenceClips(scoringRecord.nearest_clips),
            raw_score: asNumber(scoringRecord.raw_score, 0),
            calibrated_score: asNumber(scoringRecord.calibrated_score, 0),
        },
        feedback: {
            score: asNumber(feedbackRecord.score, fallback.feedback.score),
            grade: {
                grade: asString(gradeRecord.grade, fallback.feedback.grade.grade),
                message: asString(gradeRecord.message, fallback.feedback.grade.message),
                score: asNumber(gradeRecord.score, fallback.feedback.grade.score),
                emoji: asString(gradeRecord.emoji) || undefined,
            },
            hints: Array.isArray(feedbackRecord.hints)
                ? feedbackRecord.hints
                      .map((value) => asString(value).trim())
                      .filter((value) => Boolean(value))
                : fallback.feedback.hints,
            confusion: confusionRecord
                ? {
                      word: asString(confusionRecord.word),
                      similarity: asNumber(confusionRecord.similarity, 0),
                      warning: asString(confusionRecord.warning),
                  }
                : null,
            nearest_match: nearestMatchRecord
                ? {
                      filename: asString(nearestMatchRecord.filename),
                      similarity: asNumber(nearestMatchRecord.similarity, NaN),
                  }
                : null,
            target_word: asString(feedbackRecord.target_word, normalizedWord),
            details: {
                target_similarity: asNumber(detailsRecord.target_similarity, 0),
                target_percentile: asNumber(detailsRecord.target_percentile, 0),
                margin: asNumber(detailsRecord.margin, 0),
                raw_score: asNumber(detailsRecord.raw_score, 0),
            },
        },
    };
}

export async function confirmLearningAttempt(
    attemptId: string,
    confirmed: boolean,
    userId = "anonymous",
): Promise<void> {
    const trimmedId = attemptId.trim();
    if (!trimmedId) {
        return;
    }

    const formData = new FormData();
    formData.append("confirmed", String(confirmed));
    formData.append("user_id", userId);

    const res = await fetch(`${LEARNING_API_BASE}/api/learning/attempt/${trimmedId}/confirm`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Unable to confirm attempt: ${detail}`);
    }
}

export async function getLearningStats(userId = "anonymous"): Promise<LearningStats> {
    try {
        const params = new URLSearchParams({ user_id: userId });
        const res = await fetch(`${LEARNING_API_BASE}/api/learning/stats?${params.toString()}`);
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }
        const payload = (await res.json()) as Record<string, unknown>;
        return {
            total_attempts: asNumber(payload.total_attempts, 0),
            words_practiced: asNumber(payload.words_practiced, 0),
            avg_score: asNumber(payload.avg_score, 0),
            best_score: asNumber(payload.best_score, 0),
            recent_words: Array.isArray(payload.recent_words)
                ? payload.recent_words
                      .map((value) => asString(value).trim().toLowerCase())
                      .filter((value) => Boolean(value))
                : [],
        };
    } catch {
        return {
            total_attempts: 0,
            words_practiced: 0,
            avg_score: 0,
            best_score: 0,
            recent_words: [],
        };
    }
}
