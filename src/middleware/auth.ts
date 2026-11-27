import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { findSessionUser } from "../db/auth";
import type { AppVariables, Env } from "../types/env";

export const SESSION_COOKIE_NAME = "session_id";

type AuthEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

/**
 * Resolves the current session cookie (if present and valid) and attaches
 * `user` to the Hono context without blocking unauthenticated requests.
 */
export const optionalAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    c.set("user", null);
    await next();
    return;
  }

  try {
    const user = await findSessionUser(c.env.DB, sessionId);
    c.set("user", user);
  } catch (error) {
    console.error("Failed to resolve session:", error);
    c.set("user", null);
  }

  await next();
};

/**
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized. Please sign in with Google." }, 401);
  }
  await next();
};
