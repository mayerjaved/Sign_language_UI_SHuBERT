"use client";

import { type SyntheticEvent, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    Bug,
    Camera,
    CheckCircle2,
    Flame,
    Gamepad2,
    Gauge,
    Loader2,
    Medal,
    Play,
    RefreshCw,
    Search,
    Shuffle,
    Sparkles,
    Target,
    Trophy,
    XCircle,
    Zap,
} from "lucide-react";
import TrslWordRecorder from "@/components/TrslWordRecorder";
import {
    confirmLearningAttempt,
    getLearningHealth,
    getLearningNextWord,
    getLearningStats,
    getLearningWord,
    getLearningWords,
    type LearningScoreResponse,
    scoreLearningAttempt,
    type LearningWordChallenge,
} from "@/lib/api";
import { TRSL_WORD_PAUSE_SECONDS, TRSL_WORD_RECORDING_SECONDS } from "@/lib/config";

type LearningPhase = "welcome" | "demo" | "recording" | "scoring" | "result";
type AttemptConfirmation = "yes" | "no" | null;
type LearningLanguage = "TRSL" | "ASL" | "PSL";

interface LearningLanguageOption {
    id: LearningLanguage;
    label: string;
    available: boolean;
}

interface WordMastery {
    attempts: number;
    avgScore: number;
    bestScore: number;
}

interface LocalProgress {
    xp: number;
    streak: number;
    combo: number;
    totalAttempts: number;
    bestScore: number;
    lastPracticeDate: string | null;
    wordMastery: Record<string, WordMastery>;
}

const USER_STORAGE_KEY = "slai-learning-user-id-v1";
const PROGRESS_STORAGE_KEY = "slai-learning-progress-v1";
const LEARNING_LANGUAGE_OPTIONS: LearningLanguageOption[] = [
    { id: "TRSL", label: "Turkish Sign Language (TRSL)", available: true },
    { id: "ASL", label: "American Sign Language (ASL)", available: false },
    { id: "PSL", label: "Pakistani Sign Language (PSL)", available: false },
];

const DEFAULT_PROGRESS: LocalProgress = {
    xp: 0,
    streak: 0,
    combo: 0,
    totalAttempts: 0,
    bestScore: 0,
    lastPracticeDate: null,
    wordMastery: {},
};

function toLocalDateStamp(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getRelativeDifficulty(word: string, clipCount: number | undefined): string {
    if (typeof clipCount === "number") {
        if (clipCount >= 30) return "Starter";
        if (clipCount >= 15) return "Intermediate";
        return "Advanced";
    }
    if (word.length <= 4) return "Starter";
    if (word.length <= 7) return "Intermediate";
    return "Advanced";
}

function toPrettyWord(word: string): string {
    if (!word) return "";
    return word
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
        .join(" ");
}

function formatDebugNumber(value: number | undefined | null, digits = 3): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
    return value.toFixed(digits);
}

function formatDebugShape(shape: number[] | undefined): string {
    if (!shape || shape.length === 0) return "n/a";
    return shape.join(" x ");
}

function uniqueMessages(messages: Array<string | undefined>): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const message of messages) {
        const cleaned = (message || "").trim();
        if (!cleaned || seen.has(cleaned)) continue;
        seen.add(cleaned);
        result.push(cleaned);
    }
    return result;
}

function getMediaErrorLabel(code: number | undefined): string {
    if (code === 1) return "MEDIA_ERR_ABORTED";
    if (code === 2) return "MEDIA_ERR_NETWORK";
    if (code === 3) return "MEDIA_ERR_DECODE";
    if (code === 4) return "MEDIA_ERR_SRC_NOT_SUPPORTED";
    return "UNKNOWN_MEDIA_ERR";
}

function fallbackChallenge(word: string): LearningWordChallenge {
    return {
        word,
        reference_video: "/demo/trsl-message.mp4",
        reference_clips: [],
        confusion_words: [],
        word_info: null,
    };
}

