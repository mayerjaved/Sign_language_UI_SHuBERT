export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const SUPABASE_INVALID_API_KEY_MESSAGE =
    "Supabase rejected the configured API key. Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY come from the same Supabase project.";

export async function getSupabaseConfigurationError() {
    if (!isSupabaseConfigured) {
        return "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";
    }

    try {
        const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/settings`, {
            cache: "no-store",
            headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
            },
        });

        if (response.ok) return null;

        if (response.status === 401 || response.status === 403) {
            return SUPABASE_INVALID_API_KEY_MESSAGE;
        }

        if (response.status === 404) {
            return "Supabase Auth was not found at NEXT_PUBLIC_SUPABASE_URL. Check the project URL.";
        }
    } catch (error) {
        console.warn("[Supabase] Unable to verify auth configuration.", error);
    }

    return null;
}
