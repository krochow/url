const authControls = document.getElementById("auth-controls");
const authLoading = document.getElementById("auth-loading");
const landingView = document.getElementById("landing-view");
const dashboardView = document.getElementById("dashboard-view");

const form = document.getElementById("shorten-form");
const targetUrlInput = document.getElementById("target-url");
const customSlugInput = document.getElementById("custom-slug");
const titleInput = document.getElementById("link-title");
const submitBtn = document.getElementById("submit-btn");
const feedbackEl = document.getElementById("form-feedback");
const linksContainer = document.getElementById("links-container");
const refreshBtn = document.getElementById("refresh-btn");

const qrModal = document.getElementById("qr-modal");
const qrModalTitle = document.getElementById("qr-modal-title");
const qrModalUrl = document.getElementById("qr-modal-url");
const qrCanvas = document.getElementById("qr-canvas");
const qrDownloadBtn = document.getElementById("qr-download-btn");
const qrCloseBtn = document.getElementById("qr-close-btn");
const qrCloseX = document.getElementById("qr-close-x");

let currentUser = null;
let activeQrSlug = "";

const GOOGLE_G_SVG = `
  <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"/>
    <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"/>
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"/>
  </svg>
`;

const SPINNER_SVG = `
  <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
`;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function showFeedback(message, isError = false) {
  feedbackEl.textContent = message;
  feedbackEl.className = isError
    ? "rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
    : "rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";
}

function showCreatedFeedback(link, shortUrl) {
  feedbackEl.className =
    "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";
  feedbackEl.innerHTML = `
    <span class="min-w-0 truncate">
      Created short link: <a href="/${encodeURIComponent(link.slug)}" target="_blank" rel="noopener" class="font-mono font-semibold underline hover:text-emerald-200">${escapeHtml(shortUrl)}</a>
    </span>
    <button
      id="banner-qr-btn"
      type="button"
      class="shrink-0 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/30"
    >
      QR Code
    </button>
  `;

  document.getElementById("banner-qr-btn").addEventListener("click", () => {
    openQrModal(link.slug, shortUrl, link.title);
  });
}

function clearFeedback() {
  feedbackEl.className = "hidden";
  feedbackEl.textContent = "";
}

function openQrModal(slug, shortUrl, title) {
  if (!window.QRCode) {
    showFeedback("QR Code library is still loading. Please try again.", true);
    return;
  }

  activeQrSlug = slug;
  qrModalTitle.textContent = title ? title : `/${slug}`;
  qrModalUrl.textContent = shortUrl;

  window.QRCode.toCanvas(
    qrCanvas,
    shortUrl,
    {
      width: 224,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      }
    },
    (err) => {
      if (err) {
        showFeedback("Failed to generate QR code.", true);
        return;
      }
      qrModal.classList.remove("hidden");
    }
  );
}

function closeQrModal() {
  qrModal.classList.add("hidden");
  activeQrSlug = "";
}

function switchToLoggedOutView() {
  currentUser = null;
  authLoading.classList.add("hidden");
  dashboardView.classList.add("hidden");
  landingView.classList.remove("hidden");
  closeQrModal();
  clearFeedback();
  renderHeaderAuth();
}

function switchToLoggedInView(user) {
  currentUser = user;
  authLoading.classList.add("hidden");
  landingView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  renderHeaderAuth();
}

function renderHeaderAuth() {
  if (!currentUser) {
    authControls.innerHTML = `
      <a
        href="/api/auth/google"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
      >
        ${GOOGLE_G_SVG}
        <span>Sign in</span>
      </a>
    `;
    return;
  }

  const displayName = escapeHtml(currentUser.name || currentUser.email);
  const avatarHtml = currentUser.avatar_url
    ? `<img src="${escapeHtml(currentUser.avatar_url)}" alt="${displayName}" class="h-8 w-8 rounded-full border border-slate-700 object-cover" referrerpolicy="no-referrer" />`
    : `<div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">${displayName.charAt(0).toUpperCase()}</div>`;

  authControls.innerHTML = `
    <div class="flex items-center gap-3">
      ${avatarHtml}
      <div class="hidden sm:flex flex-col text-right leading-tight">
        <span class="text-xs font-medium text-slate-200">${displayName}</span>
        ${currentUser.name ? `<span class="text-[11px] text-slate-400">${escapeHtml(currentUser.email)}</span>` : ""}
      </div>
      <button
        id="logout-btn"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
      >
        Logout
      </button>
    </div>
  `;

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = `${SPINNER_SVG}<span>Logging out...</span>`;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      switchToLoggedOutView();
    }
  });
}

