import { NextResponse } from "next/server";
import { verifyOpenRouterKey } from "@/lib/ai/openrouter";
import { getSession, type SessionData, setSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secret-box";
import { createAdminClient } from "@/lib/supabase/admin";

// The signed-in user's own OpenRouter key, which pays for AI reviews on the
// events they own. Write-only from the browser's point of view: the key is
// stored encrypted and only its last 4 characters ever come back. A key is
// required to use Bench at all, so it can be replaced but never removed.

function requireUserId(session: SessionData | null) {
  if (session?.user.role === "user" && session.user.userId) {
    return session.user.userId;
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  const userId = requireUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("openrouter_key_last4, openrouter_key_encrypted")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading OpenRouter key status:", error);
    return NextResponse.json(
      { error: "Failed to load key status" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    configured: !!data?.openrouter_key_encrypted,
    last4: data?.openrouter_key_last4 ?? null,
  });
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    const userId = requireUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "api_key is required" },
        { status: 400 },
      );
    }

    if (!(await verifyOpenRouterKey(apiKey))) {
      return NextResponse.json(
        { error: "OpenRouter didn't accept that key. Double-check and retry." },
        { status: 400 },
      );
    }

    const last4 = apiKey.slice(-4);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("users")
      .update({
        openrouter_key_encrypted: encryptSecret(apiKey),
        openrouter_key_last4: last4,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("Error saving OpenRouter key:", error);
      return NextResponse.json(
        { error: "Failed to save key" },
        { status: 500 },
      );
    }

    // Unlocks the rest of the app for this session (see requireOnboarded).
    if (session && !session.user.hasOpenRouterKey) {
      await setSession({
        ...session,
        user: { ...session.user, hasOpenRouterKey: true },
      });
    }

    return NextResponse.json({ configured: true, last4 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
