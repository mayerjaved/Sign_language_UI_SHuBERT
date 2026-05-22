import { API_BASE, LEARNING_API_BASE } from "@/lib/config";
import { getVideoFileName } from "@/lib/mediaRecorder";

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
    distance?: number;
}

export interface LearningConfusionWord {
    word: string;
    similarity?: number;
    distance?: number;
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
    target_distance?: number;
    wrong_word_distance?: number;
    margin: number;
    raw_score: number;
    calibration?: LearningScoreCalibration | null;
    nearest_words?: LearningNearestWord[];
    scoring_streams?: string[];
    ignored_streams?: string[];
    warnings?: string[];
}

export interface LearningFeedback {
    score: number;
    grade: LearningFeedbackGrade;
    hints: string[];
    confusion: {
        word: string;
        similarity?: number;
        distance?: number;
        warning: string;
    } | null;
    nearest_match: LearningReferenceClip | null;
    target_word: string;
    details: LearningFeedbackDetails;
}

export interface LearningScoreCalibration {
    available?: boolean;
    score?: number;
    percentile_score?: number;
    fallback_distance_score?: number;
    source?: string;
    is_distance_metric?: boolean;
    percentile?: number;
    raw_min?: number;
    raw_max?: number;
    clamped_low?: boolean;
    clamped_high?: boolean;
    tail_floor_score?: number | null;
    [key: string]: unknown;
}

export interface LearningNearestWord {
    word: string;
    distance: number;
    role?: string;
}

export interface LearningScoring {
    target_word: string;
    predicted_word?: string;
    target_similarity: number;
    target_percentile: number;
    target_distance?: number;
    nearest_wrong_word: string;
    wrong_word_similarity: number;
    wrong_word_distance?: number;
    margin: number;
    nearest_clips: LearningReferenceClip[];
    raw_score: number;
    calibrated_score: number;
    calibration?: LearningScoreCalibration | null;
    nearest_words?: LearningNearestWord[];
    manifold_word_count?: number;
    scoring_streams?: string[];
    ignored_streams?: string[];
    warnings?: string[];
}

export interface LearningScoreResponse {
    attempt_id: string;
    feedback: LearningFeedback;
    scoring: LearningScoring;
    debug?: LearningScoreDebug | null;
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
    indexed_words?: number;
    manifold_words?: number;
    warnings?: string[];
    detail?: string;
}

export interface ApiRequestOptions {
    authToken?: string | null;
}

export interface LearningDebugMetric {
    shape?: number[];
    dtype?: string;
    frame_count?: number;
    finite_ratio?: number;
    zero_row_count?: number;
    norm_min?: number;
    norm_mean?: number;
    norm_max?: number;
    norm?: number;
    [key: string]: unknown;
}

export interface LearningScoreDebug {
    request_id?: string;
    attempt_id?: string;
    target_word?: string;
    user_id?: string;
    request?: Record<string, unknown>;
    video?: LearningDebugMetric & {
        height?: number;
        width?: number;
        channels?: number;
        decoder_repaired?: boolean;
        retained?: boolean;
    };
    models?: Record<string, unknown>;
    features?: Record<string, LearningDebugMetric>;
    sequence?: LearningDebugMetric;
    backend?: {
        indexed_word_count?: number;
        available_word_count?: number;
        available_word_sample?: string[];
        manifold?: Record<string, unknown>;
        calibration?: Record<string, unknown>;
        warnings?: string[];
    };
    scoring?: {
        target_word?: string;
        predicted_word?: string;
        target_distance?: number;
        wrong_word_distance?: number;
        margin?: number;
        raw_score?: number;
        calibrated_score?: number;
        calibration?: LearningScoreCalibration | null;
        nearest_words?: LearningNearestWord[];
        scoring_streams?: string[];
        ignored_streams?: string[];
    };
    timings_ms?: Record<string, number>;
    warnings?: string[];
    error?: string;
    [key: string]: unknown;
}

export type LibraryLanguage = "ASL" | "TRSL";