async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text);
    const original = buttonEl.textContent;
    buttonEl.textContent = "Copied!";
    buttonEl.classList.add("border-emerald-500/50", "text-emerald-300");
    setTimeout(() => {
      buttonEl.textContent = original;
      buttonEl.classList.remove("border-emerald-500/50", "text-emerald-300");
    }, 1500);
  } catch {
    showFeedback(`Copy failed. Short URL: ${text}`, true);
  }
}

async function deleteLink(id, buttonEl) {
  clearFeedback();
  buttonEl.disabled = true;
  buttonEl.textContent = "Deleting...";

  try {
    const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
    if (res.status === 401) {
      switchToLoggedOutView();
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete link");
    }
    await loadLinks();
  } catch (err) {
    showFeedback(err.message, true);
    buttonEl.disabled = false;
    buttonEl.textContent = "Delete";
  }
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
        <article class="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
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
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <span class="rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300">
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
              data-qr-slug="${escapeHtml(link.slug)}"
              data-qr-url="${escapeHtml(shortUrl)}"
              data-qr-title="${escapeHtml(link.title || "")}"
              class="qr-btn rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
            >
              QR Code
            </button>
            <button
              type="button"
              data-delete="${link.id}"
              class="delete-btn rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
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

  linksContainer.querySelectorAll(".qr-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openQrModal(btn.dataset.qrSlug, btn.dataset.qrUrl, btn.dataset.qrTitle);
    });
  });

  linksContainer.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteLink(btn.dataset.delete, btn));
  });
}

async function loadLinks() {
  refreshBtn.disabled = true;
  linksContainer.innerHTML = `
    <div class="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-sm text-slate-400">
      ${SPINNER_SVG}
      <span>Loading your links...</span>
    </div>
  `;

  try {
    const res = await fetch("/api/links");
    if (res.status === 401) {
      switchToLoggedOutView();
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
  } finally {
    refreshBtn.disabled = false;
  }
}

async function init() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.status === 401 || !res.ok) {
      switchToLoggedOutView();
      return;
    }
    const data = await res.json();
    if (!data.user) {
      switchToLoggedOutView();
      return;
    }
    switchToLoggedInView(data.user);
    await loadLinks();
  } catch {
    switchToLoggedOutView();
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();

  submitBtn.disabled = true;
  submitBtn.innerHTML = `${SPINNER_SVG}<span>Creating...</span>`;

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

    if (res.status === 401) {
      switchToLoggedOutView();
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to create short link");
    }

    const shortUrl = `${window.location.origin}/${data.link.slug}`;
    showCreatedFeedback(data.link, shortUrl);
    form.reset();
    await loadLinks();
  } catch (err) {
    showFeedback(err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "<span>Shorten URL</span>";
  }
});

qrDownloadBtn.addEventListener("click", () => {
  if (!activeQrSlug) return;
  const link = document.createElement("a");
  link.download = `${activeQrSlug}-qrcode.png`;
  link.href = qrCanvas.toDataURL("image/png");
  link.click();
});

qrCloseBtn.addEventListener("click", closeQrModal);
qrCloseX.addEventListener("click", closeQrModal);
qrModal.addEventListener("click", (e) => {
  if (e.target === qrModal) {
    closeQrModal();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !qrModal.classList.contains("hidden")) {
    closeQrModal();
  }
});

refreshBtn.addEventListener("click", loadLinks);
init();
