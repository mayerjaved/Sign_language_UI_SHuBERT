import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";

function getSafeNext(value: FormDataEntryValue | string | null) {
    const next = typeof value === "string" ? value : "";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
}

function redirectWithAuthError(origin: string, error: string, errorCode?: string | null) {
    const redirectUrl = new URL("/", origin);
    redirectUrl.searchParams.set("auth_error", error);

    if (errorCode) {
        redirectUrl.searchParams.set("auth_error_code", errorCode);
    }

    return NextResponse.redirect(redirectUrl, { status: 303 });
}

async function signInDemo(request: Request, nextCandidate: FormDataEntryValue | string | null) {
    const { origin } = new URL(request.url);
    const next = getSafeNext(nextCandidate);
    const email = process.env.DEMO_ACCOUNT_EMAIL?.trim() ?? "";
    const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "";

    if (!email || !password) {
        return redirectWithAuthError(
            origin,
            "Demo account is not configured. Set DEMO_ACCOUNT_EMAIL and DEMO_ACCOUNT_PASSWORD.",
            "demo_not_configured",
        );
    }

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return redirectWithAuthError(origin, error.message, error.status?.toString());
        }
    } catch (error) {
        return redirectWithAuthError(
            origin,
            getSupabaseErrorMessage(error, "Demo sign-in failed."),
        );
    }

    return NextResponse.redirect(new URL(next, origin), { status: 303 });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    return signInDemo(request, searchParams.get("next"));
}

export async function POST(request: Request) {
    const formData = await request.formData();
    return signInDemo(request, formData.get("next"));
}
