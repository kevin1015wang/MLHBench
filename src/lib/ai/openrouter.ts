import {
  createOpenRouter,
  type OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { createAdminClient } from "@/lib/supabase/admin";

export const REVIEW_MODEL_ID = "google/gemini-2.5-flash";

export class MissingOpenRouterKeyError extends Error {
  constructor() {
    super(
      "This event's owner hasn't added an OpenRouter API key yet. Add one in Settings to run AI reviews.",
    );
    this.name = "MissingOpenRouterKeyError";
  }
}

// Who pays for an event's AI reviews: admin-run events (owner_user_id null)
// use the server's own OPENROUTER_API_KEY, same as before self-signup
// existed; user-owned events always bill the owner's key, no matter which
// co-judge clicked "Run" -- one predictable bill per event.
export async function getOpenRouterForEvent(
  ownerUserId: string | null,
): Promise<OpenRouterProvider> {
  if (!ownerUserId) {
    return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  }

  const supabase = createAdminClient();
  const { data: owner, error } = await supabase
    .from("users")
    .select("openrouter_key_encrypted")
    .eq("id", ownerUserId)
    .maybeSingle();

  if (error) throw error;
  if (!owner?.openrouter_key_encrypted) {
    throw new MissingOpenRouterKeyError();
  }

  return createOpenRouter({
    apiKey: decryptSecret(owner.openrouter_key_encrypted),
  });
}

// Confirms a pasted key is live before it's saved, so a typo surfaces in
// Settings instead of as a failed review later.
export async function verifyOpenRouterKey(apiKey: string) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to verify OpenRouter key", error);
    return false;
  }
}
