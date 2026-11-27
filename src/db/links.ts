import type { Link } from "../types/env";

export async function findLinkBySlug(db: D1Database, slug: string): Promise<Link | null> {
  const result = await db
    .prepare("SELECT id, user_id, slug, target_url, title, clicks, created_at FROM links WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<Link>();

  return result ?? null;
}

export async function incrementLinkClicks(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE links SET clicks = clicks + 1 WHERE id = ?").bind(id).run();
}

export async function listLinks(db: D1Database, userId?: string | null, limit = 50): Promise<Link[]> {
  if (userId) {
    const { results } = await db
      .prepare(
        "SELECT id, user_id, slug, target_url, title, clicks, created_at FROM links WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
      )
      .bind(userId, limit)
      .all<Link>();
    return results;
  }

  const { results } = await db
    .prepare("SELECT id, user_id, slug, target_url, title, clicks, created_at FROM links ORDER BY created_at DESC LIMIT ?")
    .bind(limit)
    .all<Link>();
  return results;
}

export async function createLink(
  db: D1Database,
  input: {
    slug: string;
    target_url: string;
    title?: string | null;
    user_id?: string | null;
  }
): Promise<Link> {
  const inserted = await db
    .prepare(
      `INSERT INTO links (user_id, slug, target_url, title)
       VALUES (?, ?, ?, ?)
       RETURNING id, user_id, slug, target_url, title, clicks, created_at`
    )
    .bind(input.user_id ?? null, input.slug, input.target_url, input.title ?? null)
    .first<Link>();

  if (!inserted) {
    throw new Error("Failed to insert link into D1");
  }

  return inserted;
}

export async function deleteLinkById(db: D1Database, id: number, userId?: string | null): Promise<boolean> {
  const stmt = userId
    ? db.prepare("DELETE FROM links WHERE id = ? AND user_id = ?").bind(id, userId)
    : db.prepare("DELETE FROM links WHERE id = ?").bind(id);

  const result = await stmt.run();
  return (result.meta.changes ?? 0) > 0;
}
