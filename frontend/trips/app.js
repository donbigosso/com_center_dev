import { onClick } from "../functions/EventFunctions.js";
import { showLoginModal } from "../functions/NewModalMethods.js";
import { handleAutoLogin, handleLogout } from "../functions/LoginFunctions.js";
import {
  getSessionToken,
  initApiAddressCache,
  initFileSettingsCache,
  showFeedback,
} from "../functions/CustomFunctions.js";
import { getUserByToken, verifySession } from "../functions/RequestFunctions.js";
import { getGalleryFolder } from "../functions/GalleryFunctions.js";
import {
  deletePost,
  listPageMedia,
  listPosts,
  reorderPagePosts,
  renderPostCardWithMedia,
} from "../functions/PostFunctions.js";
import { createButton, createDIV } from "../functions/PageAppearance.js";

const TRIP_PAGE = "TRIP";
const CAROUSEL_SIZE = 5;

let arrangeMode = false;
let sessionUser = null;
let listGeneration = 0;

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
  edit.href = `../edit_post.html?post_id=${encodeURIComponent(post.post_id)}&return=trips/`;
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

function setArrangeUi(active) {
  arrangeMode = active;
  document.body.classList.toggle("is-arranging", active);
  document.getElementById("trips-arrange-bar")?.classList.toggle("d-none", !active);
  document.querySelectorAll("#trips-arrange-btn, #trips-arrange-btn-overlay").forEach((el) => {
    el.disabled = active;
  });
  document.querySelectorAll(".trips-add-post-link").forEach((el) => {
    el.classList.toggle("is-locked", active);
    if (active) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
  });
}

/** Load every trip post. Arrange mode needs the full list, not one page. */
async function fetchAllTripPosts() {
  const all = [];
  let page = 1;
  for (;;) {
    const response = await listPosts({ page, limit: 100, onPage: TRIP_PAGE });
    if (!response?.success) {
      return { success: false, error: response?.error || "Could not load trips.", posts: all };
    }
    const posts = response.data?.posts || [];
    all.push(...posts);
    if (!response.data?.has_more || posts.length === 0) {
      return { success: true, error: "", posts: all };
    }
    page += 1;
  }
}

function renumberTripCards() {
  const cards = Array.from(document.querySelectorAll("#trips-posts-list .trips-post--arrange"));
  cards.forEach((card, index) => {
    const badge = card.querySelector(".trips-arrange-number");
    if (badge) badge.textContent = String(index + 1);
    const up = card.querySelector(".trips-arrange-up");
    const down = card.querySelector(".trips-arrange-down");
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === cards.length - 1;
  });
}

function moveTripCard(card, direction) {
  const sibling = direction < 0 ? card.previousElementSibling : card.nextElementSibling;
  if (!sibling?.classList.contains("trips-post--arrange") || !card.parentNode) return;
  if (direction < 0) {
    card.parentNode.insertBefore(card, sibling);
  } else {
    card.parentNode.insertBefore(sibling, card);
  }
  renumberTripCards();
}

function createArrangeArrow(iconClass, label, onClick) {
  const button = createButton("button", "", "btn btn-sm cc-btn-ghost");
  button.title = label;
  button.setAttribute("aria-label", label);
  const icon = document.createElement("i");
  icon.className = iconClass;
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return button;
}

function createArrangeControls(card) {
  const bar = createDIV("trips-arrange-controls");
  const number = document.createElement("span");
  number.className = "trips-arrange-number";

  const up = createArrangeArrow("bi bi-arrow-up", "Move earlier", () => moveTripCard(card, -1));
  up.classList.add("trips-arrange-up");
  const down = createArrangeArrow("bi bi-arrow-down", "Move later", () => moveTripCard(card, 1));
  down.classList.add("trips-arrange-down");

  bar.append(number, up, down);
  return bar;
}

