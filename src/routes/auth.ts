import { Google, generateCodeVerifier, generateState } from "arctic";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createSession, deleteSessionById, upsertUser } from "../db/auth";
import { SESSION_COOKIE_NAME } from "../middleware/auth";
import type { AppVariables, Env } from "../types/env";

const OAUTH_STATE_COOKIE = "google_oauth_state";
const OAUTH_VERIFIER_COOKIE = "google_code_verifier";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function getRedirectUri(requestUrl: string, appUrl?: string): string {
  const baseUrl = appUrl ? appUrl.replace(/\/+$/, "") : new URL(requestUrl).origin;
  return `${baseUrl}/api/auth/callback`;
}

function isHttpsRequest(requestUrl: string): boolean {
  return new URL(requestUrl).protocol === "https:";
}

export const authRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

authRoutes.get("/google", (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL } = c.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "Google OAuth is not configured on the server" }, 500);
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const redirectUri = getRedirectUri(c.req.url, APP_URL);
  const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);

  const secure = isHttpsRequest(c.req.url);
  const tempCookieOptions = {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax" as const,
    maxAge: 60 * 10 // 10 minutes
  };

  setCookie(c, OAUTH_STATE_COOKIE, state, tempCookieOptions);
  setCookie(c, OAUTH_VERIFIER_COOKIE, codeVerifier, tempCookieOptions);

  return c.redirect(url.toString(), 302);
});

authRoutes.get("/callback", async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, DB } = c.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "Google OAuth is not configured on the server" }, 500);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, OAUTH_STATE_COOKIE);
  const codeVerifier = getCookie(c, OAUTH_VERIFIER_COOKIE);

  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
  deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: "/" });

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return c.json({ error: "Invalid OAuth state or missing authorization code" }, 400);
  }

  try {
    const redirectUri = getRedirectUri(c.req.url, APP_URL);
    const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken();

    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userInfoRes.ok) {
      return c.json({ error: "Failed to fetch Google user profile" }, 502);
    }

    const googleUser = (await userInfoRes.json()) as GoogleUserInfo;
    if (!googleUser.sub || !googleUser.email) {
      return c.json({ error: "Google account did not return required profile fields" }, 400);
    }

    const user = await upsertUser(DB, {
      id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name ?? null,
      avatar_url: googleUser.picture ?? null
    });

    const session = await createSession(DB, user.id, SESSION_TTL_SECONDS);

    setCookie(c, SESSION_COOKIE_NAME, session.id, {
      path: "/",
      httpOnly: true,
      secure: isHttpsRequest(c.req.url),
      sameSite: "Lax",
      maxAge: SESSION_TTL_SECONDS
    });

    return c.redirect("/", 302);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return c.json({ error: "Authentication failed" }, 400);
  }
});

authRoutes.post("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) {
    await deleteSessionById(c.env.DB, sessionId);
  }

  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ user });
});
