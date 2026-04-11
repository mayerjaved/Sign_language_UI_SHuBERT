import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

interface WaitlistEntry {
  id: string;
  email: string;
  languageCode: string;
  languageName: string;
  createdAt: string;
}

const WAITLIST_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initialize Redis client using either Vercel KV env vars or Upstash direct env vars
const getRedisClient = () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({ url, token });
};

const isWaitlistEntry = (value: unknown): value is WaitlistEntry => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.languageCode === "string" &&
    typeof candidate.languageName === "string" &&
    typeof candidate.createdAt === "string"
  );
};

const readWaitlistEntries = async (): Promise<WaitlistEntry[]> => {
  const redis = getRedisClient();
  if (!redis) {
    console.warn("[waitlist] Redis client not configured (Missing Vercel KV vars). Returning empty list.");
    return [];
  }
  try {
    const parsed = await redis.get<unknown>("waitlist-submissions");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isWaitlistEntry);
  } catch (error) {
    console.error("[waitlist] failed to read from redis", error);
    return [];
  }
};

const writeWaitlistEntries = async (entries: WaitlistEntry[]): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error("Redis client not configured. Cannot save waitlist entry.");
  }
  await redis.set("waitlist-submissions", entries);
};

export const GET = async (): Promise<NextResponse> => {
  const entries = await readWaitlistEntries();
  return NextResponse.json(
    {
      entries,
      total: entries.length,
    },
    { status: 200 },
  );
};

export const POST = async (request: Request): Promise<NextResponse> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Payload must be an object." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const languageCode = typeof body.languageCode === "string" ? body.languageCode.trim() : "";
  const languageName = typeof body.languageName === "string" ? body.languageName.trim() : "";

  if (!WAITLIST_EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  if (!languageCode || !languageName) {
    return NextResponse.json(
      { error: "Please provide a valid sign-language code and name." },
      { status: 400 },
    );
  }

  try {
    const entries = await readWaitlistEntries();
    const existing = entries.find(
      (entry) =>
        entry.email.toLowerCase() === email &&
        entry.languageCode.toLowerCase() === languageCode.toLowerCase(),
    );

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          message: `You're already on the waitlist for ${existing.languageName}.`,
          entry: existing,
          total: entries.length,
        },
        { status: 200 },
      );
    }

    const newEntry: WaitlistEntry = {
      id: randomUUID(),
      email,
      languageCode,
      languageName,
      createdAt: new Date().toISOString(),
    };

    entries.push(newEntry);
    await writeWaitlistEntries(entries);

    return NextResponse.json(
      {
        ok: true,
        message: `Thanks! You're on the waitlist for ${languageName}.`,
        entry: newEntry,
        total: entries.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[waitlist] failed to persist entry", error);
    return NextResponse.json(
      { error: "Unable to save waitlist entry right now. Please try again." },
      { status: 500 },
    );
  }
};
