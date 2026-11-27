const form = document.getElementById("shorten-form");
const targetUrlInput = document.getElementById("target-url");
const customSlugInput = document.getElementById("custom-slug");
const titleInput = document.getElementById("link-title");
const submitBtn = document.getElementById("submit-btn");
const feedbackEl = document.getElementById("form-feedback");
const linksContainer = document.getElementById("links-container");
const refreshBtn = document.getElementById("refresh-btn");
const authControls = document.getElementById("auth-controls");

let currentUser = null;

function showFeedback(message, isError = false) {
  feedbackEl.textContent = message;
  feedbackEl.className = isError
    ? "rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
    : "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";
}

function clearFeedback() {
  feedbackEl.className = "hidden";
  feedbackEl.textContent = "";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderAuthControls() {
  if (!currentUser) {
    authControls.innerHTML = `
      <a
        href="/api/auth/google"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
      >
        Sign in with Google
      </a>
    `;
    return;
  }

  const avatarHtml = currentUser.avatar_url
    ? `<img src="${escapeHtml(currentUser.avatar_url)}" alt="" class="h-7 w-7 rounded-full border border-slate-700" referrerpolicy="no-referrer" />`
    : "";

  authControls.innerHTML = `
    <div class="flex items-center gap-3">
      ${avatarHtml}
      <span class="hidden sm:inline text-xs text-slate-300">${escapeHtml(currentUser.name || currentUser.email)}</span>
      <button
        id="logout-btn"
        type="button"
        class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
      >
        Sign out
      </button>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    currentUser = null;
    renderAuthControls();
    renderUnauthenticatedState();
  });
}

function renderUnauthenticatedState() {
  submitBtn.disabled = true;
  linksContainer.innerHTML = `
    <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
      <p class="text-sm text-slate-300">Sign in with your Google account to create and manage your short links.</p>
      <a
        href="/api/auth/google"
        class="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
      >
        Sign in with Google
      </a>
    </div>
  `;
}

async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text);
    const original = buttonEl.textContent;
    buttonEl.textContent = "Copied!";
    setTimeout(() => {
      buttonEl.textContent = original;
    }, 1500);
  } catch {
    showFeedback(`Copy failed. Short URL: ${text}`, true);
  }
}

async function deleteLink(id) {
  const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showFeedback(data.error || "Failed to delete link", true);
    return;
  }
  await loadLinks();
}

function renderLinks(links) {
  if (!links.length) {
    linksContainer.innerHTML = `
      <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        No short links yet. Create your first one above!
      </div>
    `;
    return;
  }

  linksContainer.innerHTML = links
    .map((link) => {
      const shortUrl = `${window.location.origin}/${link.slug}`;
      const titleHtml = link.title
        ? `<span class="text-sm font-medium text-white">${escapeHtml(link.title)}</span>`
        : "";
      return `
        <article class="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <a href="/${encodeURIComponent(link.slug)}" target="_blank" rel="noopener" class="font-mono text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                /${escapeHtml(link.slug)}
              </a>
              ${titleHtml}
            </div>
            <p class="truncate text-xs text-slate-400" title="${escapeHtml(link.target_url)}">
              ${escapeHtml(link.target_url)}
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
              ${link.clicks} ${link.clicks === 1 ? "click" : "clicks"}
            </span>
            <button
              type="button"
              data-copy="${escapeHtml(shortUrl)}"
              class="copy-btn rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Copy
            </button>
            <button
              type="button"
              data-delete="${link.id}"
              class="delete-btn rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  linksContainer.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyToClipboard(btn.dataset.copy, btn));
  });

  linksContainer.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteLink(btn.dataset.delete));
  });
}

async function loadLinks() {
  if (!currentUser) {
    renderUnauthenticatedState();
    return;
  }

  try {
    const res = await fetch("/api/links");
    if (res.status === 401) {
      currentUser = null;
      renderAuthControls();
      renderUnauthenticatedState();
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load links");
    }
    renderLinks(data.links || []);
  } catch (err) {
    linksContainer.innerHTML = `
      <div class="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
        ${escapeHtml(err.message)}
      </div>
    `;
  }
}

async function init() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      submitBtn.disabled = false;
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  }

  renderAuthControls();
  await loadLinks();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();

  if (!currentUser) {
    showFeedback("Please sign in with Google first.", true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";

  try {
    const payload = {
      target_url: targetUrlInput.value.trim(),
      slug: customSlugInput.value.trim() || undefined,
      title: titleInput.value.trim() || undefined
    };

    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create short link");
    }

    const shortUrl = `${window.location.origin}/${data.link.slug}`;
    showFeedback(`Created short link: ${shortUrl}`);
    form.reset();
    await loadLinks();
  } catch (err) {
    showFeedback(err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Shorten URL";
  }
});

refreshBtn.addEventListener("click", loadLinks);
init();
