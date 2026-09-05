import { onClick } from "./functions/EventFunctions.js";
import { showLoginModal } from "./functions/NewModalMethods.js";
import { handleAutoLogin, handleLogout } from "./functions/LoginFunctions.js";
import { initApiAddressCache, initFileSettingsCache } from "./functions/CustomFunctions.js";
import {
  POST_PAGE_ENUMS,
  createPostForm,
  listPostPages,
  listPosts,
  renderPostCardWithMedia,
} from "./functions/PostFunctions.js";

const PAGE_TITLES = {
  TRIP: "Trips",
  BLOG: "Blog",
  ABOUT: "About",
};

function parseCreatePostParams() {
  const params = new URLSearchParams(window.location.search);
  let page = params.get("page");
  let includeMediaRaw = params.get("include_media") || params.get("inclde_media");

  // Tolerate ?page=TRIP?include_media=yes (second ? instead of &)
  if (page && page.includes("?")) {
    const [pagePart, rest] = page.split("?", 2);
    page = pagePart;
    const extra = new URLSearchParams(rest);
    if (!includeMediaRaw) {
      includeMediaRaw = extra.get("include_media") || extra.get("inclde_media");
    }
  }

  const pageEnum = String(page || "").trim().toUpperCase();
  const includeMedia = ["yes", "1", "true"].includes(
    String(includeMediaRaw || "no").trim().toLowerCase()
  );

  return { page: pageEnum, includeMedia };
}

async function resolveAllowedPages() {
  try {
    const response = await listPostPages();
    const pages = response?.data?.pages;
    if (response?.success && Array.isArray(pages) && pages.length > 0) {
      return pages.map((value) => String(value).toUpperCase());
    }
  } catch (err) {
    console.error("list_post_pages failed:", err);
  }
  return [...POST_PAGE_ENUMS];
}

function showParamAlert(message) {
  const alert = document.getElementById("create-post-param-alert");
  if (!alert) return;
  alert.textContent = message;
  alert.classList.remove("d-none");
}

function applyPageHeadings(pageEnum, includeMedia) {
  const title = PAGE_TITLES[pageEnum] || pageEnum;
  const docTitle = document.querySelector("title");
  const eyebrow = document.getElementById("create-post-eyebrow");
  const heading = document.getElementById("create-post-title");
  const lead = document.getElementById("create-post-lead");
  const formLead = document.getElementById("create-post-form-lead");
  const listHeading = document.getElementById("create-post-list-heading");

  if (docTitle) docTitle.textContent = `Donbigosso — ${title}`;
  if (eyebrow) eyebrow.textContent = "Create post";
  if (heading) heading.textContent = title;
  if (lead) {
    lead.textContent = includeMedia
      ? `New posts on ${title}, with up to 5 pictures.`
      : `New posts on ${title}.`;
  }
  if (formLead) {
    formLead.textContent = includeMedia
      ? "Topic, content, and optional pictures (caption only)."
      : "Topic and content. Pictures are off for this page.";
  }
  if (listHeading) listHeading.textContent = `Recent posts · ${title}`;
}

async function renderPagePosts(container, pageEnum) {
  if (!(container instanceof HTMLElement)) return;

  container.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "create-post-empty";
  loading.textContent = "Loading posts…";
  container.appendChild(loading);

  const response = await listPosts({ page: 1, limit: 20, onPage: pageEnum });
  const posts = response?.data?.posts || [];

  container.replaceChildren();
  if (!response?.success) {
    const err = document.createElement("div");
    err.className = "alert alert-warning";
    err.textContent = response?.error || "Could not load posts.";
    container.appendChild(err);
    return;
  }

  if (posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "create-post-empty";
    empty.textContent = "No posts on this page yet.";
    container.appendChild(empty);
    return;
  }

  for (const post of posts) {
    container.appendChild(await renderPostCardWithMedia(post));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await initApiAddressCache();
    await initFileSettingsCache();
    await handleAutoLogin();

    const { page, includeMedia } = parseCreatePostParams();
    const allowedPages = await resolveAllowedPages();
    const formSlot = document.getElementById("create-post-form-slot");
    const listSlot = document.getElementById("create-post-list");

    if (!page || !allowedPages.includes(page)) {
      showParamAlert(
        `Missing or invalid page. Open this screen with ?page=TRIP|BLOG|ABOUT and optional &include_media=yes.`
      );
      const compose = document.getElementById("create-post-compose");
      if (compose) compose.classList.add("d-none");
      applyPageHeadings("Create", false);
      if (listSlot) {
        listSlot.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "create-post-empty";
        empty.textContent = "Choose a valid page parameter to see posts.";
        listSlot.appendChild(empty);
      }
      return;
    }

    applyPageHeadings(page, includeMedia);

    if (formSlot) {
      createPostForm(formSlot, {
        page,
        includeMedia,
        onCreated: async () => {
          await renderPagePosts(listSlot, page);
        },
      });
    }

    await renderPagePosts(listSlot, page);
  })();

  const loginButton = document.querySelector("#login-btn");
  const logoutButton = document.querySelector("#logout-btn");

  onClick(loginButton, () => {
    showLoginModal();
  });

  onClick(logoutButton, async () => {
    handleLogout();
  });
});