export interface SignLibraryEntry {
    id: string;
    language: LibraryLanguage;
    word: string;
    display_word: string;
    translation: string;
    class_id?: number;
    clip_count: number;
    video_id: string;
    video_url: string;
    dataset: string;
    source: string;
    split?: string;
}

export interface SignLibraryResponse {
    language_counts: Record<LibraryLanguage, number>;
    total: number;
    entries: SignLibraryEntry[];
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

function getAuthHeaders(options?: ApiRequestOptions): HeadersInit | undefined {
    const token = options?.authToken?.trim();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
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

function asOptionalNumber(value: unknown): number | undefined {
    const parsed = asNumber(value, NaN);
    return Number.isFinite(parsed) ? parsed : undefined;
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
        const distanceValue = asNumber(record.distance, NaN);
        clips.push({
            filename,
            word: asString(record.word) || undefined,
            is_medoid: typeof record.is_medoid === "boolean" ? record.is_medoid : undefined,
            feature_path: asString(record.feature_path) || undefined,
            similarity: Number.isFinite(similarityValue) ? similarityValue : undefined,
            distance: Number.isFinite(distanceValue) ? distanceValue : undefined,
        });
    }
    return clips;
}

function asConfusionWords(value: unknown): LearningConfusionWord[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const words: LearningConfusionWord[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") {
            continue;
        }

        const record = entry as Record<string, unknown>;
        const word = asString(record.word).trim();
        if (!word) {
            continue;
        }

        const parsed: LearningConfusionWord = { word };
        const similarity = asNumber(record.similarity, NaN);
        const distance = asNumber(record.distance, NaN);
        if (Number.isFinite(similarity)) {
            parsed.similarity = similarity;
        }
        if (Number.isFinite(distance)) {
            parsed.distance = distance;
        }
        words.push(parsed);
    }
    return words;
}

function asNearestWords(value: unknown): LearningNearestWord[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const words: LearningNearestWord[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") {
            continue;
        }

        const record = entry as Record<string, unknown>;
        const word = asString(record.word).trim();
        const distance = asNumber(record.distance, NaN);
        if (!word || !Number.isFinite(distance)) {
            continue;
        }

        const parsed: LearningNearestWord = { word, distance };
        const role = asString(record.role).trim();
        if (role) {
            parsed.role = role;
        }
        words.push(parsed);
    }
    return words;
}

function asStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((entry) => asString(entry).trim()).filter((entry) => Boolean(entry));
}

function asCalibration(value: unknown): LearningScoreCalibration | null {
    return value && typeof value === "object" ? (value as LearningScoreCalibration) : null;
}

function asScoreDebug(value: unknown): LearningScoreDebug | null {
    return value && typeof value === "object" ? (value as LearningScoreDebug) : null;
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
                target_distance: undefined,
                wrong_word_distance: undefined,
                margin: 0,
                raw_score: 0,
                calibration: null,
                nearest_words: [],
                scoring_streams: [],
                ignored_streams: [],
                warnings: [],
            },
        },
        scoring: {
            target_word: normalizedWord,
            predicted_word: normalizedWord,
            target_similarity: 0,
            target_percentile: 0,
            target_distance: undefined,
            nearest_wrong_word: "",
            wrong_word_similarity: 0,
            wrong_word_distance: undefined,
            margin: 0,
            nearest_clips: [],
            raw_score: 0,
            calibrated_score: 0,
            calibration: null,
            nearest_words: [],
            manifold_word_count: 0,
            scoring_streams: [],
            ignored_streams: [],
            warnings: [],
        },
        debug: null,
    };
}

