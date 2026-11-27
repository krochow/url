const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const RESERVED_SLUGS = new Set([
  "api",
  "auth",
  "login",
  "logout",
  "dashboard",
  "health",
  "favicon.ico",
  "robots.txt",
  "styles.css",
  "app.js"
]);

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !RESERVED_SLUGS.has(slug.toLowerCase());
}

export function generateSlug(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return result;
}
