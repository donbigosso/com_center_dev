import { onClick } from "./functions/EventFunctions.js";
import { showLoginModal } from "./functions/NewModalMethods.js";
import { handleAutoLogin, handleLogout } from "./functions/LoginFunctions.js";
import {
  getSessionToken,
  initApiAddressCache,
  initFileSettingsCache,
  showFeedback,
} from "./functions/CustomFunctions.js";
import { getUserByToken, verifySession } from "./functions/RequestFunctions.js";
import { getGalleryFolder } from "./functions/GalleryFunctions.js";
import {
  deletePost,
  listPageMedia,
  listPosts,
  renderPostCardWithMedia,
} from "./functions/PostFunctions.js";
import { createButton, createDIV } from "./functions/PageAppearance.js";

const TRIP_PAGE = "TRIP";
const CAROUSEL_SIZE = 5;

function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function getSessionUserInfo() {
  const token = getSessionToken();
  if (!token) return null;
  const response = await getUserByToken(token);
  if (!response?.success || !response.data?.user_found) {
    return null;
  }
  return {
    name: String(response.data.user_found),
    isAdmin: Boolean(response.data.is_admin),
  };
}

function canManagePost(user, post) {
  if (!user || !post) return false;
  if (user.isAdmin) return true;
  return Boolean(post.author) && user.name === post.author;
}

function pickCarouselMedia(media) {
  const pictures = (Array.isArray(media) ? media : []).filter(
    (item) => item?.filename
  );
  return shuffle(pictures).slice(0, CAROUSEL_SIZE);
}

function mountCarousel(items, folder) {
  const section = document.getElementById("trips-carousel-section");
  const hero = document.getElementById("trips-hero-text");
  const inner = document.getElementById("trips-carousel-inner");
  const indicators = document.getElementById("trips-carousel-indicators");
  const prev = document.getElementById("trips-carousel-prev");
  const next = document.getElementById("trips-carousel-next");

  if (!section || !inner || !indicators) return;

  inner.replaceChildren();
  indicators.replaceChildren();

  if (!items.length || !folder) {
    section.classList.add("d-none");
    if (hero) hero.classList.remove("d-none");
    return;
  }

  items.forEach((item, index) => {
    const slide = document.createElement("div");
    slide.className = `carousel-item${index === 0 ? " active" : ""}`;

    const img = document.createElement("img");
    img.className = "trips-carousel-img";
    img.src = `${folder}${encodeURIComponent(item.filename)}`;
    img.alt = item.title || "Trip picture";
    img.loading = index === 0 ? "eager" : "lazy";
    slide.appendChild(img);
    inner.appendChild(slide);

    if (items.length > 1) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("data-bs-target", "#trips-carousel");
      dot.setAttribute("data-bs-slide-to", String(index));
      dot.setAttribute("aria-label", `Slide ${index + 1}`);
      if (index === 0) {
        dot.classList.add("active");
        dot.setAttribute("aria-current", "true");
      }
      indicators.appendChild(dot);
    }
  });

  const showControls = items.length > 1;
  if (prev) prev.classList.toggle("d-none", !showControls);
  if (next) next.classList.toggle("d-none", !showControls);
  indicators.classList.toggle("d-none", !showControls);

  if (hero) hero.classList.add("d-none");
  section.classList.remove("d-none");
}

function addPostActions(card, post, user, onDeleted) {
  if (!canManagePost(user, post)) return;

  const actions = createDIV("trips-post-actions");
  const edit = document.createElement("a");
  edit.className = "btn btn-sm cc-btn-ghost";
  edit.href = `edit_post.html?post_id=${encodeURIComponent(post.post_id)}&return=trips.html`;
  edit.innerHTML = '<i class="bi bi-pencil"></i> Edit';

  const remove = createButton("button", "Remove", "btn btn-sm cc-btn-outline");
  remove.addEventListener("click", async () => {
    const ok = window.confirm(
      `Delete post #${post.post_id}${post.topic ? ` (“${post.topic}”)` : ""}? This cannot be undone.`
    );
    if (!ok) return;
    const sessionOk = await verifySession();
    if (!sessionOk) {
      showFeedback("You must be logged in");
      return;
    }
    const response = await deletePost(post.post_id, getSessionToken());
    if (!response?.success) {
      showFeedback(response?.error || "Could not delete post");
      return;
    }
    showFeedback("Post deleted");
    if (typeof onDeleted === "function") {
      await onDeleted();
    }
  });

  actions.appendChild(edit);
  actions.appendChild(remove);
  card.appendChild(actions);
}

async function renderTripPosts(user) {
  const list = document.getElementById("trips-posts-list");
  if (!list) return;

  list.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "create-post-empty";
  loading.textContent = "Loading trips…";
  list.appendChild(loading);

  const response = await listPosts({ page: 1, limit: 50, onPage: TRIP_PAGE });
  const posts = response?.data?.posts || [];

  list.replaceChildren();
  if (!response?.success) {
    const err = document.createElement("div");
    err.className = "alert alert-warning";
    err.textContent = response?.error || "Could not load trips.";
    list.appendChild(err);
    return;
  }

  if (posts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "create-post-empty";
    empty.textContent = "No trip posts yet.";
    list.appendChild(empty);
    return;
  }

  for (const post of posts) {
    const card = await renderPostCardWithMedia(post);
    addPostActions(card, post, user, async () => {
      await renderTripPosts(user);
      await loadCarousel();
    });
    list.appendChild(card);
  }
}

async function loadCarousel() {
  const folder = await getGalleryFolder();
  const response = await listPageMedia(TRIP_PAGE);
  const media = response?.success ? response.data?.media || [] : [];
  mountCarousel(pickCarouselMedia(media), folder);
}

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await initApiAddressCache();
    await initFileSettingsCache();
    await handleAutoLogin();
    const user = await getSessionUserInfo();
    await loadCarousel();
    await renderTripPosts(user);
  })();

  const loginButton = document.querySelector("#login-btn");
  const logoutButton = document.querySelector("#logout-btn");

  onClick(loginButton, () => {
    showLoginModal();
  });

  onClick(logoutButton, async () => {
    handleLogout();
    location.reload();
  });

  window.addEventListener("auth:login", () => {
    location.reload();
  });
});
