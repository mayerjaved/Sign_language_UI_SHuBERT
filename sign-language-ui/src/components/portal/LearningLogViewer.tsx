"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getLearningScoreEvents, type LearningScoreLogEvent, type LearningScoreLogSubscore } from "@/lib/api";
import { PortalShell } from "@/components/portal/GestureBridgePortal";

const channelOrder = [
  "left_movement",
  "right_movement",
  "left_handshape",
  "right_handshape",
  "movement",
  "handshape",
];

function formatScore(score?: number | null) {
  return typeof score === "number" && Number.isFinite(score) ? score.toFixed(1) : "n/a";
}

function formatDistance(distance?: number | null) {
  return typeof distance === "number" && Number.isFinite(distance) ? distance.toFixed(4) : "n/a";
}

function formatBytes(bytes?: number | null) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function scoreTone(score?: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "border-[#c9d6e2] bg-[#edf3f8] text-[#50627a]";
  }
  if (score <= 0) return "border-[#fecaca] bg-[#fff1f2] text-[#b91c1c]";
  if (score < 55) return "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]";
  if (score < 75) return "border-[#fde68a] bg-[#fffbeb] text-[#a16207]";
  return "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]";
}

function eventTone(event?: LearningScoreLogEvent) {
  const eventName = (event?.event ?? "").toLowerCase();
  const status = event?.status_code ?? 0;
  if (eventName.includes("error") || status >= 400 || event?.error) {
    return {
      icon: XCircle,
      label: "Error",
      className: "border-[#fecaca] bg-[#fff1f2] text-[#b91c1c]",
    };
  }
  if (event?.skip_reason || event?.scoring?.skipped) {
    return {
      icon: AlertTriangle,
      label: "Skipped",
      className: "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
    };
  }
  return {
    icon: CheckCircle2,
    label: "Scored",
    className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  };
}

