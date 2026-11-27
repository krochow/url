import { findLinkBySlug, incrementLinkClicks } from "../src/db/links";
import { renderNotFoundHtml } from "../src/lib/templates";
import type { Env } from "../src/types/env";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const rawSlug = context.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  if (!slug) {
    return new Response(renderNotFoundHtml(""), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
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