export default function LearningHub() {
    const [selectedLanguage, setSelectedLanguage] = useState<LearningLanguage>("TRSL");
    const [phase, setPhase] = useState<LearningPhase>("welcome");
    const [words, setWords] = useState<string[]>([]);
    const [wordSearch, setWordSearch] = useState("");
    const [challenge, setChallenge] = useState<LearningWordChallenge | null>(null);
    const [result, setResult] = useState<LearningScoreResponse | null>(null);
    const [isLoadingWords, setIsLoadingWords] = useState(true);
    const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
    const [isScoring, setIsScoring] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userId, setUserId] = useState("anonymous");
    const [serverAttemptCount, setServerAttemptCount] = useState(0);
    const [serverAverageScore, setServerAverageScore] = useState(0);
    const [learningBackendState, setLearningBackendState] = useState<"checking" | "online" | "offline">(
        "checking",
    );
    const [learningBackendDetail, setLearningBackendDetail] = useState<string | null>(null);
    const [progress, setProgress] = useState<LocalProgress>(DEFAULT_PROGRESS);
    const [attemptVideoUrl, setAttemptVideoUrl] = useState<string | null>(null);
    const [lastRoundXp, setLastRoundXp] = useState(0);
    const [attemptConfirmation, setAttemptConfirmation] = useState<AttemptConfirmation>(null);
    const [referenceVideoSrc, setReferenceVideoSrc] = useState<string | null>(null);
    const [referenceVideoFallbackUsed, setReferenceVideoFallbackUsed] = useState(false);
    const [referenceVideoDebug, setReferenceVideoDebug] = useState<string | null>(null);
    const activeLanguageOption = LEARNING_LANGUAGE_OPTIONS.find(
        (option) => option.id === selectedLanguage,
    )!;
    const isLearningLanguageAvailable = activeLanguageOption.available;

    useEffect(() => {
        if (typeof window === "undefined") return;
        const storedUserId = window.localStorage.getItem(USER_STORAGE_KEY);
        if (storedUserId && storedUserId.trim()) {
            setUserId(storedUserId);
            return;
        }

        const generatedId = `learner-${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(USER_STORAGE_KEY, generatedId);
        setUserId(generatedId);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const rawProgress = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
        if (!rawProgress) return;
        try {
            const parsed = JSON.parse(rawProgress) as LocalProgress;
            if (parsed && typeof parsed === "object") {
                setProgress({
                    ...DEFAULT_PROGRESS,
                    ...parsed,
                    wordMastery: parsed.wordMastery ?? {},
                });
            }
        } catch {
            // Ignore malformed cache and continue with defaults.
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    }, [progress]);

    useEffect(() => {
        let isMounted = true;
        const loadWords = async () => {
            setIsLoadingWords(true);
            const availableWords = await getLearningWords();
            if (isMounted) {
                setWords(availableWords);
                setIsLoadingWords(false);
            }
        };

        void loadWords();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const checkLearningBackend = async () => {
            const health = await getLearningHealth();
            if (!isMounted) return;
            if (health.status === "ok") {
                setLearningBackendState("online");
                const wordLabel =
                    typeof health.words_available === "number"
                        ? `${health.words_available} scoreable / ${health.indexed_words ?? "?"} indexed`
                        : null;
                const manifoldLabel =
                    typeof health.manifold_words === "number"
                        ? `${health.manifold_words} in manifold`
                        : null;
                const warningLabel = health.warnings?.[0];
                setLearningBackendDetail(
                    [wordLabel, manifoldLabel, warningLabel].filter(Boolean).join(" / ") || null,
                );
            } else {
                setLearningBackendState("offline");
                setLearningBackendDetail(health.detail ?? "Learning backend is unavailable.");
            }
        };

        void checkLearningBackend();
        const intervalId = window.setInterval(() => {
            void checkLearningBackend();
        }, 30000);

        return () => {
            isMounted = false;
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        const loadStats = async () => {
            const stats = await getLearningStats(userId);
            if (!isMounted) return;
            setServerAttemptCount(stats.total_attempts);
            setServerAverageScore(stats.avg_score);
        };

        if (userId) {
            void loadStats();
        }

        return () => {
            isMounted = false;
        };
    }, [userId]);

    useEffect(() => {
        return () => {
            if (attemptVideoUrl) {
                URL.revokeObjectURL(attemptVideoUrl);
            }
        };
    }, [attemptVideoUrl]);

    useEffect(() => {
        if (!challenge?.reference_video) {
            setReferenceVideoSrc(null);
            setReferenceVideoFallbackUsed(false);
            setReferenceVideoDebug(null);
            return;
        }
        setReferenceVideoSrc(challenge.reference_video);
        setReferenceVideoFallbackUsed(false);
        setReferenceVideoDebug(null);
    }, [challenge]);

    const filteredWords = useMemo(() => {
        const query = wordSearch.trim().toLowerCase();
        if (!query) {
            return words.slice(0, 120);
        }
        return words.filter((word) => word.includes(query)).slice(0, 120);
    }, [wordSearch, words]);

    const currentWordMastery = useMemo(() => {
        if (!challenge) return null;
        return progress.wordMastery[challenge.word] ?? null;
    }, [challenge, progress.wordMastery]);

    const masteredWordCount = useMemo(
        () =>
            Object.values(progress.wordMastery).filter(
                (entry) => entry.attempts >= 3 && entry.avgScore >= 85,
            ).length,
        [progress.wordMastery],
    );

    const recommendedWords = useMemo(() => {
        const entries = Object.entries(progress.wordMastery)
            .filter(([, entry]) => entry.attempts >= 1)
            .sort((a, b) => a[1].avgScore - b[1].avgScore)
            .slice(0, 4)
            .map(([word]) => word);

        if (entries.length >= 4) return entries;
        const fill = words.filter((word) => !entries.includes(word)).slice(0, 4 - entries.length);
        return [...entries, ...fill];
    }, [progress.wordMastery, words]);

    const runChallengeTransition = (nextChallenge: LearningWordChallenge) => {
        setChallenge(nextChallenge);
        setResult(null);
        setAttemptConfirmation(null);
        setLastRoundXp(0);
        setErrorMessage(null);
        setPhase("demo");
    };

    const handleReferenceVideoLoaded = () => {
        setReferenceVideoDebug(null);
    };

    const handleReferenceVideoError = (event: SyntheticEvent<HTMLVideoElement, Event>) => {
        const videoElement = event.currentTarget;
        const errorCode = videoElement.error?.code;
        const attemptedSrc = videoElement.currentSrc || referenceVideoSrc || "unknown";
        const debugText = `src=${attemptedSrc} error=${getMediaErrorLabel(
            errorCode,
        )} networkState=${videoElement.networkState} readyState=${videoElement.readyState}`;
        setReferenceVideoDebug(debugText);
        console.error("[Learning] Reference video failed to load.", {
            attemptedSrc,
            errorCode,
            errorLabel: getMediaErrorLabel(errorCode),
            networkState: videoElement.networkState,
            readyState: videoElement.readyState,
        });

        if (referenceVideoSrc === "/demo/trsl-message.mp4") {
            setErrorMessage(
                "Reference clip could not be loaded. Please start a new round. See Video debug details below.",
            );
            return;
        }
        setReferenceVideoSrc("/demo/trsl-message.mp4");
        setReferenceVideoFallbackUsed(true);
        setErrorMessage("Reference stream was unavailable. Showing fallback demo clip.");
    };

    const handleRandomChallenge = async () => {
        if (!isLearningLanguageAvailable) {
            setErrorMessage(
                `${activeLanguageOption.label} is coming soon. Please switch to TRSL for now.`,
            );
            return;
        }
        setIsLoadingChallenge(true);
        setErrorMessage(null);
        try {
            const next = await getLearningNextWord();
            runChallengeTransition(next);
        } catch (error) {
            const fallbackWord =
                words[Math.floor(Math.random() * Math.max(words.length, 1))] || "hello";
            runChallengeTransition(fallbackChallenge(fallbackWord));
            const detail =
                error instanceof Error
                    ? error.message
                    : "Learning backend is unavailable. Falling back to demo mode.";
            setErrorMessage(detail);
        } finally {
            setIsLoadingChallenge(false);
        }
    };

    const handleWordSelect = async (word: string) => {
        if (!isLearningLanguageAvailable) {
            setErrorMessage(
                `${activeLanguageOption.label} is coming soon. Please switch to TRSL for now.`,
            );
            return;
        }
        setIsLoadingChallenge(true);
        setErrorMessage(null);
        try {
            const detail = await getLearningWord(word);
            runChallengeTransition(detail);
        } catch {
            runChallengeTransition(fallbackChallenge(word));
        } finally {
            setIsLoadingChallenge(false);
        }
    };

    const applyProgressUpdate = (word: string, score: number) => {
        const normalizedWord = word.trim().toLowerCase();
        let gainedXp = 0;
        setProgress((previous) => {
            const today = toLocalDateStamp(new Date());
            const yesterday = toLocalDateStamp(new Date(Date.now() - 24 * 60 * 60 * 1000));

            let nextStreak = previous.streak;
            if (previous.lastPracticeDate === today) {
                nextStreak = Math.max(1, previous.streak);
            } else if (previous.lastPracticeDate === yesterday) {
                nextStreak = previous.streak + 1;
            } else {
                nextStreak = 1;
            }

            const nextCombo =
                score >= 75 ? previous.combo + 1 : score >= 55 ? Math.max(previous.combo, 1) : 0;
            gainedXp = 18 + Math.round(score * 0.55) + Math.min(10, nextCombo) * 2;

            const existingWord = previous.wordMastery[normalizedWord] ?? {
                attempts: 0,
                avgScore: 0,
                bestScore: 0,
            };
            const attempts = existingWord.attempts + 1;
            const avgScore =
                (existingWord.avgScore * existingWord.attempts + score) / Math.max(attempts, 1);
            const bestScore = Math.max(existingWord.bestScore, score);

            return {
                xp: previous.xp + gainedXp,
                streak: nextStreak,
                combo: nextCombo,
                totalAttempts: previous.totalAttempts + 1,
                bestScore: Math.max(previous.bestScore, score),
                lastPracticeDate: today,
                wordMastery: {
                    ...previous.wordMastery,
                    [normalizedWord]: {
                        attempts,
                        avgScore: Number(avgScore.toFixed(1)),
                        bestScore,
                    },
                },
            };
        });
        setLastRoundXp(gainedXp);
    };

    const handleCaptureComplete = async (wordClips: Blob[]) => {
        if (!isLearningLanguageAvailable) {
            setErrorMessage(
                `${activeLanguageOption.label} is coming soon. Please switch to TRSL for now.`,
            );
            setPhase("demo");
            return;
        }
        if (!challenge || wordClips.length === 0) {
            setPhase("demo");
            return;
        }

        const clip = wordClips[0];
        if (!clip) {
            setPhase("demo");
            return;
        }

        setAttemptConfirmation(null);
        setErrorMessage(null);
        setIsScoring(true);
        setPhase("scoring");

        setAttemptVideoUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(clip);
        });

        try {
            const scoreResponse = await scoreLearningAttempt(clip, challenge.word, userId);
            setResult(scoreResponse);
            applyProgressUpdate(challenge.word, scoreResponse.feedback.score);
            setPhase("result");

            const freshStats = await getLearningStats(userId);
            setServerAttemptCount(freshStats.total_attempts);
            setServerAverageScore(freshStats.avg_score);
        } catch (error) {
            const detail =
                error instanceof Error
                    ? error.message
                    : "Unable to score this attempt right now. Please retry.";
            setErrorMessage(detail);
            setPhase("demo");
        } finally {
            setIsScoring(false);
        }
    };

    const handleAttemptConfirmation = async (confirmed: boolean) => {
        if (!result?.attempt_id || isConfirming) return;
        setIsConfirming(true);
        try {
            await confirmLearningAttempt(result.attempt_id, confirmed, userId);
            setAttemptConfirmation(confirmed ? "yes" : "no");
        } catch (error) {
            const detail =
                error instanceof Error
                    ? error.message
                    : "Could not save your confirmation. You can continue practicing.";
            setErrorMessage(detail);
        } finally {
            setIsConfirming(false);
        }
    };

    const currentScore = result ? Math.round(result.feedback.score) : 0;
    const scoreToneClass =
        currentScore >= 90
            ? "from-emerald-400 via-lime-300 to-teal-300"
            : currentScore >= 75
              ? "from-cyan-400 via-sky-300 to-blue-300"
              : currentScore >= 55
                ? "from-amber-300 via-yellow-300 to-orange-300"
                : "from-rose-300 via-red-300 to-orange-300";
    const debugWarnings = result
        ? uniqueMessages([
              ...(result.debug?.warnings ?? []),
              ...(result.scoring.warnings ?? []),
              ...(result.feedback.details.warnings ?? []),
          ])
        : [];
    const debugCalibration =
        result?.debug?.scoring?.calibration ??
        result?.scoring.calibration ??
        result?.feedback.details.calibration ??
        null;
    const debugNearestWords =
        result?.debug?.scoring?.nearest_words ??
        result?.scoring.nearest_words ??
        result?.feedback.details.nearest_words ??
        [];
    const debugFeatureEntries = Object.entries(result?.debug?.features ?? {});
    const debugManifold = result?.debug?.backend?.manifold;
    const debugVideo = result?.debug?.video;
    const debugSequence = result?.debug?.sequence;
    const debugManifoldWordCount =
        typeof debugManifold?.word_count === "number" ? debugManifold.word_count : undefined;
    const debugManifoldTotalClips =
        typeof debugManifold?.total_clips === "number" ? debugManifold.total_clips : undefined;

    return (
        <div className="mx-auto w-full max-w-6xl space-y-5 animate-rise">
            <section className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[conic-gradient(from_110deg_at_50%_40%,rgba(45,212,191,0.25),rgba(56,189,248,0.19),rgba(251,191,36,0.24),rgba(45,212,191,0.22))] p-5 shadow-[0_34px_90px_-54px_rgba(15,23,42,0.5)] md:p-7">
                <div className="pointer-events-none absolute -left-24 top-8 h-44 w-44 rounded-full bg-teal-300/20 blur-3xl" />
                <div className="pointer-events-none absolute -right-16 bottom-0 h-52 w-52 rounded-full bg-amber-200/25 blur-3xl" />

                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <p className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                            <Gamepad2 className="h-3.5 w-3.5" />
                            Learning Arena
                        </p>
                        <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-900 md:text-[2.1rem]">
                            Warm up, mimic the sign, and chase your high score.
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm text-slate-700 md:text-base">
                            Each round is one quick TRSL gesture: watch a reference, record your
                            attempt, get instant scoring, and stack XP with streaks.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                        <label className="flex min-w-[220px] flex-col gap-1 rounded-2xl border border-slate-900/10 bg-white/70 px-3 py-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                                Learning Language
                            </span>
                            <select
                                value={selectedLanguage}
                                onChange={(event) => {
                                    setSelectedLanguage(event.target.value as LearningLanguage);
                                    setErrorMessage(null);
                                }}
                                className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
                            >
                                {LEARNING_LANGUAGE_OPTIONS.map((option) => (
                                    <option
                                        key={option.id}
                                        value={option.id}
                                        disabled={!option.available}
                                    >
                                        {option.label}
                                        {option.available ? "" : " (Coming soon)"}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            onClick={() => void handleRandomChallenge()}
                            disabled={isLoadingChallenge || !isLearningLanguageAvailable}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                        >
                            {isLoadingChallenge ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading
                                </>
                            ) : (
                                <>
                                    <Shuffle className="h-4 w-4" />
                                    Start Random Round
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setPhase("welcome")}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-900/20 bg-white/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-800 transition-all hover:bg-white"
                        >
                            <Sparkles className="h-4 w-4" />
                            Warmup
                        </button>
                    </div>
                </div>

                <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-white/65 bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">XP</p>
                        <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                            <Zap className="h-4 w-4 text-amber-500" />
                            {progress.xp}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/65 bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Streak</p>
                        <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                            <Flame className="h-4 w-4 text-orange-500" />
                            {progress.streak} day{progress.streak === 1 ? "" : "s"}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/65 bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Combo</p>
                        <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                            <Gauge className="h-4 w-4 text-cyan-500" />
                            x{Math.max(1, progress.combo)}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/65 bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            Mastered Words
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
                            <Trophy className="h-4 w-4 text-emerald-500" />
                            {masteredWordCount}
                        </p>
                    </div>
                </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[1.45fr_0.95fr]">
                <section className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-5 shadow-[0_32px_86px_-62px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Live Session
                            </p>
                            <p className="mt-1 text-base font-semibold text-[color:var(--ink)]">
                                {challenge ? `Target Word: ${toPrettyWord(challenge.word)}` : "Pick a word to begin"}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--muted)]">
                                Language: {activeLanguageOption.id}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--muted)]">
                                Engine:{" "}
                                <span
                                    className={
                                        learningBackendState === "online"
                                            ? "font-semibold text-emerald-600"
                                            : learningBackendState === "checking"
                                              ? "font-semibold text-amber-600"
                                              : "font-semibold text-rose-600"
                                    }
                                >
                                    {learningBackendState === "online"
                                        ? "Online"
                                        : learningBackendState === "checking"
                                          ? "Checking..."
                                          : "Offline"}
                                </span>
                            </p>
                        </div>
                        {challenge && (
                            <span className="rounded-full border border-cyan-200/75 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                                {getRelativeDifficulty(
                                    challenge.word,
                                    typeof challenge.word_info?.clip_count === "number"
                                        ? challenge.word_info.clip_count
                                        : undefined,
                                )}
                            </span>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                        <span
                            className={`rounded-full px-3 py-1 ${
                                phase === "demo"
                                    ? "bg-slate-900 text-white"
                                    : "bg-[color:var(--surface-soft)]"
                            }`}
                        >
                            Demo
                        </span>
                        <span
                            className={`rounded-full px-3 py-1 ${
                                phase === "recording"
                                    ? "bg-slate-900 text-white"
                                    : "bg-[color:var(--surface-soft)]"
                            }`}
                        >
                            Record
                        </span>
                        <span
                            className={`rounded-full px-3 py-1 ${
                                phase === "scoring" || phase === "result"
                                    ? "bg-slate-900 text-white"
                                    : "bg-[color:var(--surface-soft)]"
                            }`}
                        >
                            Reveal
                        </span>
                    </div>

                    {errorMessage && (
                        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {errorMessage}
                        </p>
                    )}
                    {referenceVideoDebug && (
                        <p className="mt-3 break-all rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs text-amber-900">
                            Video debug: {referenceVideoDebug}
                        </p>
                    )}
                    {learningBackendState !== "online" && (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Learning backend is not fully reachable. Video and scoring may fail.
                            {learningBackendDetail ? ` (${learningBackendDetail})` : ""}
                        </p>
                    )}

                    {phase === "welcome" && (
                        <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.12),_rgba(248,250,252,1)_62%)] p-5 md:p-6">
                            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                                <Target className="h-3.5 w-3.5" />
                                One-minute challenge
                            </p>
                            <h3 className="mt-3 text-2xl font-semibold text-slate-900">
                                Train your signing reflex with short rounds.
                            </h3>
                            <p className="mt-2 text-sm text-slate-700">
                                We score each attempt from 0-100 and give immediate hints so you can
                                retry fast and watch your score rise.
                            </p>
                            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                                    1. Watch the reference clip.
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                                    2. Record a single-word sign.
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
                                    3. Reveal score, XP, and coaching tips.
                                </div>
                            </div>
                            <button
                                onClick={() => void handleRandomChallenge()}
                                disabled={isLoadingChallenge || !isLearningLanguageAvailable}
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                            >
                                <Play className="h-4 w-4" />
                                Jump Into a Round
                            </button>
                        </div>
                    )}

                    {isLoadingChallenge && phase !== "welcome" && (
                        <div className="mt-5 flex min-h-[280px] items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                            <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted)]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Preparing your next word challenge...
                            </div>
                        </div>
                    )}

                    {challenge && !isLoadingChallenge && phase === "demo" && (
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-[color:var(--border)] bg-slate-950/95 p-4 text-white">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">
                                            Reference Stage
                                        </p>
                                        <p className="mt-1 text-2xl font-semibold">
                                            {toPrettyWord(challenge.word)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPhase("recording")}
                                        className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-white/25"
                                    >
                                        <Camera className="h-4 w-4" />
                                        Start Recording
                                    </button>
                                </div>

                                {referenceVideoSrc && (
                                    <video
                                        src={referenceVideoSrc}
                                        controls
                                        playsInline
                                        onLoadedData={handleReferenceVideoLoaded}
                                        onError={handleReferenceVideoError}
                                        className="mt-3 w-full rounded-xl border border-white/20"
                                    />
                                )}
                                {referenceVideoFallbackUsed && (
                                    <p className="mt-2 text-xs text-cyan-100">
                                        Fallback demo clip is shown because live reference streaming failed.
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                        Alternate Clips
                                    </p>
                                    <div className="mt-2 text-sm text-[color:var(--ink)]">
                                        {challenge.reference_clips.length > 0 ? (
                                            <p>
                                                {challenge.reference_clips.length} reference variations are available
                                                for this word.
                                            </p>
                                        ) : (
                                            <span className="text-sm text-[color:var(--muted)]">
                                                Demo clip loaded. Backend references can appear here.
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                        Watch Out For
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {challenge.confusion_words.length > 0 ? (
                                            challenge.confusion_words.map((item) => (
                                                <span
                                                    key={item.word}
                                                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                                                >
                                                    {toPrettyWord(item.word)}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm text-[color:var(--muted)]">
                                                Stay centered and keep movements clear.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {phase === "recording" && challenge && (
                        <div className="mt-5 space-y-3">
                            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                Record one clean sign for <strong>{toPrettyWord(challenge.word)}</strong>.
                                The recorder auto-captures and sends it for scoring.
                            </p>
                            <TrslWordRecorder
                                inline
                                maxWords={1}
                                recordSeconds={TRSL_WORD_RECORDING_SECONDS}
                                pauseSeconds={TRSL_WORD_PAUSE_SECONDS}
                                onComplete={handleCaptureComplete}
                                onCancel={() => setPhase("demo")}
                            />
                        </div>
                    )}

                    {(phase === "scoring" || isScoring) && (
                        <div className="mt-5 flex min-h-[280px] items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.16),_rgba(248,250,252,1)_60%)] p-6">
                            <div className="text-center">
                                <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-600" />
                                <p className="mt-3 text-base font-semibold text-slate-900">
                                    Scoring your gesture...
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                    Matching your attempt against known TRSL clips.
                                </p>
                            </div>
                        </div>
                    )}

                    {phase === "result" && challenge && result && (
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                                            Score Reveal
                                        </p>
                                        <p className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">
                                            {result.feedback.grade.grade}
                                        </p>
                                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                                            {result.feedback.grade.message}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`h-20 w-20 rounded-full bg-gradient-to-br ${scoreToneClass} p-[2px]`}
                                        >
                                            <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-bold text-slate-900">
                                                {currentScore}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-700">
                                            <p className="font-semibold text-slate-900">
                                                +{lastRoundXp} XP
                                            </p>
                                            <p>Best: {progress.bestScore}</p>
                                            <p>Total attempts: {progress.totalAttempts}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${scoreToneClass} transition-all duration-700`}
                                        style={{ width: `${Math.max(0, Math.min(100, currentScore))}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                        Coaching Hints
                                    </p>
                                    <div className="mt-2 space-y-2 text-sm text-[color:var(--ink)]">
                                        {result.feedback.hints.map((hint, index) => (
                                            <p key={`${index}-${hint}`}>- {hint}</p>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                        Attempt Confirm
                                    </p>
                                    <p className="mt-2 text-sm text-[color:var(--ink)]">
                                        Was this the word you meant to sign?
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            onClick={() => void handleAttemptConfirmation(true)}
                                            disabled={isConfirming || attemptConfirmation !== null}
                                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 disabled:opacity-45"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Yes
                                        </button>
                                        <button
                                            onClick={() => void handleAttemptConfirmation(false)}
                                            disabled={isConfirming || attemptConfirmation !== null}
                                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-45"
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                            No
                                        </button>
                                    </div>
                                    {attemptConfirmation && (
                                        <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
                                            Saved: {attemptConfirmation === "yes" ? "Confirmed" : "Marked as mismatch"}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {result.debug && (
                                <div className="rounded-xl border border-cyan-200 bg-cyan-50/75 p-3 text-sm text-slate-800">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                                            <Bug className="h-4 w-4" />
                                            Backend Debug
                                        </p>
                                        <span className="font-mono text-[11px] text-cyan-900">
                                            {result.debug.request_id ?? result.attempt_id}
                                        </span>
                                    </div>

                                    {debugWarnings.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {debugWarnings.map((warning) => (
                                                <p
                                                    key={warning}
                                                    className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900"
                                                >
                                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                                                    <span>{warning}</span>
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                                        <div className="rounded-lg border border-cyan-100 bg-white/75 p-2">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                                                Video
                                            </p>
                                            <p className="mt-1 font-mono text-xs">
                                                {debugVideo?.frame_count ?? "n/a"} frames
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-500">
                                                {debugVideo?.width ?? "?"}x{debugVideo?.height ?? "?"}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-cyan-100 bg-white/75 p-2">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                                                Sequence
                                            </p>
                                            <p className="mt-1 font-mono text-xs">
                                                {formatDebugShape(debugSequence?.shape)}
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-500">
                                                norm {formatDebugNumber(debugSequence?.norm_mean, 1)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-cyan-100 bg-white/75 p-2">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                                                Calibration
                                            </p>
                                            <p className="mt-1 font-mono text-xs">
                                                {debugCalibration?.source ?? "n/a"}
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-500">
                                                raw {formatDebugNumber(debugCalibration?.raw_min, 3)}-
                                                {formatDebugNumber(debugCalibration?.raw_max, 3)}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-cyan-100 bg-white/75 p-2">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                                                Manifold
                                            </p>
                                            <p className="mt-1 font-mono text-xs">
                                                {debugManifoldWordCount ?? "n/a"} words
                                            </p>
                                            <p className="font-mono text-[11px] text-slate-500">
                                                {debugManifoldTotalClips ?? "n/a"} clips
                                            </p>
                                        </div>
                                    </div>

                                    {debugNearestWords.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                Nearest Words
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {debugNearestWords.map((entry) => (
                                                    <span
                                                        key={`${entry.word}-${entry.role ?? "word"}`}
                                                        className="rounded-full border border-cyan-100 bg-white/80 px-2 py-1 font-mono text-xs text-slate-700"
                                                    >
                                                        {toPrettyWord(entry.word)}:{" "}
                                                        {formatDebugNumber(entry.distance, 4)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {debugFeatureEntries.length > 0 && (
                                        <details className="mt-3">
                                            <summary className="cursor-pointer text-xs font-semibold text-cyan-900">
                                                Feature streams
                                            </summary>
                                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                {debugFeatureEntries.map(([name, metric]) => (
                                                    <div
                                                        key={name}
                                                        className="rounded-lg border border-cyan-100 bg-white/75 p-2"
                                                    >
                                                        <p className="font-mono text-xs text-slate-800">
                                                            {name}
                                                        </p>
                                                        <p className="font-mono text-[11px] text-slate-500">
                                                            {formatDebugShape(metric.shape)} / finite{" "}
                                                            {formatDebugNumber(metric.finite_ratio, 3)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-3 md:grid-cols-2">
                                {referenceVideoSrc && (
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                                            Reference
                                        </p>
                                        <video
                                            src={referenceVideoSrc}
                                            controls
                                            playsInline
                                            onLoadedData={handleReferenceVideoLoaded}
                                            onError={handleReferenceVideoError}
                                            className="w-full rounded-xl border border-[color:var(--border)]"
                                        />
                                    </div>
                                )}
                                {attemptVideoUrl && (
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                                            Your Attempt
                                        </p>
                                        <video
                                            src={attemptVideoUrl}
                                            controls
                                            className="w-full rounded-xl border border-[color:var(--border)]"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        setResult(null);
                                        setAttemptConfirmation(null);
                                        setPhase("recording");
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-all hover:bg-[color:var(--surface-soft)]"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Retry Word
                                </button>
                                <button
                                    onClick={() => void handleRandomChallenge()}
                                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800"
                                >
                                    Next Word
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                <aside className="space-y-4">
                    <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-4 shadow-[0_26px_70px_-54px_rgba(15,23,42,0.5)] backdrop-blur-xl">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Progress
                            </p>
                            <Medal className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-[color:var(--ink)]">
                            <p className="flex items-center justify-between">
                                <span>Local attempts</span>
                                <strong>{progress.totalAttempts}</strong>
                            </p>
                            <p className="flex items-center justify-between">
                                <span>Server attempts</span>
                                <strong>{serverAttemptCount}</strong>
                            </p>
                            <p className="flex items-center justify-between">
                                <span>Average score</span>
                                <strong>{serverAverageScore.toFixed(1)}</strong>
                            </p>
                            <p className="flex items-center justify-between">
                                <span>Current streak</span>
                                <strong>{progress.streak}</strong>
                            </p>
                        </div>

                        {currentWordMastery && challenge && (
                            <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                    Current Word Mastery
                                </p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                                    {toPrettyWord(challenge.word)}
                                </p>
                                <p className="mt-2 text-xs text-[color:var(--muted)]">
                                    Attempts: {currentWordMastery.attempts} | Avg:{" "}
                                    {currentWordMastery.avgScore.toFixed(1)} | Best:{" "}
                                    {currentWordMastery.bestScore}
                                </p>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-700"
                                        style={{
                                            width: `${Math.max(
                                                0,
                                                Math.min(100, currentWordMastery.avgScore),
                                            )}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-4 shadow-[0_26px_70px_-54px_rgba(15,23,42,0.5)] backdrop-blur-xl">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Word Deck
                        </p>
                        <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
                            <div className="flex items-center gap-2 text-[color:var(--muted)]">
                                <Search className="h-4 w-4" />
                                <input
                                    value={wordSearch}
                                    onChange={(event) => setWordSearch(event.target.value)}
                                    placeholder="Search words"
                                    className="w-full bg-transparent text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--muted)]"
                                />
                            </div>
                        </div>

                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                            {isLoadingWords ? (
                                <p className="text-sm text-[color:var(--muted)]">
                                    Loading practice words...
                                </p>
                            ) : filteredWords.length === 0 ? (
                                <p className="text-sm text-[color:var(--muted)]">
                                    No words found for that search.
                                </p>
                            ) : (
                                filteredWords.map((word) => {
                                    const mastery = progress.wordMastery[word];
                                    const masteryPercent = mastery
                                        ? Math.min(100, Math.round(mastery.avgScore))
                                        : 0;
                                    const isActive = challenge?.word === word;
                                    return (
                                        <button
                                            key={word}
                                            onClick={() => void handleWordSelect(word)}
                                            className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                                                isActive
                                                    ? "border-cyan-300 bg-cyan-50"
                                                    : "border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-soft)]"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-[color:var(--ink)]">
                                                    {toPrettyWord(word)}
                                                </p>
                                                <span className="text-xs text-[color:var(--muted)]">
                                                    {masteryPercent}%
                                                </span>
                                            </div>
                                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-500"
                                                    style={{ width: `${masteryPercent}%` }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-glass)] p-4 shadow-[0_26px_70px_-54px_rgba(15,23,42,0.5)] backdrop-blur-xl">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Quick Picks
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {recommendedWords.map((word) => (
                                <button
                                    key={word}
                                    onClick={() => void handleWordSelect(word)}
                                    disabled={!isLearningLanguageAvailable}
                                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {toPrettyWord(word)}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
