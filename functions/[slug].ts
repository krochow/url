import { findLinkBySlug, incrementLinkClicks } from "../src/db/links";
import { renderNotFoundHtml } from "../src/lib/templates";
import { RESERVED_SLUGS } from "../src/lib/validation";
import type { Env } from "../src/types/env";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rawSlug = context.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  if (!slug) {
    return context.next();
  }

  // Let Cloudflare Pages serve static assets (e.g., /styles.css, /app.js, /favicon.ico)
  // and reserved paths directly without querying D1.
  if (slug.includes(".") || RESERVED_SLUGS.has(slug.toLowerCase())) {
    return context.next();
  }

  const link = await findLinkBySlug(context.env.DB, slug);
  if (!link) {
    return new Response(renderNotFoundHtml(slug), {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  // Increment click count asynchronously without delaying the 302 redirect
  context.waitUntil(
    incrementLinkClicks(context.env.DB, link.id).catch((err) => {
      console.error(`Failed to increment clicks for slug '${slug}':`, err);
    })
  );

  return Response.redirect(link.target_url, 302);
};
