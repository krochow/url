function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderNotFoundHtml(slug: string): string {
  const safeSlug = escapeHtml(slug);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 - Short Link Not Found</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
    <main class="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span class="text-xl font-bold">404</span>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-white">Link not found</h1>
      <p class="mt-3 text-sm text-slate-400">
        The short link <code class="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">/${safeSlug}</code> does not exist or may have been removed.
      </p>
      <div class="mt-6">
        <a
          href="/"
          class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          Create a Short Link
        </a>
      </div>
    </main>
  </body>
</html>`;
}
