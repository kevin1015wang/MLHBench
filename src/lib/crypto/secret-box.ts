import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM encryption for user-supplied secrets at rest (currently just
// OpenRouter API keys on users.openrouter_key_encrypted). The key comes from
// API_KEY_ENCRYPTION_KEY rather than being derived from AUTH_SECRET, so
// rotating the session secret doesn't silently brick everyone's stored keys.
//
// Stored format: "v1:<iv>:<auth tag>:<ciphertext>", each part base64url.
const VERSION = "v1";
const IV_LENGTH = 12;

const getKey = () => {
  const raw = process.env.API_KEY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY is required to store users' API keys",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY must be 32 bytes, base64-encoded (e.g. `openssl rand -base64 32`)",
    );
  }
  return key;
};

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(":");
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, ciphertext] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unrecognized encrypted secret format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
