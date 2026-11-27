import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { createLink, deleteLinkById, findLinkBySlug, listLinks } from "../../src/db/links";
import { generateSlug, isValidHttpUrl, isValidSlug } from "../../src/lib/validation";
import { optionalAuth, requireAuth } from "../../src/middleware/auth";
import { authRoutes } from "../../src/routes/auth";
import type { AppVariables, CreateLinkInput, Env } from "../../src/types/env";

const app = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>().basePath("/api");

app.use("*", optionalAuth);

app.get("/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    return c.json({ ok: false, error: "Database connection failed" }, 500);
  }
});

app.route("/auth", authRoutes);

app.use("/links", requireAuth);
app.use("/links/*", requireAuth);

app.get("/links", async (c) => {
  const user = c.get("user")!;
  const links = await listLinks(c.env.DB, user.id);
  return c.json({ links });
});

app.post("/links", async (c) => {
  let body: CreateLinkInput;
  try {
    body = await c.req.json<CreateLinkInput>();
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  const targetUrl = body.target_url?.trim();
  if (!targetUrl || !isValidHttpUrl(targetUrl)) {
    return c.json({ error: "Please provide a valid http:// or https:// URL" }, 400);
  }

  let slug = body.slug?.trim();
  if (slug) {
    if (!isValidSlug(slug)) {
      return c.json(
        {
          error: "Custom slug must be 3-32 characters (letters, numbers, '-' or '_') and not a reserved path"
        },
        400
      );
    }
    const existing = await findLinkBySlug(c.env.DB, slug);
    if (existing) {
      return c.json({ error: `Slug '${slug}' is already taken` }, 409);
    }
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateSlug(6);
      const existing = await findLinkBySlug(c.env.DB, candidate);
      if (!existing) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      return c.json({ error: "Could not generate a unique slug. Please try again." }, 500);
    }
  }

  const user = c.get("user")!;
  const title = body.title?.trim() || null;

  try {
    const link = await createLink(c.env.DB, {
      slug,
      target_url: targetUrl,
      title,
      user_id: user.id
    });
    return c.json({ link }, 201);
  } catch (error) {
    console.error("Failed to create link:", error);
    return c.json({ error: "Failed to create short link" }, 500);
  }
});

app.delete("/links/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "Invalid link ID" }, 400);
  }

  const user = c.get("user")!;
  const deleted = await deleteLinkById(c.env.DB, id, user.id);
  if (!deleted) {
    return c.json({ error: "Link not found or you do not have permission to delete it" }, 404);
  }

  return c.json({ ok: true });
});

export const onRequest = handle(app);