export async function translateVideo(videoBlob: Blob, lang: string): Promise<string> {
    const formData = new FormData();
    formData.append("video", videoBlob, getVideoFileName(videoBlob, "recording"));
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
    formData.append("video", videoBlob, getVideoFileName(videoBlob, "recording"));
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

function asLibraryLanguage(value: unknown): LibraryLanguage {
    return asString(value).trim().toUpperCase() === "ASL" ? "ASL" : "TRSL";
}

function asSignLibraryEntry(value: unknown): SignLibraryEntry | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const record = value as Record<string, unknown>;
    const id = asString(record.id).trim();
    const word = asString(record.word).trim();
    const videoUrl = asString(record.video_url).trim();
    if (!id || !word || !videoUrl) {
        return null;
    }

    const classId = asNumber(record.class_id, NaN);
    return {
        id,
        language: asLibraryLanguage(record.language),
        word,
        display_word: asString(record.display_word, word).trim() || word,
        translation: asString(record.translation).trim(),
        class_id: Number.isFinite(classId) ? classId : undefined,
        clip_count: asNumber(record.clip_count, 0),
        video_id: asString(record.video_id).trim(),
        video_url: toAbsoluteApiUrl(videoUrl, API_BASE),
        dataset: asString(record.dataset).trim(),
        source: asString(record.source).trim(),
        split: asString(record.split).trim() || undefined,
    };
}

export async function getSignLibrary(
    language: LibraryLanguage,
    query = "",
): Promise<SignLibraryResponse> {
    const params = new URLSearchParams({ language });
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
        params.set("query", trimmedQuery);
    }

    const res = await fetch(`${API_BASE}/api/library?${params.toString()}`, {
        cache: "no-store",
    });
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Failed to fetch sign library: ${detail}`);
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const counts =
        payload.language_counts && typeof payload.language_counts === "object"
            ? (payload.language_counts as Record<string, unknown>)
            : {};

    const entries = Array.isArray(payload.entries)
        ? payload.entries
              .map(asSignLibraryEntry)
              .filter((entry): entry is SignLibraryEntry => Boolean(entry))
        : [];

    return {
        language_counts: {
            ASL: asNumber(counts.ASL, 0),
            TRSL: asNumber(counts.TRSL, 0),
        },
        total: asNumber(payload.total, entries.length),
        entries,
    };
}

export async function getLearningWords(options: ApiRequestOptions = {}): Promise<string[]> {
    try {
        const res = await fetch(`${LEARNING_API_BASE}/api/learning/words`, {
            headers: getAuthHeaders(options),
        });
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

export async function getLearningHealth(options: ApiRequestOptions = {}): Promise<LearningHealth> {
    try {
        const res = await fetch(`${LEARNING_API_BASE}/api/learning/health`, {
            cache: "no-store",
            headers: getAuthHeaders(options),
        });
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }
        const payload = (await res.json()) as Record<string, unknown>;
        const status = asString(payload.status, "ok").toLowerCase() === "ok" ? "ok" : "error";
        const wordsAvailable = asNumber(payload.words_available, NaN);
        const indexedWords = asNumber(payload.indexed_words, NaN);
        const manifoldWords = asNumber(payload.manifold_words, NaN);
        return {
            status,
            words_available: Number.isFinite(wordsAvailable) ? wordsAvailable : undefined,
            indexed_words: Number.isFinite(indexedWords) ? indexedWords : undefined,
            manifold_words: Number.isFinite(manifoldWords) ? manifoldWords : undefined,
            warnings: asStringList(payload.warnings),
            detail: status === "error" ? asString(payload.detail) || undefined : undefined,
        };
    } catch (error) {
        return {
            status: "error",
            detail: error instanceof Error ? error.message : "Learning API is unavailable.",
        };
    }
}

export async function getLearningNextWord(
    options: ApiRequestOptions = {},
): Promise<LearningWordChallenge> {
    const res = await fetch(`${LEARNING_API_BASE}/api/learning/next`, {
        headers: getAuthHeaders(options),
    });
    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Failed to fetch learning challenge: ${detail}`);
    }
    return parseLearningWordChallenge(await res.json());
}

