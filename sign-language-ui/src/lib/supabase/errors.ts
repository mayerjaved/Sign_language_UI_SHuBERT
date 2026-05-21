import { SUPABASE_INVALID_API_KEY_MESSAGE } from "./config";

export function getSupabaseErrorMessage(error: unknown, fallback = "Authentication failed.") {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : fallback;

    if (/invalid\s+api\s+key/i.test(message)) {
        return SUPABASE_INVALID_API_KEY_MESSAGE;
    }

    return message || fallback;
}

export function toSupabaseError(error: unknown, fallback?: string) {
    return new Error(getSupabaseErrorMessage(error, fallback));
}
