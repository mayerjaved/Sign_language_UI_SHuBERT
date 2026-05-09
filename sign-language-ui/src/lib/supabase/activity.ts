"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";

function getUserAgent() {
    return typeof navigator === "undefined" ? null : navigator.userAgent;
}

function getPathname() {
    return typeof window === "undefined" ? "/" : window.location.pathname || "/";
}

export async function upsertProfile(supabase: SupabaseClient, user: User) {
    const displayName =
        typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : typeof user.user_metadata?.name === "string"
              ? user.user_metadata.name
              : null;

    await supabase.from("profiles").upsert(
        {
            id: user.id,
            display_name: displayName,
            email: user.email ?? null,
            avatar_url:
                typeof user.user_metadata?.avatar_url === "string"
                    ? user.user_metadata.avatar_url
                    : null,
            last_seen_at: new Date().toISOString(),
        },
        { onConflict: "id" },
    );
}

export async function startAppSession(supabase: SupabaseClient, user: User) {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    await upsertProfile(supabase, user);
    await supabase.from("app_sessions").insert({
        id: sessionId,
        user_id: user.id,
        started_at: now,
        last_seen_at: now,
        current_path: getPathname(),
        user_agent: getUserAgent(),
        page_view_count: 1,
    });

    return sessionId;
}

export async function recordSessionHeartbeat(
    supabase: SupabaseClient,
    user: User,
    sessionId: string,
) {
    const now = new Date().toISOString();

    await Promise.all([
        supabase
            .from("profiles")
            .update({ last_seen_at: now })
            .eq("id", user.id),
        supabase
            .from("app_sessions")
            .update({
                last_seen_at: now,
                current_path: getPathname(),
            })
            .eq("id", sessionId)
            .eq("user_id", user.id),
    ]);
}

export async function recordPageView(
    supabase: SupabaseClient,
    user: User,
    sessionId: string,
) {
    await supabase.rpc("increment_app_session_page_views", {
        session_id: sessionId,
        session_user_id: user.id,
        current_page: getPathname(),
    });
}

export async function endAppSession(supabase: SupabaseClient, user: User, sessionId: string) {
    const now = new Date().toISOString();

    await supabase
        .from("app_sessions")
        .update({
            ended_at: now,
            last_seen_at: now,
            current_path: getPathname(),
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);
}