export async function getLearningWord(
    word: string,
    options: ApiRequestOptions = {},
): Promise<LearningWordChallenge> {
    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) {
        throw new Error("Word is required.");
    }

    try {
        const res = await fetch(
            `${LEARNING_API_BASE}/api/learning/word/${encodeURIComponent(normalizedWord)}`,
            {
                headers: getAuthHeaders(options),
            },
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
    options: ApiRequestOptions = {},
): Promise<LearningScoreResponse> {
    const normalizedWord = word.trim().toLowerCase();
    if (!normalizedWord) {
        throw new Error("Target word is required for scoring.");
    }

    const formData = new FormData();
    formData.append("video", videoBlob, getVideoFileName(videoBlob, "attempt"));
    formData.append("word", normalizedWord);
    formData.append("user_id", userId);
    formData.append("debug", "true");

    const res = await fetch(`${LEARNING_API_BASE}/api/learning/score`, {
        method: "POST",
        headers: getAuthHeaders(options),
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
            predicted_word: asString(scoringRecord.predicted_word) || undefined,
            target_similarity: asNumber(scoringRecord.target_similarity, 0),
            target_percentile: asNumber(scoringRecord.target_percentile, 0),
            target_distance: asOptionalNumber(scoringRecord.target_distance),
            nearest_wrong_word: asString(scoringRecord.nearest_wrong_word),
            wrong_word_similarity: asNumber(scoringRecord.wrong_word_similarity, 0),
            wrong_word_distance: asOptionalNumber(scoringRecord.wrong_word_distance),
            margin: asNumber(scoringRecord.margin, 0),
            nearest_clips: asReferenceClips(scoringRecord.nearest_clips),
            raw_score: asNumber(scoringRecord.raw_score, 0),
            calibrated_score: asNumber(scoringRecord.calibrated_score, 0),
            calibration: asCalibration(scoringRecord.calibration),
            nearest_words: asNearestWords(scoringRecord.nearest_words),
            manifold_word_count: asNumber(scoringRecord.manifold_word_count, 0),
            scoring_streams: asStringList(scoringRecord.scoring_streams),
            ignored_streams: asStringList(scoringRecord.ignored_streams),
            warnings: asStringList(scoringRecord.warnings),
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
                      similarity: asOptionalNumber(confusionRecord.similarity),
                      distance: asOptionalNumber(confusionRecord.distance),
                      warning: asString(confusionRecord.warning),
                  }
                : null,
            nearest_match: nearestMatchRecord
                ? {
                      filename: asString(nearestMatchRecord.filename),
                      similarity: asOptionalNumber(nearestMatchRecord.similarity),
                      distance: asOptionalNumber(nearestMatchRecord.distance),
                  }
                : null,
            target_word: asString(feedbackRecord.target_word, normalizedWord),
            details: {
                target_similarity: asNumber(detailsRecord.target_similarity, 0),
                target_percentile: asNumber(detailsRecord.target_percentile, 0),
                target_distance: asOptionalNumber(detailsRecord.target_distance),
                wrong_word_distance: asOptionalNumber(detailsRecord.wrong_word_distance),
                margin: asNumber(detailsRecord.margin, 0),
                raw_score: asNumber(detailsRecord.raw_score, 0),
                calibration: asCalibration(detailsRecord.calibration),
                nearest_words: asNearestWords(detailsRecord.nearest_words),
                scoring_streams: asStringList(detailsRecord.scoring_streams),
                ignored_streams: asStringList(detailsRecord.ignored_streams),
                warnings: asStringList(detailsRecord.warnings),
            },
        },
        debug: asScoreDebug(payload.debug),
    };
}

export async function confirmLearningAttempt(
    attemptId: string,
    confirmed: boolean,
    userId = "anonymous",
    options: ApiRequestOptions = {},
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
        headers: getAuthHeaders(options),
        body: formData,
    });

    if (!res.ok) {
        const detail = await readErrorDetail(res);
        throw new Error(`Unable to confirm attempt: ${detail}`);
    }
}

export async function getLearningStats(
    userId = "anonymous",
    options: ApiRequestOptions = {},
): Promise<LearningStats> {
    try {
        const params = new URLSearchParams({ user_id: userId });
        const res = await fetch(`${LEARNING_API_BASE}/api/learning/stats?${params.toString()}`, {
            headers: getAuthHeaders(options),
        });
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