function compactId(value?: string | null) {
  if (!value) return "n/a";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function labelizeChannel(name: string) {
  return name.replace(/_/g, " ");
}

function orderedSubscores(subscores?: Record<string, LearningScoreLogSubscore>) {
  if (!subscores) return [];
  const preferred = channelOrder
    .filter((name) => subscores[name])
    .map((name) => [name, subscores[name]] as const);
  const extra = Object.entries(subscores).filter(([name]) => !channelOrder.includes(name));
  return [...preferred, ...extra];
}

function ChannelBadge({ name, subscore }: { name: string; subscore: LearningScoreLogSubscore }) {
  const available = subscore.available !== false;
  const passed = subscore.pass === true;
  const failed = subscore.pass === false;
  const score = typeof subscore.score === "number" ? Math.max(0, Math.min(100, subscore.score)) : null;
  const statusClass = !available
    ? "border-[#c9d6e2] bg-[#f8fafc] text-[#64748b]"
    : passed
      ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
      : failed
        ? "border-[#fecaca] bg-[#fff1f2] text-[#b91c1c]"
        : "border-[#d9e2ec] bg-white text-[#334155]";

  return (
    <div className={`rounded-lg border p-3 ${statusClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase">{labelizeChannel(name)}</p>
          <p className="mt-1 text-xs">
            {available ? `distance ${formatDistance(subscore.distance)}` : subscore.reason ?? "unavailable"}
          </p>
        </div>
        <span className="text-sm font-black">{formatScore(subscore.score)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full ${passed ? "bg-[#22c55e]" : failed ? "bg-[#ef4444]" : "bg-[#94a3b8]"}`}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
      {subscore.reason && <p className="mt-2 text-xs font-semibold">{subscore.reason}</p>}
    </div>
  );
}

function EventCard({
  event,
  expanded,
  onToggle,
}: {
  event: LearningScoreLogEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = eventTone(event);
  const StatusIcon = tone.icon;
  const subscoreEntries = orderedSubscores(event.scoring?.subscores);
  const scorerLabel = event.scoring?.scorer_version ?? event.scoring?.scoring_mode ?? "unknown scorer";
  const filename = event.request?.filename ?? event.request?.features_path ?? "no file recorded";
  const hash = event.request?.uploaded_sha256;

  const copyText = async (text?: string | null) => {
    if (!text || typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(text);
  };

  const copyRequestId = () => copyText(event.request_id ?? event.attempt_id);
  const copyAttemptId = () => copyText(event.attempt_id);
  const copyVideoHash = () => copyText(hash);
  const copyEventJson = () => copyText(JSON.stringify(event, null, 2));

  return (
    <article className="select-text rounded-lg border border-[#d9e2ec] bg-white shadow-sm">
      <div className="flex w-full flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${tone.className}`}>
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {tone.label}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${scoreTone(event.score)}`}>
              Score {formatScore(event.score)}
            </span>
            <span className="rounded-full bg-[#edf3f8] px-2.5 py-1 text-xs font-bold text-[#29425f]">
              {event.language ?? "n/a"}
            </span>
            <span className="text-xs font-semibold text-[#64748b]">{formatDate(event.timestamp_iso)}</span>
          </div>
          <h2 className="mt-3 text-xl font-black text-[#102033]">
            {event.target_word ?? "unknown word"}
          </h2>
          <div className="mt-2 grid gap-2 text-sm text-[#50627a] md:grid-cols-2 xl:grid-cols-4">
            <p>
              <span className="font-bold text-[#102033]">User:</span> {compactId(event.user_id)}
            </p>
            <p>
              <span className="font-bold text-[#102033]">Attempt:</span> {compactId(event.attempt_id)}
            </p>
            <p>
              <span className="font-bold text-[#102033]">Target dist:</span>{" "}
              {formatDistance(event.scoring?.target_distance ?? event.target_distance)}
            </p>
            <p>
              <span className="font-bold text-[#102033]">Scorer:</span> {scorerLabel}
            </p>
          </div>
          <div className="mt-2 min-w-0 text-sm text-[#50627a]">
            <span className="font-bold text-[#102033]">Video:</span>{" "}
            <span className="break-all">{filename}</span>
            {hash && <span className="ml-2 font-mono text-xs text-[#64748b]">sha {compactId(hash)}</span>}
            {typeof event.request?.uploaded_size_bytes === "number" && (
              <span className="ml-2 text-xs font-semibold">{formatBytes(event.request.uploaded_size_bytes)}</span>
            )}
          </div>
          {(event.error || event.skip_reason || event.warnings?.length) && (
            <div className="mt-3 space-y-1 text-sm">
              {event.error && <p className="font-bold text-[#b91c1c]">Error: {event.error}</p>}
              {event.skip_reason && <p className="font-bold text-[#c2410c]">Skip: {event.skip_reason}</p>}
              {event.warnings?.map((warning) => (
                <p key={warning} className="font-semibold text-[#a16207]">
                  Warning: {warning}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-lg bg-[#edf3f8] px-3 py-2 font-mono text-xs font-bold text-[#29425f]">
            {compactId(event.request_id)}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="select-none rounded-lg border border-[#c9d6e2] bg-white p-2 text-[#29425f] transition hover:bg-[#edf3f8] focus:outline-none focus:ring-4 focus:ring-[#2563eb]/10"
            title={expanded ? "Collapse event details" : "Expand event details"}
          >
            {expanded ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#e3ebf3] p-4">
          {subscoreEntries.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {subscoreEntries.map(([name, subscore]) => (
                <ChannelBadge key={name} name={name} subscore={subscore} />
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 text-sm text-[#50627a] md:grid-cols-2 xl:grid-cols-4">
            <p>
              <span className="font-bold text-[#102033]">Reference:</span>{" "}
              {event.scoring?.reference_clip ?? String(event.reference?.resolved_clip ?? "n/a")}
            </p>
            <p>
              <span className="font-bold text-[#102033]">Reference dist:</span>{" "}
              {formatDistance(event.scoring?.reference_clip_distance)}
            </p>
            <p>
              <span className="font-bold text-[#102033]">Frames:</span>{" "}
              {event.video?.frame_count ?? "n/a"}
            </p>
            <p>
              <span className="font-bold text-[#102033]">Total time:</span>{" "}
              {formatDistance(event.timings_ms?.save_attempt)} ms
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyRequestId}
              className="inline-flex select-none items-center gap-2 rounded-lg border border-[#c9d6e2] bg-white px-3 py-2 text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
            >
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Copy request id
            </button>
            {event.attempt_id && (
              <button
                type="button"
                onClick={copyAttemptId}
                className="inline-flex select-none items-center gap-2 rounded-lg border border-[#c9d6e2] bg-white px-3 py-2 text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
              >
                <Clipboard className="h-4 w-4" aria-hidden="true" />
                Copy attempt id
              </button>
            )}
            {hash && (
              <button
                type="button"
                onClick={copyVideoHash}
                className="inline-flex select-none items-center gap-2 rounded-lg border border-[#c9d6e2] bg-white px-3 py-2 text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
              >
                <Clipboard className="h-4 w-4" aria-hidden="true" />
                Copy video sha
              </button>
            )}
            <button
              type="button"
              onClick={copyEventJson}
              className="inline-flex select-none items-center gap-2 rounded-lg border border-[#c9d6e2] bg-white px-3 py-2 text-sm font-bold text-[#29425f] transition hover:bg-[#edf3f8]"
            >
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Copy event JSON
            </button>
          </div>
          <pre className="mt-4 max-h-96 select-text overflow-auto rounded-lg bg-[#102033] p-4 text-xs leading-5 text-[#dbeafe]">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}
    </article>
  );
}

export function LearningLogsPage() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [word, setWord] = useState("");
  const [language, setLanguage] = useState("");
  const [userId, setUserId] = useState("");
  const [limit, setLimit] = useState(50);
  const [zeroOnly, setZeroOnly] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [events, setEvents] = useState<LearningScoreLogEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [logPath, setLogPath] = useState("");
  const [summary, setSummary] = useState({ success: 0, error: 0, zero: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getLearningScoreEvents({
        authToken: accessToken,
        limit,
        scanLimit: 4000,
        query,
        word,
        language,
        userId,
        zeroOnly,
        errorsOnly,
      });
      setEvents(response.events);
      setMatchedCount(response.matched_count);
      setScannedCount(response.scanned_count);
      setLogPath(response.log_path);
      setSummary({
        success: response.summary?.success ?? 0,
        error: response.summary?.error ?? 0,
        zero: response.summary?.zero ?? 0,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load score logs.");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, errorsOnly, language, limit, query, userId, word, zeroOnly]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEvents();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [loadEvents]);

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = window.setInterval(() => {
      void loadEvents();
    }, 6000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, loadEvents]);

  const zeroCount = useMemo(
    () => events.filter((event) => typeof event.score === "number" && event.score <= 0).length,
    [events],
  );

  return (
    <PortalShell
      activeSection="logs"
      eyebrow="Debugging"
      title="Learning Score Logs"
      subtitle="Review recent scoring attempts, filter failures, and inspect movement and handshape channel outcomes."
    >
      <section className="mb-5 rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#64748b]" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search request, attempt, user, word, filename, sha"
              className="h-10 w-full rounded-lg border border-[#c9d6e2] bg-white pl-9 pr-3 text-sm font-semibold text-[#102033] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
            />
          </label>
          <input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            placeholder="Word"
            className="h-10 rounded-lg border border-[#c9d6e2] px-3 text-sm font-semibold text-[#102033] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
          />
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="User id"
            className="h-10 rounded-lg border border-[#c9d6e2] px-3 text-sm font-semibold text-[#102033] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
          />
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-10 rounded-lg border border-[#c9d6e2] bg-white px-3 text-sm font-bold text-[#102033] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
          >
            <option value="">All languages</option>
            <option value="TRSL">TRSL</option>
            <option value="ASL">ASL</option>
          </select>
          <button
            type="button"
            onClick={() => void loadEvents()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#14213d] px-4 text-sm font-bold text-white transition hover:bg-[#24385f]"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-[#29425f]">
            <input
              type="checkbox"
              checked={zeroOnly}
              onChange={(event) => setZeroOnly(event.target.checked)}
              className="h-4 w-4 rounded border-[#c9d6e2]"
            />
            Zero scores
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-[#29425f]">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(event) => setErrorsOnly(event.target.checked)}
              className="h-4 w-4 rounded border-[#c9d6e2]"
            />
            Errors only
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-[#29425f]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4 rounded border-[#c9d6e2]"
            />
            Auto refresh
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-[#29425f]">
            Limit
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="h-8 rounded-lg border border-[#c9d6e2] bg-white px-2 text-sm font-bold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          ["Showing", events.length, "events"],
          ["Matched", matchedCount, "of scanned"],
          ["Zero Scores", zeroOnly ? matchedCount : zeroCount || summary.zero, "recent"],
          ["Errors", summary.error, "recent"],
        ].map(([label, value, suffix]) => (
          <div key={label} className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748b]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[#102033]">{value}</p>
            <p className="mt-1 text-xs font-semibold text-[#64748b]">{suffix}</p>
          </div>
        ))}
      </section>

      <section className="mb-4 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm text-[#50627a]">
        <p>
          <span className="font-bold text-[#102033]">Log:</span>{" "}
          <span className="break-all font-mono text-xs">{logPath || "No log file found yet"}</span>
        </p>
        <p className="mt-1">
          Scanned newest {scannedCount.toLocaleString()} events. Expand a row for channel diagnostics and compact JSON.
        </p>
      </section>

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fff1f2] p-4 text-sm font-bold text-[#b91c1c]">
          {errorMessage}
        </div>
      )}

      {isLoading && events.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-[#d9e2ec] bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-[#2563eb]" aria-hidden="true" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-[#d9e2ec] bg-white p-8 text-center">
          <p className="text-lg font-black text-[#102033]">No score events match these filters.</p>
          <p className="mt-2 text-sm font-semibold text-[#64748b]">Try clearing filters or run a new scoring attempt.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => {
            const key = event.request_id ?? event.attempt_id ?? `${event.timestamp_iso}-${index}`;
            return (
              <EventCard
                key={key}
                event={event}
                expanded={expandedId === key}
                onToggle={() => setExpandedId((current) => (current === key ? null : key))}
              />
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