async function appendTripPost(list, post, user, { arrange = false } = {}) {
  const card = await renderPostCardWithMedia(post);
  card.dataset.postId = String(post.post_id);
  if (arrange) {
    card.classList.add("trips-post--arrange");
    card.prepend(createArrangeControls(card));
  } else {
    addPostActions(card, post, user, async () => {
      await renderTripPosts(user);
      await loadCarousel();
    });
  }
  list.appendChild(card);
}

function showTripListMessage(list, text, { warning = false } = {}) {
  list.replaceChildren();
  const node = document.createElement(warning ? "div" : "p");
  node.className = warning ? "alert alert-warning" : "create-post-empty";
  node.textContent = text;
  list.appendChild(node);
}

async function renderTripPosts(user) {
  const list = document.getElementById("trips-posts-list");
  if (!list) return;

  const generation = ++listGeneration;
  setArrangeUi(false);
  showTripListMessage(list, "Loading trips…");

  const result = await fetchAllTripPosts();
  if (generation !== listGeneration) return;

  if (!result.success) {
    showTripListMessage(list, result.error, { warning: true });
    return;
  }

  if (result.posts.length === 0) {
    showTripListMessage(list, "No trip posts yet.");
    return;
  }

  list.replaceChildren();
  for (const post of result.posts) {
    if (generation !== listGeneration) return;
    await appendTripPost(list, post, user);
  }
}

async function enterArrangeMode() {
  if (arrangeMode) return;

  const sessionOk = await verifySession();
  if (!sessionOk) {
    showFeedback("You must be logged in");
    return;
  }

  const list = document.getElementById("trips-posts-list");
  if (!list) return;

  const generation = ++listGeneration;
  showTripListMessage(list, "Loading trips…");
  const result = await fetchAllTripPosts();
  if (generation !== listGeneration) return;

  if (!result.success) {
    showTripListMessage(list, result.error, { warning: true });
    showFeedback(result.error);
    return;
  }

  if (result.posts.length < 2) {
    showFeedback("Add at least two posts to arrange them");
    await renderTripPosts(sessionUser);
    return;
  }

  list.replaceChildren();
  for (const post of result.posts) {
    if (generation !== listGeneration) return;
    await appendTripPost(list, post, sessionUser, { arrange: true });
  }
  if (generation !== listGeneration) return;
  setArrangeUi(true);
  renumberTripCards();
  document.getElementById("trips-arrange-bar")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function cancelArrangeMode() {
  if (!arrangeMode) return;
  await renderTripPosts(sessionUser);
}

async function saveArrangeMode() {
  if (!arrangeMode) return;

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    showFeedback("You must be logged in");
    return;
  }

  const order = Array.from(document.querySelectorAll("#trips-posts-list .trips-post--arrange"))
    .map((card) => Number(card.dataset.postId))
    .filter((id) => id > 0);

  const saveBtn = document.getElementById("trips-arrange-save-btn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    const response = await reorderPagePosts(TRIP_PAGE, order, sessionToken);
    if (!response?.success) {
      showFeedback(response?.error || "Failed to save order");
      return;
    }
    showFeedback("Order saved");
    await renderTripPosts(sessionUser);
  } catch (err) {
    console.error("Save trip order error:", err);
    showFeedback("Failed to save order");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
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
    sessionUser = await getSessionUserInfo();
    await loadCarousel();
    await renderTripPosts(sessionUser);
  })();

  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (event) => {
      event.preventDefault();
      handler();
    });
  };

  bind("trips-arrange-btn", () => {
    enterArrangeMode();
  });
  bind("trips-arrange-btn-overlay", () => {
    enterArrangeMode();
  });
  bind("trips-arrange-save-btn", () => {
    saveArrangeMode();
  });
  bind("trips-arrange-cancel-btn", () => {
    cancelArrangeMode();
  });

  document.querySelectorAll(".trips-add-post-link").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (el.classList.contains("is-locked")) event.preventDefault();
    });
  });

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
