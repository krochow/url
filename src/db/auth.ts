import type { Session, User } from "../types/env";

export async function upsertUser(
  db: D1Database,
  input: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  }
): Promise<User> {
  const user = await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         avatar_url = excluded.avatar_url
       RETURNING id, email, name, avatar_url, created_at`
    )
    .bind(input.id, input.email, input.name, input.avatar_url)
    .first<User>();

  if (!user) {
    throw new Error("Failed to upsert user into D1");
  }
  return user;
}

export async function createSession(
  db: D1Database,
  userId: string,
  ttlSeconds = 60 * 60 * 24 * 7
): Promise<Session> {
  const id = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  const session = await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES (?, ?, ?)
       RETURNING id, user_id, expires_at`
    )
    .bind(id, userId, expiresAt)
    .first<Session>();

  if (!session) {
    throw new Error("Failed to create session in D1");
  }
  return session;
}

export async function findSessionUser(db: D1Database, sessionId: string): Promise<User | null> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const user = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.created_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?
       LIMIT 1`
    )
    .bind(sessionId, nowSeconds)
    .first<User>();

  return user ?? null;
}

export async function deleteSessionById(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}
