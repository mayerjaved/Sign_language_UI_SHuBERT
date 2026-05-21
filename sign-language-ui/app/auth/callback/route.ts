import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function redirectWithAuthError(origin: string, error: string, errorCode?: string | null) {
    const redirectUrl = new URL("/", origin);
    redirectUrl.searchParams.set("auth_error", error);

    if (errorCode) {
        redirectUrl.searchParams.set("auth_error_code", errorCode);
    }

    return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const authError = searchParams.get("error_description") ?? searchParams.get("error");
    const authErrorCode = searchParams.get("error_code");
    let next = searchParams.get("next") ?? "/learn";

    if (!next.startsWith("/")) {
        next = "/learn";
    }

    if (authError) {
        return redirectWithAuthError(origin, authError, authErrorCode);
    }

    if (!code) {
        return redirectWithAuthError(origin, "Missing authentication code. Please request a new sign-in link.");
    }

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            return redirectWithAuthError(origin, error.message, error.status?.toString());
        }
    }

    return NextResponse.redirect(`${origin}${next}`);
}
