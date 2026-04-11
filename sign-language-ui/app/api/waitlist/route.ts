import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

interface WaitlistEntry {
  id: string;
  email: string;
  languageCode: string;
  languageName: string;
  createdAt: string;
}

const WAITLIST_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WAITLIST_DIRECTORY_PATH = path.join(process.cwd(), "data");
const WAITLIST_FILE_PATH = path.join(WAITLIST_DIRECTORY_PATH, "waitlist-submissions.json");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const ensureWaitlistFile = async (): Promise<void> => {
  await fs.mkdir(WAITLIST_DIRECTORY_PATH, { recursive: true });
  try {
    await fs.access(WAITLIST_FILE_PATH);
  } catch {
    await fs.writeFile(WAITLIST_FILE_PATH, "[]\n", "utf8");
  }
};

const readWaitlistEntries = async (): Promise<WaitlistEntry[]> => {
  await ensureWaitlistFile();
  try {
    const content = await fs.readFile(WAITLIST_FILE_PATH, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isWaitlistEntry);
  } catch {
    return [];
  }
};

const writeWaitlistEntries = async (entries: WaitlistEntry[]): Promise<void> => {
  await fs.mkdir(WAITLIST_DIRECTORY_PATH, { recursive: true });
  await fs.writeFile(WAITLIST_FILE_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
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
