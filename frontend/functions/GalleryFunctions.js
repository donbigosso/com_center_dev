import {
  fetchAPIdataWGetParams,
  POSTJSONRequest,
  getUrlParam,
  getSetting,
  createInfiniteScroller,
} from "./CoreFunctions.js";
import { verifySession } from "./RequestFunctions.js";
import { getSessionToken, showFeedback } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import {
  newHideModal,
  createHTMLelement,
  createDIV,
  createLabel,
  createButton,
  createBootstrapTextInput,
  adjustElementClassAndText,
  createBootstrapTextArea,
} from "./PageAppearance.js";
import { getCookie } from "./CookieFunctions.js";
import { VALIDATION_CONSTRAINTS, validateGallery } from "./FormValidation.js";

// Pagination state
let currentPage = 1;
const pageSize = 12;
const picturePreviewPageSize = 20;
let allGalleries = [];
let currentLoggedUser = null;
let isLoading = false;
let hasMorePages = true;
let infiniteScrollReady = false;
let ownerFilter = undefined;
let cachedGalleryFolder = null;

// Preview page state
let currentPreviewGallery = null;
let galleryPicturesScroller = null;
/** @type {Array<{id:number,title:string,caption:string,url:string|null,fullUrl:string|null}>} */
let loadedGalleryPictures = [];
let lightboxIndex = -1;
let lightboxKeyHandler = null;
/** Whether the logged-in user owns the gallery currently open in preview. */
let previewIsOwner = false;
/** Optional deep-link picture id from ?picid= */
let pendingDeepLinkPicId = null;

export function getOwnerFilterFromUrl() {
  const raw = getUrlParam("user");
  if (raw === null || raw === undefined) return null;
  const username = String(raw).trim();
  return username === "" ? null : username;
}

function ensureOwnerFilterLoaded() {
  if (ownerFilter === undefined) {
    ownerFilter = getOwnerFilterFromUrl();
    updatePageHeadingsForFilter(ownerFilter);
  }
  return ownerFilter;
}

/**
 * Update page headings when viewing a specific user's galleries.
 */
function updatePageHeadingsForFilter(username) {
  const heading = document.getElementById("galleries-heading");
  const subtitle = document.getElementById("galleries-subtitle");

  if (username) {
    if (heading) heading.textContent = `Galleries by ${username}`;
    if (subtitle) {
      subtitle.textContent = `Showing collections owned by ${username}.`;
    }
  }
}

// Dark metallic palette for cover tiles (SpaceX-inspired; no cover color column in DB yet)
const COVER_COLORS = [
  "#1a1a1a", "#2a2a2a", "#0f172a", "#1e293b", "#292524",
  "#18181b", "#1c1917", "#0c1222", "#3f3f46", "#27272a",
  "#1f1f1f", "#111827", "#1e1b4b", "#164e63", "#3b1f1f"
];

function coverColorForId(id) {
  const n = Number(id) || 0;
  return COVER_COLORS[Math.abs(n) % COVER_COLORS.length];
}

// Get logged-in user (set during init)
async function getLoggedUser({ force = false } = {}) {
  if (!force && currentLoggedUser) return currentLoggedUser;

  const token = getCookie("session_token");
  if (!token) {
    currentLoggedUser = null;
    return null;
  }

  try {
    const response = await POSTJSONRequest({ request: "get_user_by_token", token });
    if (response?.success && response.data?.user_found) {
      currentLoggedUser = response.data.user_found;
      return currentLoggedUser;
    }
  } catch (err) {
    console.error("Error fetching logged user:", err);
  }
  currentLoggedUser = null;
  return null;
}

/**
 * After login/logout on preview_gallery.html: refresh owner tools, add-picture
 * controls, and per-tile edit/delete without a full page reload.
 */
export async function refreshGalleryPreviewAuthUI() {
  if (!currentPreviewGallery?.id) return;

  const loggedUser = await getLoggedUser({ force: true });
  const wasOwner = previewIsOwner;
  previewIsOwner = Boolean(
    loggedUser &&
      currentPreviewGallery.owner &&
      loggedUser === currentPreviewGallery.owner
  );

  // Banner: show/hide owner tools (Edit + Add picture)
  const coverUrl =
    currentPreviewGallery.cover_url !== undefined
      ? currentPreviewGallery.cover_url
      : await fetchGalleryCoverFullUrl(currentPreviewGallery.id);
  if (currentPreviewGallery.cover_url === undefined) {
    currentPreviewGallery.cover_url = coverUrl;
  }
  renderGalleryPreviewBanner(
    currentPreviewGallery,
    coverUrl || null,
    previewIsOwner
  );

  // Rebuild picture grid so owner action icons + end add-tile match auth state
  if (wasOwner !== previewIsOwner) {
    const galleryId = currentPreviewGallery.id;
    // Preserve deep-link only if lightbox is open
    if (lightboxIndex < 0) {
      pendingDeepLinkPicId = null;
    }
    await startGalleryPicturesScroller(galleryId);
  } else {
    ensureAddPictureTileAtEnd();
  }
}

/**
 * Normalize one gallery row from the API for the card UI.
 */
function mapGalleryFromApi(raw) {
  const id = Number(raw.id);
  return {
    id,
    title: raw.title || "Untitled gallery",
    description: raw.description || "",
    owner: raw.owner || null,
    image_count: Number(raw.image_count) || 0,
    register_date: raw.register_date || null,
    collection_cover_id: raw.collection_cover_id ?? null,
    // undefined = not loaded yet; null = loaded but no cover; string = cover image URL
    cover_url: undefined,
  };
}

/**
 * Find a gallery by id from the list page cache or the open preview.
 * @param {number} galleryId
 * @returns {object|null}
 */
function resolveGallery(galleryId) {
  const id = Number(galleryId);
  const fromList = allGalleries.find((g) => g.id === id);
  if (fromList) return fromList;
  if (currentPreviewGallery && currentPreviewGallery.id === id) {
    return currentPreviewGallery;
  }
  return null;
}

/**
 * Apply updated gallery fields into list cache + preview state.
 * @param {object} updated mapped gallery from API
 */
function applyGalleryUpdateLocally(updated) {
  if (!updated || !updated.id) return;

  const idx = allGalleries.findIndex((g) => g.id === updated.id);
  if (idx >= 0) {
    // Preserve already-fetched cover_url if still same cover id
    const prev = allGalleries[idx];
    allGalleries[idx] = {
      ...prev,
      ...updated,
      cover_url:
        prev.collection_cover_id === updated.collection_cover_id
          ? prev.cover_url
          : undefined,
    };
  }

  if (currentPreviewGallery && currentPreviewGallery.id === updated.id) {
    currentPreviewGallery = {
      ...currentPreviewGallery,
      ...updated,
      cover_url:
        currentPreviewGallery.collection_cover_id === updated.collection_cover_id
          ? currentPreviewGallery.cover_url
          : undefined,
    };
  }
}

/**
 * Format API datetime for <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
 * @param {string|null|undefined} value
 * @returns {string}
 */
function toDatetimeLocalValue(value) {
  if (!value) return "";
  const str = String(value).trim().replace(" ", "T");
  // "2026-07-24T09:15:34" → "2026-07-24T09:15"
  if (str.length >= 16) return str.slice(0, 16);
  return str;
}

/**
 * Normalize datetime-local / date string for API (YYYY-MM-DD HH:MM:SS).
 * @param {string} value
 * @returns {string}
 */
function fromDatetimeLocalValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let out = raw.replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2}$/.test(out)) {
    out = `${out} 00:00:00`;
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(out)) {
    out = `${out}:00`;
  }
  return out;
}

/**
 * Base URL for media files (trailing slash), from settings.json gallery_folder.
 */
async function getGalleryFolder() {
  if (cachedGalleryFolder) return cachedGalleryFolder;

  const folder = await getSetting("gallery_folder");
  if (!folder) {
    console.error("gallery_folder is not defined in settings.");
    return null;
  }

  cachedGalleryFolder = String(folder).endsWith("/")
    ? String(folder)
    : `${folder}/`;
  return cachedGalleryFolder;
}

/**
 * Resolve cover miniature URL for a gallery via get_gallery_cover_miniature_filename.
 * Caches the result on the gallery object (cover_url).
 * @param {object} gallery
 * @returns {Promise<string|null>}
 */
async function ensureGalleryCoverUrl(gallery) {
  if (!gallery) return null;
  if (gallery.cover_url !== undefined) return gallery.cover_url;

  // No cover media assigned — skip API call
  if (!gallery.collection_cover_id) {
    gallery.cover_url = null;
    return null;
  }

  try {
    const response = await fetchAPIdataWGetParams({
      request: "get_gallery_cover_miniature_filename",
      id: gallery.id,
    });

    const filename = response?.success ? response?.data?.filename : null;
    if (!filename) {
      gallery.cover_url = null;
      return null;
    }

    const folder = await getGalleryFolder();
    if (!folder) {
      gallery.cover_url = null;
      return null;
    }

    gallery.cover_url = `${folder}${encodeURIComponent(filename)}`;
    return gallery.cover_url;
  } catch (err) {
    console.error(`Error fetching cover for gallery ${gallery.id}:`, err);
    gallery.cover_url = null;
    return null;
  }
}

/**
 * Prefetch cover URLs for a list of galleries (parallel).
 */
async function prefetchGalleryCovers(galleries) {
  if (!Array.isArray(galleries) || galleries.length === 0) return;
  await Promise.all(galleries.map((gallery) => ensureGalleryCoverUrl(gallery)));
}

/**
 * Build absolute media URL from a filename using gallery_folder.
 * @param {string|null|undefined} filename
 * @returns {Promise<string|null>}
 */
async function buildMediaUrl(filename) {
  if (!filename) return null;
  const folder = await getGalleryFolder();
  if (!folder) return null;
  return `${folder}${encodeURIComponent(filename)}`;
}

/**
 * Derive miniature filename (Image_00001.jpeg → Image_00001_sm.jpeg).
 * @param {string} filename
 * @returns {string|null}
 */
function toMiniatureFilename(filename) {
  if (!filename) return null;
  const str = String(filename);
  const lastDot = str.lastIndexOf(".");
  if (lastDot <= 0) return `${str}_sm`;
  return `${str.slice(0, lastDot)}_sm${str.slice(lastDot)}`;
}

/**
 * Parse gallery id from ?id= query param.
 * @returns {number|null}
 */
export function getGalleryIdFromUrl() {
  const raw = getUrlParam("id");
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const id = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

/**
 * Parse picture id from ?picid= query param.
 * @returns {number|null}
 */
export function getPictureIdFromUrl() {
  const raw = getUrlParam("picid");
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const id = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

/**
 * Update browser URL for gallery preview (and optional picture deep-link).
 * @param {number} galleryId
 * @param {number|null} [picId]
 */
function setPreviewUrl(galleryId, picId = null) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("id", String(galleryId));
    if (picId) {
      url.searchParams.set("picid", String(picId));
    } else {
      url.searchParams.delete("picid");
    }
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch (err) {
    // Ignore history errors (e.g. file://)
  }
}

/**
 * Redirect to the main galleries listing page.
 */
function redirectToGalleriesIndex() {
  window.location.replace("index.html");
}

/**
 * Create a small floating icon action bar (edit / delete).
 * @param {Array<{className:string,icon:string,title:string,onClick:Function}>} actions
 * @returns {HTMLElement}
 */
function createTileActionBar(actions) {
  const bar = createDIV("tile-action-bar");
  actions.forEach((action) => {
    const btn = createButton(
      "button",
      "",
      `btn tile-action-btn ${action.className || ""}`.trim()
    );
    btn.type = "button";
    btn.title = action.title || "";
    btn.setAttribute("aria-label", action.title || "Action");
    const icon = document.createElement("i");
    icon.className = action.icon;
    btn.appendChild(icon);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof action.onClick === "function") action.onClick(e);
    });
    bar.appendChild(btn);
  });
  return bar;
}

/**
 * Map a list_gallery_media / get_gallery_media_item row to UI item shape.
 * @param {object} raw
 * @param {string|null} folder
 */
function mapMediaItemFromApi(raw, folder) {
  const miniName =
    raw.miniature_filename || toMiniatureFilename(raw.filename) || raw.filename;
  const fullName = raw.filename || null;
  const url =
    folder && miniName ? `${folder}${encodeURIComponent(miniName)}` : null;
  const fullUrl =
    folder && fullName ? `${folder}${encodeURIComponent(fullName)}` : url;

  return {
    id: Number(raw.id) || 0,
    title: raw.title || "Untitled",
    caption: raw.description || "",
    url,
    fullUrl,
    filename: fullName,
    media_type: raw.media_type || null,
  };
}

/**
 * Fetch a single gallery by id via get_gallery.
 * @param {number} galleryId
 * @returns {Promise<object|null>}
 */
async function fetchGalleryById(galleryId) {
  try {
    const response = await fetchAPIdataWGetParams({
      request: "get_gallery",
      id: galleryId,
    });

    if (!response?.success || !response?.data?.gallery) {
      console.error("get_gallery error:", response?.error || response?.message);
      return null;
    }

    return mapGalleryFromApi(response.data.gallery);
  } catch (err) {
    console.error("Error fetching gallery:", err);
    return null;
  }
}

/**
 * Full-resolution cover URL via get_gallery_cover_filename.
 * @param {number} galleryId
 * @returns {Promise<string|null>}
 */
async function fetchGalleryCoverFullUrl(galleryId) {
  try {
    const response = await fetchAPIdataWGetParams({
      request: "get_gallery_cover_filename",
      id: galleryId,
    });
    const filename = response?.success ? response?.data?.filename : null;
    return buildMediaUrl(filename);
  } catch (err) {
    console.error(`Error fetching full cover for gallery ${galleryId}:`, err);
    return null;
  }
}

/**
 * Fetch one page of gallery media for the infinite scroller.
 * @param {number} galleryId
 * @param {number} page
 * @param {number} pageSizeArg
 * @returns {Promise<{items: Array, hasMore: boolean}>}
 */
async function fetchGalleryMediaPage(galleryId, page, pageSizeArg = picturePreviewPageSize) {
  try {
    const response = await fetchAPIdataWGetParams({
      request: "list_gallery_media",
      id: galleryId,
      page,
      limit: pageSizeArg,
    });

    if (!response?.success) {
      console.error("list_gallery_media error:", response?.error || response?.message);
      return { items: [], hasMore: false };
    }

    const data = response.data || {};
    const folder = await getGalleryFolder();
    const media = Array.isArray(data.media) ? data.media : [];

    const items = media
      .map((raw) => mapMediaItemFromApi(raw, folder))
      .filter((item) => item.url);

    return {
      items,
      hasMore: Boolean(data.has_more),
    };
  } catch (err) {
    console.error("Error fetching gallery media:", err);
    return { items: [], hasMore: false };
  }
}

/**
 * Fetch one page of galleries from media_collections via the API.
 * @param {number} page 1-based page index
 * @returns {Promise<{galleries: Array, has_more: boolean, total: number}>}
 */
async function fetchGalleriesFromAPI(page = 1) {
  try {
    const params = {
      request: "list_galleries",
      page,
      limit: pageSize,
    };
    if (ownerFilter) {
      params.user = ownerFilter;
    }

    const response = await fetchAPIdataWGetParams(params);

    if (!response) {
      console.error("No response from list_galleries");
      return { galleries: [], has_more: false, total: 0 };
    }

    if (!response.success) {
      console.error("list_galleries error:", response.error || response.message);
      return { galleries: [], has_more: false, total: 0 };
    }

    const data = response.data || {};
    const galleries = Array.isArray(data.galleries)
      ? data.galleries.map(mapGalleryFromApi)
      : [];

    return {
      galleries,
      has_more: Boolean(data.has_more),
      total: Number(data.total) || 0,
      page: Number(data.page) || page,
    };
  } catch (err) {
    console.error("Error fetching galleries:", err);
    return { galleries: [], has_more: false, total: 0 };
  }
}

/**
 * Load next page of galleries (or first page on init).
 * First 12 results, then more on scroll.
 * Honors ?user=username from the URL for owner filtering.
 */
export async function loadGalleries() {
  if (isLoading || !hasMorePages) return;

  ensureOwnerFilterLoaded();

  isLoading = true;
  const spinner = document.getElementById("loading-spinner");
  if (spinner) spinner.classList.remove("d-none");

  const isFirstPage = currentPage === 1;
  const result = await fetchGalleriesFromAPI(currentPage);
  const galleries = result.galleries;

  if (isFirstPage) {
    allGalleries = galleries;
  } else {
    allGalleries = [...allGalleries, ...galleries];
  }

  hasMorePages = result.has_more && galleries.length > 0;
  if (galleries.length > 0) {
    currentPage += 1;
  } else {
    hasMorePages = false;
  }

  isLoading = false;
  if (spinner) spinner.classList.add("d-none");

  if (isFirstPage) {
    await renderGalleries(allGalleries, { replace: true });
  } else {
    await renderGalleries(galleries, { replace: false });
  }

  if (!infiniteScrollReady) {
    setupInfiniteScroll();
    infiniteScrollReady = true;
  }

  if (isFirstPage && allGalleries.length === 0) {
    showEmptyState();
  }
}

function showEmptyState() {
  const grid = document.getElementById("galleries-grid");
  if (!grid || grid.children.length > 0) return;

  const message = ownerFilter
    ? `No galleries found for user "${ownerFilter}".`
    : "No galleries found yet. Create the first collection.";

  const col = createDIV("col-12");
  const empty = createDIV("gallery-empty");

  const icon = document.createElement("i");
  icon.className = "bi bi-images";

  const title = document.createElement("span");
  title.className = "gallery-empty-title";
  title.textContent = "Empty archive";

  const text = document.createElement("p");
  text.className = "gallery-empty-text";
  text.textContent = message;

  empty.appendChild(icon);
  empty.appendChild(title);
  empty.appendChild(text);
  col.appendChild(empty);

  grid.appendChild(col);
}

/**
 * Render gallery tiles.
 * @param {Array} galleries Rows to render
 * @param {{replace?: boolean}} options replace=true clears the grid first
 */
async function renderGalleries(galleries, options = { replace: true }) {
  const grid = document.getElementById("galleries-grid");
  if (!grid) return;

  const loggedUser = await getLoggedUser();
  await prefetchGalleryCovers(galleries);

  if (options.replace) {
    grid.innerHTML = "";
  }

  // Remove empty-state placeholder if appending real cards
  if (!options.replace) {
    const empty = grid.querySelector(".gallery-empty, .alert");
    if (empty) empty.closest(".col-12")?.remove();
  }

  const fragment = document.createDocumentFragment();

  galleries.forEach(gallery => {
    fragment.appendChild(createGalleryCard(gallery, loggedUser));
  });

  grid.appendChild(fragment);

  attachGalleryActionHandlers(grid);
}

/**
 * Build a meta chip (icon + label) for gallery cards.
 */
function createGalleryMetaItem(iconClass, label, valueText) {
  const item = createDIV("gallery-meta-item");
  const icon = document.createElement("i");
  icon.className = iconClass;
  item.appendChild(icon);

  if (label) {
    item.appendChild(document.createTextNode(` ${label} `));
  } else {
    item.appendChild(document.createTextNode(" "));
  }

  const value = document.createElement("strong");
  value.textContent = valueText;
  item.appendChild(value);
  return item;
}

/**
 * Build one gallery tile (the col > card structure) entirely via DOM APIs.
 */
function createGalleryCard(gallery, loggedUser) {
  const isOwner = loggedUser && gallery.owner && loggedUser === gallery.owner;
  const bgColor = coverColorForId(gallery.id);
  const coverUrl = gallery.cover_url || null;

  const col = createDIV("col-12 col-sm-6 col-lg-4");

  const card = createDIV("card gallery-tile h-100");
  card.dataset.galleryId = gallery.id;

  // Cover — real miniature when available, otherwise dark metallic placeholder
  const cover = createDIV("gallery-cover");
  cover.style.backgroundColor = bgColor;

  if (coverUrl) {
    cover.classList.add("gallery-cover--has-image");

    const coverImg = document.createElement("img");
    coverImg.className = "gallery-cover-img";
    coverImg.src = coverUrl;
    coverImg.alt = `${gallery.title || "Gallery"} cover`;
    coverImg.loading = "lazy";
    coverImg.decoding = "async";
    coverImg.addEventListener("error", () => {
      // Fall back to icon placeholder if the image fails to load
      cover.classList.remove("gallery-cover--has-image");
      coverImg.remove();
      cover.style.backgroundImage =
        `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 50%),` +
        `linear-gradient(160deg, ${bgColor} 0%, #000000 100%)`;
      const fallbackOverlay = createDIV("gallery-cover-overlay");
      const fallbackIcon = document.createElement("i");
      fallbackIcon.className = "bi bi-images";
      fallbackOverlay.appendChild(fallbackIcon);
      cover.appendChild(fallbackOverlay);
    });
    cover.appendChild(coverImg);
  } else {
    cover.style.backgroundImage =
      `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 50%),` +
      `linear-gradient(160deg, ${bgColor} 0%, #000000 100%)`;

    const overlay = createDIV("gallery-cover-overlay");
    const coverIcon = document.createElement("i");
    coverIcon.className = "bi bi-images";
    overlay.appendChild(coverIcon);
    cover.appendChild(overlay);
  }

  // Owner-only floating edit / delete icons (top-right of tile cover)
  if (isOwner) {
    cover.appendChild(
      createTileActionBar([
        {
          className: "gallery-edit-btn",
          icon: "bi bi-pencil",
          title: "Edit gallery",
          onClick: () => handleEditGallery(gallery.id),
        },
        {
          className: "gallery-delete-btn",
          icon: "bi bi-trash",
          title: "Delete gallery",
          onClick: () => handleDeleteGallery(gallery.id),
        },
      ])
    );
  }

  // Body
  const body = createDIV("card-body d-flex flex-column");

  const title = document.createElement("h5");
  adjustElementClassAndText(title, "card-title", gallery.title);

  const description = document.createElement("p");
  const descText = gallery.description || "No description";
  adjustElementClassAndText(description, "card-text flex-grow-1", descText);

  const meta = createDIV("gallery-meta");
  meta.appendChild(
    createGalleryMetaItem(
      "bi bi-person",
      "",
      gallery.owner || "Unknown"
    )
  );
  meta.appendChild(
    createGalleryMetaItem(
      "bi bi-image",
      "",
      `${gallery.image_count} images`
    )
  );

  if (gallery.register_date) {
    meta.appendChild(
      createGalleryMetaItem(
        "bi bi-calendar3",
        "",
        String(gallery.register_date).slice(0, 10)
      )
    );
  }

  body.appendChild(title);
  body.appendChild(description);
  body.appendChild(meta);

  card.appendChild(cover);
  card.appendChild(body);

  // Open gallery preview when clicking the card (action icons stop propagation)
  card.addEventListener("click", () => {
    openGalleryPreview(gallery.id);
  });

  col.appendChild(card);
  return col;
}

/**
 * Navigate to the gallery preview page.
 * @param {number|string} galleryId
 */
export function openGalleryPreview(galleryId) {
  const id = Number(galleryId);
  if (!Number.isFinite(id) || id <= 0) return;
  window.location.href = `preview_gallery.html?id=${encodeURIComponent(id)}`;
}

function attachGalleryActionHandlers(root) {
  // Action buttons are bound inline when the tile is created (stopPropagation).
  // Kept for compatibility if older markup is present.
  root.querySelectorAll(".gallery-edit-btn[data-gallery-id]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleEditGallery(parseInt(btn.dataset.galleryId, 10));
    });
  });

  root.querySelectorAll(".gallery-delete-btn[data-gallery-id]").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleDeleteGallery(parseInt(btn.dataset.galleryId, 10));
    });
  });
}

// Setup infinite scroll via IntersectionObserver
function setupInfiniteScroll() {
  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;

  if (window.galleryScrollObserver) {
    window.galleryScrollObserver.disconnect();
  }

  window.galleryScrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMorePages && !isLoading) {
        loadGalleries();
      }
    },
    { root: null, rootMargin: "200px", threshold: 0 }
  );

  window.galleryScrollObserver.observe(sentinel);
}

/**
 * Build the create/edit gallery form (title + description only).
 */
// Form field ids must not clash with preview page banner (#gallery-title / #gallery-description)
const GALLERY_FORM_TITLE_ID = "gallery-form-title";
const GALLERY_FORM_DESC_ID = "gallery-form-description";

function buildGalleryForm(config) {
  const form = document.createElement("form");
  form.id = "gallery-form";

  const titleWrapper = createDIV("mb-3");
  const titleLabel = createLabel("Title", GALLERY_FORM_TITLE_ID, "form-label");
  const titleInput = createBootstrapTextInput(
    GALLERY_FORM_TITLE_ID,
    true,
    VALIDATION_CONSTRAINTS.galleryTitleMaxLength,
    config.titleValue || ""
  );
  titleWrapper.appendChild(titleLabel);
  titleWrapper.appendChild(titleInput);

  const descWrapper = createDIV("mb-3");
  const descLabel = createLabel("Description", GALLERY_FORM_DESC_ID, "form-label");
  const descInput = createBootstrapTextArea(
    GALLERY_FORM_DESC_ID,
    3,
    VALIDATION_CONSTRAINTS.galleryDescriptionMaxLength,
    config.description || "",
    true
  );
  descWrapper.appendChild(descLabel);
  descWrapper.appendChild(descInput);

  form.appendChild(titleWrapper);
  form.appendChild(descWrapper);

  return form;
}

/**
 * Build form for editing gallery added / register date.
 */
function buildGalleryDateForm(config) {
  const form = document.createElement("form");
  form.id = "gallery-date-form";

  const wrapper = createDIV("mb-3");
  const label = createLabel("Added date", "gallery-register-date", "form-label");
  const input = document.createElement("input");
  input.type = "datetime-local";
  input.className = "form-control";
  input.id = "gallery-register-date";
  input.required = true;
  input.value = toDatetimeLocalValue(config.registerDate || "");
  wrapper.appendChild(label);
  wrapper.appendChild(input);

  const hint = createDIV("form-text text-muted");
  hint.textContent = "This is the gallery creation / added date shown in the UI.";
  wrapper.appendChild(hint);

  form.appendChild(wrapper);
  return form;
}

// Modal for creating / editing title & description
function showGalleryModal(config) {
  showGenericModal({
    title: config.modalTitle || "Gallery",
    bodyElement: buildGalleryForm(config),
    buttons: [
      {
        text: "Cancel",
        class: "btn-secondary",
        action: () => newHideModal("my_modal")
      },
      { hidden: true },
      {
        text: config.isEdit ? "Update" : "Create",
        class: "btn-primary",
        action: () => {
          config.isEdit
            ? executeEditGalleryDetails(config.galleryId)
            : executeCreateGallery();
        }
      }
    ]
  });

  setTimeout(() => {
    const titleInput = document.getElementById(GALLERY_FORM_TITLE_ID);
    if (titleInput) titleInput.focus();
  }, 100);
}

// Modal for editing added date
function showGalleryDateModal(config) {
  showGenericModal({
    title: config.modalTitle || "Edit added date",
    bodyElement: buildGalleryDateForm(config),
    buttons: [
      {
        text: "Cancel",
        class: "btn-secondary",
        action: () => newHideModal("my_modal")
      },
      { hidden: true },
      {
        text: "Update date",
        class: "btn-primary",
        action: () => executeEditGalleryDate(config.galleryId)
      }
    ]
  });

  setTimeout(() => {
    const dateInput = document.getElementById("gallery-register-date");
    if (dateInput) dateInput.focus();
  }, 100);
}

// Handle add gallery button
export async function handleAddGallery() {
  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  showGalleryModal({
    modalTitle: "Create Gallery",
    titleValue: "",
    description: "",
    isEdit: false
  });
}

// Execute create gallery — persists to media_collections + collection_owners
async function executeCreateGallery() {
  const titleInput = document.getElementById(GALLERY_FORM_TITLE_ID);
  const descInput = document.getElementById(GALLERY_FORM_DESC_ID);
  const errorField = document.getElementById("modal-alert-field");

  const title = (titleInput?.value || "").trim();
  const description = (descInput?.value || "").trim();

  errorField.style.display = "none";

  const galleryValidation = validateGallery(title, description);
  if (!galleryValidation.valid) {
    errorField.textContent = galleryValidation.error;
    errorField.style.display = "block";
    return;
  }

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    errorField.textContent = "Session token missing";
    errorField.style.display = "block";
    return;
  }

  try {
    const response = await POSTJSONRequest({
      request: "create_gallery",
      token: sessionToken,
      title,
      description,
    });

    if (!response?.success || !response.data?.gallery) {
      errorField.textContent = response?.error || "Failed to create gallery";
      errorField.style.display = "block";
      return;
    }

    const newGallery = mapGalleryFromApi(response.data.gallery);

    ensureOwnerFilterLoaded();
    const matchesFilter =
      !ownerFilter ||
      (newGallery.owner && newGallery.owner === ownerFilter);

    if (matchesFilter) {
      allGalleries.unshift(newGallery);
      newHideModal("my_modal");
      await renderGalleries(allGalleries, { replace: true });
    } else {
      newHideModal("my_modal");
    }
    showFeedback("Gallery created successfully");
  } catch (err) {
    console.error("Create gallery error:", err);
    errorField.textContent = "Failed to create gallery";
    errorField.style.display = "block";
  }
}

/**
 * Open edit modal for title & description (list page or preview).
 */
export async function handleEditGallery(galleryId) {
  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  let gallery = resolveGallery(galleryId);
  if (!gallery) {
    gallery = await fetchGalleryById(galleryId);
  }
  if (!gallery) {
    showFeedback("Gallery not found");
    return;
  }

  showGalleryModal({
    modalTitle: "Edit title & description",
    titleValue: gallery.title,
    description: gallery.description,
    galleryId: gallery.id,
    isEdit: true
  });
}

/**
 * Open edit modal for gallery added date.
 */
export async function handleEditGalleryDate(galleryId) {
  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  let gallery = resolveGallery(galleryId);
  if (!gallery) {
    gallery = await fetchGalleryById(galleryId);
  }
  if (!gallery) {
    showFeedback("Gallery not found");
    return;
  }

  showGalleryDateModal({
    modalTitle: "Edit added date",
    registerDate: gallery.register_date,
    galleryId: gallery.id,
  });
}

/**
 * POST update_gallery and refresh local UI (list and/or preview banner).
 */
async function persistGalleryUpdate(payload) {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return { ok: false, error: "Session token missing" };
  }

  const response = await POSTJSONRequest({
    request: "update_gallery",
    token: sessionToken,
    ...payload,
  });

  if (!response?.success || !response.data?.gallery) {
    return {
      ok: false,
      error: response?.error || "Failed to update gallery",
    };
  }

  const updated = mapGalleryFromApi(response.data.gallery);
  applyGalleryUpdateLocally(updated);

  // Refresh list page cards if present
  const grid = document.getElementById("galleries-grid");
  if (grid && allGalleries.length > 0) {
    await renderGalleries(allGalleries, { replace: true });
  }

  // Refresh preview banner if on preview page
  if (currentPreviewGallery && currentPreviewGallery.id === updated.id) {
    const loggedUser = await getLoggedUser();
    const isOwner = Boolean(
      loggedUser &&
        currentPreviewGallery.owner &&
        loggedUser === currentPreviewGallery.owner
    );
    let coverUrl = currentPreviewGallery.cover_url;
    if (coverUrl === undefined) {
      coverUrl = await fetchGalleryCoverFullUrl(updated.id);
      currentPreviewGallery.cover_url = coverUrl;
    }
    renderGalleryPreviewBanner(currentPreviewGallery, coverUrl, isOwner);
  }

  return { ok: true, gallery: updated };
}

// Execute title + description update
async function executeEditGalleryDetails(galleryId) {
  const titleInput = document.getElementById(GALLERY_FORM_TITLE_ID);
  const descInput = document.getElementById(GALLERY_FORM_DESC_ID);
  const errorField = document.getElementById("modal-alert-field");

  if (!titleInput || !descInput) {
    console.error("Gallery form fields not found");
    showFeedback("Could not read form fields");
    return;
  }

  const title = (titleInput.value || "").trim();
  const description = (descInput.value || "").trim();

  if (errorField) errorField.style.display = "none";

  const galleryValidation = validateGallery(title, description);
  if (!galleryValidation.valid) {
    if (errorField) {
      errorField.textContent = galleryValidation.error;
      errorField.style.display = "block";
    }
    return;
  }

  try {
    const result = await persistGalleryUpdate({
      id: galleryId,
      title,
      description,
    });

    if (!result.ok) {
      if (errorField) {
        errorField.textContent = result.error;
        errorField.style.display = "block";
      }
      return;
    }

    newHideModal("my_modal");
    showFeedback("Gallery updated");
  } catch (err) {
    console.error("Edit gallery error:", err);
    if (errorField) {
      errorField.textContent = "Failed to update gallery";
      errorField.style.display = "block";
    }
  }
}

// Execute added-date update
async function executeEditGalleryDate(galleryId) {
  const dateInput = document.getElementById("gallery-register-date");
  const errorField = document.getElementById("modal-alert-field");

  const registerDate = fromDatetimeLocalValue(dateInput?.value || "");

  errorField.style.display = "none";

  if (!registerDate) {
    errorField.textContent = "Added date is required.";
    errorField.style.display = "block";
    return;
  }

  try {
    const result = await persistGalleryUpdate({
      id: galleryId,
      register_date: registerDate,
    });

    if (!result.ok) {
      errorField.textContent = result.error;
      errorField.style.display = "block";
      return;
    }

    newHideModal("my_modal");
    showFeedback("Added date updated");
  } catch (err) {
    console.error("Edit gallery date error:", err);
    errorField.textContent = "Failed to update added date";
    errorField.style.display = "block";
  }
}

// Handle delete gallery
async function handleDeleteGallery(galleryId) {
  let gallery = resolveGallery(galleryId);
  if (!gallery) {
    gallery = await fetchGalleryById(galleryId);
  }
  if (!gallery) {
    showFeedback("Gallery not found");
    return;
  }

  showGenericModal({
    title: "Delete Gallery",
    bodyText: `Are you sure you want to delete "${gallery.title}"? This cannot be undone.`,
    buttons: [
      {
        text: "Cancel",
        class: "btn-secondary",
        action: () => newHideModal("my_modal")
      },
      { hidden: true },
      {
        text: "Delete",
        class: "btn-danger",
        action: () => executeDeleteGallery(galleryId)
      }
    ]
  });
}

// Execute delete gallery (persists via delete_gallery)
async function executeDeleteGallery(galleryId) {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    showFeedback("Session token missing");
    return;
  }

  try {
    const response = await POSTJSONRequest({
      request: "delete_gallery",
      token: sessionToken,
      id: galleryId,
    });

    if (!response?.success) {
      showFeedback(response?.error || "Failed to delete gallery");
      return;
    }

    allGalleries = allGalleries.filter((g) => g.id !== galleryId);
    newHideModal("my_modal");

    // If we deleted the open preview gallery, go back to the list
    if (currentPreviewGallery && currentPreviewGallery.id === galleryId) {
      showFeedback("Gallery deleted");
      redirectToGalleriesIndex();
      return;
    }

    const grid = document.getElementById("galleries-grid");
    if (grid) {
      await renderGalleries(allGalleries, { replace: true });
      if (allGalleries.length === 0) showEmptyState();
    }
    showFeedback("Gallery deleted");
  } catch (err) {
    console.error("Delete gallery error:", err);
    showFeedback("Failed to delete gallery");
  }
}

// Gallery items / preview page

// Picture wrapper used by createInfiniteScroller
export function createPictureWrapper() {
  const row = createDIV("row g-4 gallery-pictures-row");
  return row;
}

/**
 * Picture tile used by createInfiniteScroller / test helpers.
 * @param {string} mediaUrl Thumbnail (or display) URL
 * @param {string} title
 * @param {string} caption
 * @param {{
 *   onClick?: () => void,
 *   fullUrl?: string|null,
 *   mediaId?: number,
 *   showOwnerActions?: boolean,
 *   onEdit?: () => void,
 *   onDelete?: () => void,
 * }} [options]
 */
export function createMediaTilePic(mediaUrl, title, caption, options = {}) {
  const col = createDIV("col-auto");
  const card = createDIV("card border border-2 media-tile-card");
  if (options.mediaId) {
    card.dataset.mediaId = String(options.mediaId);
    col.dataset.mediaId = String(options.mediaId);
  }

  const mediaWrap = createDIV("media-tile-media");
  const img = createHTMLelement("img", "w-100 media-tile-img");
  img.src = mediaUrl || "";
  img.alt = title || "Gallery picture";
  img.loading = "lazy";
  img.decoding = "async";
  mediaWrap.appendChild(img);

  if (options.showOwnerActions) {
    mediaWrap.appendChild(
      createTileActionBar([
        {
          className: "media-edit-btn",
          icon: "bi bi-pencil",
          title: "Edit picture",
          onClick: () => {
            if (typeof options.onEdit === "function") options.onEdit();
          },
        },
        {
          className: "media-delete-btn",
          icon: "bi bi-trash",
          title: "Delete picture",
          onClick: () => {
            if (typeof options.onDelete === "function") options.onDelete();
          },
        },
      ])
    );
  }

  const titleDIV = createDIV("bg-secondary text-white px-2 py-1 media-tile-title");
  const titleSpan = createHTMLelement("span", "fw-bold");
  titleSpan.textContent = title || "Untitled";
  const captionBody = createDIV("card-body p-2");
  const captionP = createHTMLelement("p", "card-text small mb-0 media-tile-caption");
  captionP.textContent = caption || "";

  captionBody.appendChild(captionP);
  titleDIV.appendChild(titleSpan);
  card.appendChild(mediaWrap);
  card.appendChild(titleDIV);
  card.appendChild(captionBody);

  if (typeof options.onClick === "function") {
    card.classList.add("media-tile-card--clickable");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.title = "Open full size";
    const open = (e) => {
      // Ignore clicks that originated from action buttons
      if (e.target.closest(".tile-action-bar")) return;
      e.preventDefault();
      options.onClick();
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open(e);
    });
  }

  col.appendChild(card);
  return col;
}

/**
 * Build a picture tile for the open gallery preview (with owner actions when allowed).
 * @param {object} item
 */
function createPreviewPictureTile(item) {
  return createMediaTilePic(item.url, item.title, item.caption, {
    fullUrl: item.fullUrl,
    mediaId: item.id,
    showOwnerActions: previewIsOwner,
    onClick: () => openPictureLightboxById(item.id),
    onEdit: () => handleEditPicture(item.id),
    onDelete: () => handleDeletePicture(item.id),
  });
}

/**
 * Owner-only "Add picture" tile for the end of the grid.
 * @returns {HTMLElement}
 */
function createAddPictureGridTile() {
  const col = createDIV("col-auto");
  col.id = "gallery-add-picture-tile";

  const card = createDIV(
    "card border border-2 media-tile-card media-tile-card--add media-tile-card--clickable"
  );
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.title = "Add picture";
  card.setAttribute("aria-label", "Add picture");

  const body = createDIV("media-tile-add-body");
  const icon = document.createElement("i");
  icon.className = "bi bi-plus-lg";
  const label = createHTMLelement("span", "media-tile-add-label");
  label.textContent = "Add picture";

  body.appendChild(icon);
  body.appendChild(label);
  card.appendChild(body);
  col.appendChild(card);

  const open = (e) => {
    e.preventDefault();
    handleAddPicture();
  };
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") open(e);
  });

  return col;
}

/**
 * Keep the owner "Add picture" tile as the last cell in the grid.
 * Always re-appends so it stays after infinite-scroll batches.
 */
function ensureAddPictureTileAtEnd() {
  if (!previewIsOwner) {
    document.getElementById("gallery-add-picture-tile")?.remove();
    return;
  }

  const wrapper = document.querySelector(
    "#gallery-pictures .gallery-pictures-row"
  );
  if (!wrapper) return;

  let tile = document.getElementById("gallery-add-picture-tile");
  if (!tile) {
    tile = createAddPictureGridTile();
  } else if (tile.parentNode === wrapper) {
    // Detach first so appendChild truly moves it after newly added tiles
    tile.remove();
  }
  wrapper.appendChild(tile);
}

/**
 * Open lightbox for a picture id (resolves current index in loaded list).
 * @param {number} mediaId
 */
export function openPictureLightboxById(mediaId) {
  const idx = loadedGalleryPictures.findIndex((p) => p.id === mediaId);
  if (idx < 0) {
    showFeedback("Picture not found");
    return;
  }
  openPictureLightbox(idx);
}

/**
 * Refresh title/caption text on an already-rendered picture tile.
 * @param {number} mediaId
 * @param {{title?: string, caption?: string}} fields
 */
function updatePictureTileDom(mediaId, fields) {
  const col = document.querySelector(
    `#gallery-pictures [data-media-id="${mediaId}"]`
  );
  if (!col) return;
  if (fields.title !== undefined) {
    const titleEl = col.querySelector(".media-tile-title .fw-bold");
    if (titleEl) titleEl.textContent = fields.title || "Untitled";
  }
  if (fields.caption !== undefined) {
    const capEl = col.querySelector(".media-tile-caption");
    if (capEl) capEl.textContent = fields.caption || "";
  }
}

/**
 * Remove a picture tile from the DOM and loaded list.
 * @param {number} mediaId
 */
function removePictureTileDom(mediaId) {
  const col = document.querySelector(
    `#gallery-pictures [data-media-id="${mediaId}"]`
  );
  if (col) col.remove();
  loadedGalleryPictures = loadedGalleryPictures.filter((p) => p.id !== mediaId);
}

/**
 * Ensure the full-size picture lightbox exists in the DOM.
 * @returns {HTMLElement}
 */
function ensurePictureLightbox() {
  let root = document.getElementById("gallery-lightbox");
  if (root) return root;

  root = createDIV("gallery-lightbox");
  root.id = "gallery-lightbox";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-hidden", "true");
  root.hidden = true;

  const backdrop = createDIV("gallery-lightbox-backdrop");
  const stage = createDIV("gallery-lightbox-stage");

  const closeBtn = createButton(
    "button",
    "",
    "btn gallery-lightbox-close"
  );
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';

  const prevBtn = createButton(
    "button",
    "",
    "btn gallery-lightbox-nav gallery-lightbox-prev"
  );
  prevBtn.setAttribute("aria-label", "Previous picture");
  prevBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';

  const nextBtn = createButton(
    "button",
    "",
    "btn gallery-lightbox-nav gallery-lightbox-next"
  );
  nextBtn.setAttribute("aria-label", "Next picture");
  nextBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';

  const img = document.createElement("img");
  img.className = "gallery-lightbox-img";
  img.alt = "";
  img.id = "gallery-lightbox-img";

  const meta = createDIV("gallery-lightbox-meta");
  const titleEl = createHTMLelement("div", "gallery-lightbox-title");
  titleEl.id = "gallery-lightbox-title";
  const captionEl = createHTMLelement("div", "gallery-lightbox-caption");
  captionEl.id = "gallery-lightbox-caption";
  const counterEl = createHTMLelement("div", "gallery-lightbox-counter");
  counterEl.id = "gallery-lightbox-counter";
  meta.appendChild(titleEl);
  meta.appendChild(captionEl);
  meta.appendChild(counterEl);

  stage.appendChild(img);
  stage.appendChild(meta);

  root.appendChild(backdrop);
  root.appendChild(closeBtn);
  root.appendChild(prevBtn);
  root.appendChild(nextBtn);
  root.appendChild(stage);
  document.body.appendChild(root);

  // Close only via the X button (not backdrop click)
  closeBtn.addEventListener("click", () => closePictureLightbox());
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showLightboxAt(lightboxIndex - 1);
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showLightboxAt(lightboxIndex + 1);
  });

  return root;
}

/**
 * Render the lightbox for a given index in loadedGalleryPictures.
 * @param {number} index
 */
function showLightboxAt(index) {
  if (!loadedGalleryPictures.length) return;

  const max = loadedGalleryPictures.length - 1;
  const nextIndex = Math.max(0, Math.min(max, index));
  lightboxIndex = nextIndex;

  const item = loadedGalleryPictures[nextIndex];
  if (!item) return;

  const root = ensurePictureLightbox();
  const img = document.getElementById("gallery-lightbox-img");
  const titleEl = document.getElementById("gallery-lightbox-title");
  const captionEl = document.getElementById("gallery-lightbox-caption");
  const counterEl = document.getElementById("gallery-lightbox-counter");
  const prevBtn = root.querySelector(".gallery-lightbox-prev");
  const nextBtn = root.querySelector(".gallery-lightbox-next");

  const fullSrc = item.fullUrl || item.url;
  if (img) {
    img.src = fullSrc || "";
    img.alt = item.title || "Gallery picture";
  }
  if (titleEl) titleEl.textContent = item.title || "";
  if (captionEl) {
    captionEl.textContent = item.caption || "";
    captionEl.hidden = !item.caption;
  }
  if (counterEl) {
    counterEl.textContent = `${nextIndex + 1} / ${loadedGalleryPictures.length}`;
  }
  if (prevBtn) prevBtn.disabled = nextIndex <= 0;
  if (nextBtn) nextBtn.disabled = nextIndex >= max;

  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  root.classList.add("is-open");
  document.body.classList.add("gallery-lightbox-open");

  // Deep-link URL: keep gallery id + current picture id
  if (currentPreviewGallery?.id && item.id) {
    setPreviewUrl(currentPreviewGallery.id, item.id);
  }

  if (!lightboxKeyHandler) {
    // Arrow keys for navigation only — Escape does not close (X button only)
    lightboxKeyHandler = (e) => {
      if (e.key === "ArrowLeft") {
        showLightboxAt(lightboxIndex - 1);
      } else if (e.key === "ArrowRight") {
        showLightboxAt(lightboxIndex + 1);
      }
    };
    document.addEventListener("keydown", lightboxKeyHandler);
  }
}

/**
 * Open full-size picture lightbox at index.
 * @param {number} index
 */
export function openPictureLightbox(index) {
  ensurePictureLightbox();
  showLightboxAt(index);
}

/**
 * Close the full-size picture lightbox.
 * @param {{ updateUrl?: boolean }} [options] updateUrl=false keeps ?picid= (e.g. during reset before deep-link open)
 */
export function closePictureLightbox(options = {}) {
  const updateUrl = options.updateUrl !== false;
  const wasOpen = lightboxIndex >= 0;

  const root = document.getElementById("gallery-lightbox");
  if (root) {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.classList.remove("is-open");
    const img = document.getElementById("gallery-lightbox-img");
    if (img) img.removeAttribute("src");
  }
  document.body.classList.remove("gallery-lightbox-open");
  lightboxIndex = -1;

  if (lightboxKeyHandler) {
    document.removeEventListener("keydown", lightboxKeyHandler);
    lightboxKeyHandler = null;
  }

  // Drop picid from URL when the user closes an open picture preview
  if (updateUrl && wasOpen && currentPreviewGallery?.id) {
    setPreviewUrl(currentPreviewGallery.id, null);
  }
}

/**
 * Build edit-picture form (title, description, set-as-cover).
 */
function buildPictureEditForm(config) {
  const form = document.createElement("form");
  form.id = "picture-edit-form";

  const titleWrapper = createDIV("mb-3");
  const titleLabel = createLabel("Title", "picture-title", "form-label");
  const titleInput = createBootstrapTextInput(
    "picture-title",
    false,
    255,
    config.titleValue || ""
  );
  titleWrapper.appendChild(titleLabel);
  titleWrapper.appendChild(titleInput);

  const descWrapper = createDIV("mb-3");
  const descLabel = createLabel("Description", "picture-description", "form-label");
  const descInput = createBootstrapTextArea(
    "picture-description",
    3,
    2000,
    config.description || "",
    false
  );
  descWrapper.appendChild(descLabel);
  descWrapper.appendChild(descInput);

  const coverWrapper = createDIV("mb-1");
  const coverBtn = createButton(
    "button",
    "Make gallery cover",
    "btn galleries-btn-ghost w-100 picture-set-cover-btn"
  );
  coverBtn.id = "picture-set-cover-btn";
  coverBtn.type = "button";
  const coverIcon = document.createElement("i");
  coverIcon.className = "bi bi-image me-2";
  coverBtn.prepend(coverIcon);
  coverWrapper.appendChild(coverBtn);

  form.appendChild(titleWrapper);
  form.appendChild(descWrapper);
  form.appendChild(coverWrapper);
  return form;
}

/**
 * Open edit modal for a picture in the current gallery.
 * @param {number} mediaId
 */
export async function handleEditPicture(mediaId) {
  if (!previewIsOwner || !currentPreviewGallery) {
    showFeedback("You must own this gallery to edit pictures");
    return;
  }

  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  const item = loadedGalleryPictures.find((p) => p.id === mediaId);
  if (!item) {
    showFeedback("Picture not found");
    return;
  }

  const isCurrentCover =
    currentPreviewGallery.collection_cover_id === mediaId;

  showGenericModal({
    title: "Edit picture",
    bodyElement: buildPictureEditForm({
      titleValue: item.title,
      description: item.caption,
    }),
    buttons: [
      {
        text: "Cancel",
        class: "btn-secondary",
        action: () => newHideModal("my_modal"),
      },
      { hidden: true },
      {
        text: "Save",
        class: "btn-primary",
        action: () => executeEditPicture(mediaId),
      },
    ],
  });

  setTimeout(() => {
    const coverBtn = document.getElementById("picture-set-cover-btn");
    if (coverBtn) {
      if (isCurrentCover) {
        coverBtn.disabled = true;
        coverBtn.textContent = "Already the gallery cover";
      } else {
        coverBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          await executeSetPictureAsCover(mediaId);
        });
      }
    }
    const titleInput = document.getElementById("picture-title");
    if (titleInput) titleInput.focus();
  }, 100);
}

/**
 * Save picture title/description.
 * @param {number} mediaId
 */
async function executeEditPicture(mediaId) {
  const titleInput = document.getElementById("picture-title");
  const descInput = document.getElementById("picture-description");
  const errorField = document.getElementById("modal-alert-field");

  const title = (titleInput?.value || "").trim();
  const description = (descInput?.value || "").trim();

  errorField.style.display = "none";

  if (title.length > 255) {
    errorField.textContent = "Title must be at most 255 characters.";
    errorField.style.display = "block";
    return;
  }

  const sessionToken = getSessionToken();
  if (!sessionToken || !currentPreviewGallery) {
    errorField.textContent = "Session token missing";
    errorField.style.display = "block";
    return;
  }

  try {
    const response = await POSTJSONRequest({
      request: "update_gallery_media",
      token: sessionToken,
      gallery_id: currentPreviewGallery.id,
      media_id: mediaId,
      title,
      description,
    });

    if (!response?.success || !response.data?.media) {
      errorField.textContent = response?.error || "Failed to update picture";
      errorField.style.display = "block";
      return;
    }

    const folder = await getGalleryFolder();
    const updated = mapMediaItemFromApi(response.data.media, folder);
    const idx = loadedGalleryPictures.findIndex((p) => p.id === mediaId);
    if (idx >= 0) {
      loadedGalleryPictures[idx] = {
        ...loadedGalleryPictures[idx],
        ...updated,
      };
    }

    updatePictureTileDom(mediaId, {
      title: updated.title,
      caption: updated.caption,
    });

    // Refresh open lightbox if this picture is shown
    if (lightboxIndex >= 0 && loadedGalleryPictures[lightboxIndex]?.id === mediaId) {
      showLightboxAt(lightboxIndex);
    }

    newHideModal("my_modal");
    showFeedback("Picture updated");
  } catch (err) {
    console.error("Edit picture error:", err);
    errorField.textContent = "Failed to update picture";
    errorField.style.display = "block";
  }
}

/**
 * Set the selected picture as the gallery cover.
 * @param {number} mediaId
 */
async function executeSetPictureAsCover(mediaId) {
  const errorField = document.getElementById("modal-alert-field");
  const sessionToken = getSessionToken();
  if (!sessionToken || !currentPreviewGallery) {
    if (errorField) {
      errorField.textContent = "Session token missing";
      errorField.style.display = "block";
    }
    return;
  }

  try {
    const response = await POSTJSONRequest({
      request: "set_gallery_cover",
      token: sessionToken,
      gallery_id: currentPreviewGallery.id,
      media_id: mediaId,
    });

    if (!response?.success) {
      if (errorField) {
        errorField.textContent = response?.error || "Failed to set cover";
        errorField.style.display = "block";
      } else {
        showFeedback(response?.error || "Failed to set cover");
      }
      return;
    }

    if (response.data?.gallery) {
      const updated = mapGalleryFromApi(response.data.gallery);
      applyGalleryUpdateLocally(updated);
    } else {
      currentPreviewGallery.collection_cover_id = mediaId;
    }

    // Force banner to reload full cover
    const coverUrl = await fetchGalleryCoverFullUrl(currentPreviewGallery.id);
    currentPreviewGallery.cover_url = coverUrl;
    const loggedUser = await getLoggedUser();
    const isOwner = Boolean(
      loggedUser &&
        currentPreviewGallery.owner &&
        loggedUser === currentPreviewGallery.owner
    );
    renderGalleryPreviewBanner(currentPreviewGallery, coverUrl, isOwner);

    newHideModal("my_modal");
    showFeedback("Gallery cover updated");
  } catch (err) {
    console.error("Set cover error:", err);
    if (errorField) {
      errorField.textContent = "Failed to set cover";
      errorField.style.display = "block";
    } else {
      showFeedback("Failed to set cover");
    }
  }
}

/**
 * Confirm and permanently delete a picture (DB + disk files).
 * @param {number} mediaId
 */
export async function handleDeletePicture(mediaId) {
  if (!previewIsOwner || !currentPreviewGallery) {
    showFeedback("You must own this gallery to delete pictures");
    return;
  }

  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  const item = loadedGalleryPictures.find((p) => p.id === mediaId);
  const label = item?.title || "this picture";

  showGenericModal({
    title: "Delete picture",
    bodyText: `Permanently delete "${label}"? This removes it from all galleries and deletes the image files. This cannot be undone.`,
    buttons: [
      {
        text: "Cancel",
        class: "btn-secondary",
        action: () => newHideModal("my_modal"),
      },
      { hidden: true },
      {
        text: "Delete",
        class: "btn-danger",
        action: () => executeDeletePicture(mediaId),
      },
    ],
  });
}

/**
 * Permanently delete a media item (DB + files) via delete_media_item_by_user.
 * @param {number} mediaId
 */
async function executeDeletePicture(mediaId) {
  const sessionToken = getSessionToken();
  if (!sessionToken || !currentPreviewGallery) {
    showFeedback("Session token missing");
    return;
  }

  try {
    // Full delete: media_items + files rows, gallery links, disk full + miniature
    const response = await POSTJSONRequest({
      request: "delete_media_item_by_user",
      token: sessionToken,
      media_item_id: mediaId,
    });

    if (!response?.success) {
      showFeedback(response?.error || "Failed to delete picture");
      return;
    }

    const wasOpen =
      lightboxIndex >= 0 &&
      loadedGalleryPictures[lightboxIndex]?.id === mediaId;
    const wasCover = currentPreviewGallery.collection_cover_id === mediaId;

    removePictureTileDom(mediaId);

    if (currentPreviewGallery.image_count > 0) {
      currentPreviewGallery.image_count -= 1;
    }

    if (wasCover) {
      currentPreviewGallery.collection_cover_id = null;
      currentPreviewGallery.cover_url = null;
      const loggedUser = await getLoggedUser();
      const isOwner = Boolean(
        loggedUser &&
          currentPreviewGallery.owner &&
          loggedUser === currentPreviewGallery.owner
      );
      renderGalleryPreviewBanner(currentPreviewGallery, null, isOwner);
    } else {
      // Refresh count in banner meta
      const loggedUser = await getLoggedUser();
      const isOwner = Boolean(
        loggedUser &&
          currentPreviewGallery.owner &&
          loggedUser === currentPreviewGallery.owner
      );
      renderGalleryPreviewBanner(
        currentPreviewGallery,
        currentPreviewGallery.cover_url || null,
        isOwner
      );
    }

    if (wasOpen) {
      closePictureLightbox();
    } else if (lightboxIndex >= 0) {
      // Re-sync index after list shrink
      const openId = loadedGalleryPictures[lightboxIndex]?.id;
      if (openId) {
        const newIdx = loadedGalleryPictures.findIndex((p) => p.id === openId);
        if (newIdx >= 0) showLightboxAt(newIdx);
      }
    }

    const emptyState = document.getElementById("gallery-empty-state");
    if (loadedGalleryPictures.length === 0 && emptyState && !previewIsOwner) {
      emptyState.classList.remove("d-none");
    }
    ensureAddPictureTileAtEnd();

    newHideModal("my_modal");
    showFeedback("Picture deleted");
  } catch (err) {
    console.error("Delete picture error:", err);
    showFeedback("Failed to delete picture");
  }
}

/**
 * Load additional picture pages until picId is found (for deep links).
 * @param {number} galleryId
 * @param {number} picId
 * @returns {Promise<number>} index or -1
 */
async function ensurePictureLoaded(galleryId, picId) {
  let idx = loadedGalleryPictures.findIndex((p) => p.id === picId);
  if (idx >= 0) return idx;

  // Confirm the picture belongs to this gallery
  try {
    const response = await fetchAPIdataWGetParams({
      request: "get_gallery_media_item",
      gallery_id: galleryId,
      media_id: picId,
    });
    if (!response?.success || !response.data?.media) {
      return -1;
    }
  } catch (err) {
    console.error("Deep-link media check failed:", err);
    return -1;
  }

  let page = Math.floor(loadedGalleryPictures.length / picturePreviewPageSize) + 1;
  if (page < 1) page = 1;

  const wrapper = document.querySelector(
    "#gallery-pictures .gallery-pictures-row"
  );

  // Safety: avoid infinite loops on huge galleries
  for (let guard = 0; guard < 50; guard += 1) {
    const result = await fetchGalleryMediaPage(
      galleryId,
      page,
      picturePreviewPageSize
    );
    if (!result.items.length) break;

    result.items.forEach((item) => {
      // Skip duplicates if overlap
      if (loadedGalleryPictures.some((p) => p.id === item.id)) return;
      loadedGalleryPictures.push(item);
      if (wrapper) {
        wrapper.appendChild(createPreviewPictureTile(item));
      }
    });
    ensureAddPictureTileAtEnd();

    idx = loadedGalleryPictures.findIndex((p) => p.id === picId);
    if (idx >= 0) return idx;
    if (!result.hasMore) break;
    page += 1;
  }

  ensureAddPictureTileAtEnd();
  return loadedGalleryPictures.findIndex((p) => p.id === picId);
}

/**
 * Populate the preview banner (title, description, meta, full-res cover).
 * @param {object} gallery
 * @param {string|null} coverUrl
 * @param {boolean} isOwner
 */
function renderGalleryPreviewBanner(gallery, coverUrl, isOwner) {
  const titleEl = document.getElementById("gallery-title");
  const descEl = document.getElementById("gallery-description");
  const metaEl = document.getElementById("gallery-meta");
  const mediaEl = document.getElementById("gallery-banner-media");
  const ownerTools = document.getElementById("gallery-owner-tools");

  if (titleEl) titleEl.textContent = gallery.title || "Untitled gallery";
  if (descEl) {
    descEl.textContent = gallery.description || "No description";
  }

  if (metaEl) {
    metaEl.innerHTML = "";
    metaEl.appendChild(
      createGalleryMetaItem("bi bi-person", "", gallery.owner || "Unknown")
    );
    metaEl.appendChild(
      createGalleryMetaItem(
        "bi bi-image",
        "",
        `${gallery.image_count || 0} images`
      )
    );
    if (gallery.register_date) {
      metaEl.appendChild(
        createGalleryMetaItem(
          "bi bi-calendar3",
          "",
          String(gallery.register_date).slice(0, 10)
        )
      );
    }
  }

  if (mediaEl) {
    mediaEl.innerHTML = "";
    mediaEl.style.backgroundImage = "";
    if (coverUrl) {
      const img = document.createElement("img");
      img.className = "gallery-preview-banner-img";
      img.src = coverUrl;
      img.alt = `${gallery.title || "Gallery"} cover`;
      img.decoding = "async";
      img.addEventListener("error", () => {
        img.remove();
        mediaEl.classList.add("gallery-preview-banner-media--fallback");
      });
      mediaEl.appendChild(img);
      mediaEl.classList.remove("gallery-preview-banner-media--fallback");
    } else {
      mediaEl.classList.add("gallery-preview-banner-media--fallback");
    }
  }

  if (ownerTools) {
    if (isOwner) {
      ownerTools.classList.remove("d-none");
    } else {
      ownerTools.classList.add("d-none");
    }
  }

  // Document title
  document.title = `${gallery.title || "Gallery"} — Donbigosso`;
}

/**
 * Start infinite-scroll picture preview for the current gallery.
 * @param {number} galleryId
 */
async function startGalleryPicturesScroller(galleryId) {
  const target = document.getElementById("gallery-pictures");
  const spinner = document.getElementById("loading-spinner");
  const emptyState = document.getElementById("gallery-empty-state");

  if (!target) return;

  if (galleryPicturesScroller) {
    galleryPicturesScroller.destroy();
    galleryPicturesScroller = null;
  }

  closePictureLightbox({ updateUrl: false });
  loadedGalleryPictures = [];
  target.innerHTML = "";
  if (emptyState) emptyState.classList.add("d-none");
  if (spinner) spinner.classList.remove("d-none");

  let firstPageLoaded = false;
  let firstPageEmpty = false;

  galleryPicturesScroller = createInfiniteScroller({
    pageSize: picturePreviewPageSize,
    fetchPage: async (page, size) => {
      const result = await fetchGalleryMediaPage(galleryId, page, size);
      if (!firstPageLoaded) {
        firstPageLoaded = true;
        firstPageEmpty = !result.items || result.items.length === 0;
      }
      return result;
    },
    createWrapper: createPictureWrapper,
    createItem: (item) => {
      loadedGalleryPictures.push(item);
      return createPreviewPictureTile(item);
    },
    // Pin AFTER each page is appended to the DOM (not during fetch)
    onAfterPage: () => {
      ensureAddPictureTileAtEnd();
    },
    target,
    sentinelId: "gallery-pictures-sentinel",
    rootMargin: "240px",
  });

  await galleryPicturesScroller.start();

  if (spinner) spinner.classList.add("d-none");
  // Owners get an add-picture tile even when the gallery is empty
  if (firstPageEmpty && emptyState && !previewIsOwner) {
    emptyState.classList.remove("d-none");
  }

  ensureAddPictureTileAtEnd();

  // Deep-link: open a specific picture after tiles are ready
  if (pendingDeepLinkPicId) {
    const picId = pendingDeepLinkPicId;
    pendingDeepLinkPicId = null;
    const idx = await ensurePictureLoaded(galleryId, picId);
    if (idx >= 0) {
      openPictureLightbox(idx);
    } else {
      showFeedback("Picture not found in this gallery");
      setPreviewUrl(galleryId, null);
    }
    ensureAddPictureTileAtEnd();
  }
}

/**
 * Entry point for preview_gallery.html.
 * Requires ?id=<galleryId>; invalid/missing id redirects to index.html.
 * Optional ?picid= opens that picture full-size.
 */
export async function initGalleryPreview() {
  const galleryId = getGalleryIdFromUrl();
  if (!galleryId) {
    redirectToGalleriesIndex();
    return;
  }

  pendingDeepLinkPicId = getPictureIdFromUrl();

  const spinner = document.getElementById("loading-spinner");
  if (spinner) spinner.classList.remove("d-none");

  const gallery = await fetchGalleryById(galleryId);
  if (!gallery) {
    redirectToGalleriesIndex();
    return;
  }

  currentPreviewGallery = gallery;

  const loggedUser = await getLoggedUser();
  previewIsOwner = Boolean(
    loggedUser && gallery.owner && loggedUser === gallery.owner
  );

  const coverUrl = await fetchGalleryCoverFullUrl(galleryId);
  currentPreviewGallery.cover_url = coverUrl;
  renderGalleryPreviewBanner(gallery, coverUrl, previewIsOwner);

  // Canonical gallery URL (picid applied when lightbox opens)
  setPreviewUrl(galleryId, pendingDeepLinkPicId);

  await startGalleryPicturesScroller(galleryId);

  if (spinner) spinner.classList.add("d-none");
}

/**
 * Build the single-picture upload form (title, description, one file).
 */
function buildPictureUploadForm() {
  const form = document.createElement("form");
  form.id = "picture-upload-form";
  form.enctype = "multipart/form-data";

  const note = createDIV("form-text text-muted mb-3");
  note.innerHTML =
    "One image at a time. Saved as JPEG (long side max <strong>1920px</strong>, " +
    "miniature <strong>300px</strong>). Title and description are required.";

  const titleWrapper = createDIV("mb-3");
  const titleLabel = createLabel("Title", "picture-upload-title", "form-label");
  const titleInput = createBootstrapTextInput(
    "picture-upload-title",
    true,
    255,
    ""
  );
  titleWrapper.appendChild(titleLabel);
  titleWrapper.appendChild(titleInput);

  const descWrapper = createDIV("mb-3");
  const descLabel = createLabel(
    "Description",
    "picture-upload-description",
    "form-label"
  );
  const descInput = createBootstrapTextArea(
    "picture-upload-description",
    3,
    2000,
    "",
    true
  );
  descWrapper.appendChild(descLabel);
  descWrapper.appendChild(descInput);

  const fileWrapper = createDIV("mb-2");
  const fileLabel = createLabel("Image file", "picture-upload-file", "form-label");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "form-control";
  fileInput.id = "picture-upload-file";
  fileInput.accept = "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";
  fileInput.required = true;
  fileWrapper.appendChild(fileLabel);
  fileWrapper.appendChild(fileInput);

  form.appendChild(note);
  form.appendChild(titleWrapper);
  form.appendChild(descWrapper);
  form.appendChild(fileWrapper);
  return form;
}

/**
 * Open modal to upload one picture into the current gallery.
 */
export async function handleAddPicture() {
  if (!previewIsOwner || !currentPreviewGallery) {
    showFeedback("You must own this gallery to add pictures");
    return;
  }

  const sessionTest = await verifySession();
  if (!sessionTest) {
    showFeedback("You must be logged in");
    return;
  }

  showGenericModal({
    title: "Add picture",
    bodyElement: buildPictureUploadForm(),
    buttons: [
      {
        text: "Cancel",
        class: "btn-secondary",
        action: () => newHideModal("my_modal"),
      },
      { hidden: true },
      {
        text: "Upload",
        class: "btn-primary",
        action: () => executeUploadPicture(),
      },
    ],
  });

  setTimeout(() => {
    const titleInput = document.getElementById("picture-upload-title");
    if (titleInput) titleInput.focus();
  }, 100);
}

/**
 * POST multipart upload_gallery_media and refresh the preview grid.
 */
async function executeUploadPicture() {
  const titleInput = document.getElementById("picture-upload-title");
  const descInput = document.getElementById("picture-upload-description");
  const fileInput = document.getElementById("picture-upload-file");
  const errorField = document.getElementById("modal-alert-field");
  const uploadBtn = document.getElementById("modal-btn-3");

  const title = (titleInput?.value || "").trim();
  const description = (descInput?.value || "").trim();
  const file = fileInput?.files?.[0] || null;

  errorField.style.display = "none";

  if (!title) {
    errorField.textContent = "Title is required.";
    errorField.style.display = "block";
    return;
  }
  if (title.length > 255) {
    errorField.textContent = "Title must be at most 255 characters.";
    errorField.style.display = "block";
    return;
  }
  if (!description) {
    errorField.textContent = "Description is required.";
    errorField.style.display = "block";
    return;
  }
  if (!file) {
    errorField.textContent = "Please choose one image file.";
    errorField.style.display = "block";
    return;
  }
  if (fileInput.files && fileInput.files.length > 1) {
    errorField.textContent = "Only one picture can be uploaded at a time.";
    errorField.style.display = "block";
    return;
  }

  const sessionToken = getSessionToken();
  if (!sessionToken || !currentPreviewGallery) {
    errorField.textContent = "Session token missing";
    errorField.style.display = "block";
    return;
  }

  const apiAddress = await getSetting("api_address");
  if (!apiAddress) {
    errorField.textContent = "API address is not configured.";
    errorField.style.display = "block";
    return;
  }

  const formData = new FormData();
  formData.append("request", "upload_gallery_media");
  formData.append("token", sessionToken);
  formData.append("gallery_id", String(currentPreviewGallery.id));
  formData.append("title", title);
  formData.append("description", description);
  formData.append("file", file);

  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
  }

  try {
    const response = await fetch(apiAddress, {
      method: "POST",
      body: formData,
      // Do not set Content-Type — browser sets multipart boundary
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    if (!result?.success || !result.data?.media) {
      errorField.textContent = result?.error || "Upload failed";
      errorField.style.display = "block";
      return;
    }

    const folder = await getGalleryFolder();
    const item = mapMediaItemFromApi(result.data.media, folder);

    // Append to in-memory list + grid (keep add-tile last)
    loadedGalleryPictures.push(item);
    const wrapper = document.querySelector(
      "#gallery-pictures .gallery-pictures-row"
    );
    if (wrapper) {
      wrapper.appendChild(createPreviewPictureTile(item));
      ensureAddPictureTileAtEnd();
    } else if (currentPreviewGallery?.id) {
      // Grid not ready — reload scroller
      await startGalleryPicturesScroller(currentPreviewGallery.id);
    }

    currentPreviewGallery.image_count =
      (Number(currentPreviewGallery.image_count) || 0) + 1;

    // If this became the first cover (or cover was empty), refresh banner
    if (
      !currentPreviewGallery.collection_cover_id ||
      currentPreviewGallery.collection_cover_id === item.id
    ) {
      currentPreviewGallery.collection_cover_id = item.id;
      const coverUrl = await fetchGalleryCoverFullUrl(currentPreviewGallery.id);
      currentPreviewGallery.cover_url = coverUrl;
      renderGalleryPreviewBanner(
        currentPreviewGallery,
        coverUrl,
        previewIsOwner
      );
    } else {
      renderGalleryPreviewBanner(
        currentPreviewGallery,
        currentPreviewGallery.cover_url || null,
        previewIsOwner
      );
    }

    const emptyState = document.getElementById("gallery-empty-state");
    if (emptyState) emptyState.classList.add("d-none");

    newHideModal("my_modal");
    showFeedback("Picture uploaded");
  } catch (err) {
    console.error("Upload picture error:", err);
    errorField.textContent = err?.message || "Upload failed";
    errorField.style.display = "block";
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";
    }
  }
}

/**
 * Wire owner-tool buttons on the preview page.
 */
export function attachGalleryPreviewOwnerHandlers() {
  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handler();
    });
  };

  bind("gallery-edit-details-btn", () => {
    const id = currentPreviewGallery?.id;
    if (!id) {
      showFeedback("Gallery not loaded");
      return;
    }
    handleEditGallery(id);
  });

  bind("gallery-edit-date-btn", () => {
    const id = currentPreviewGallery?.id;
    if (!id) {
      showFeedback("Gallery not loaded");
      return;
    }
    handleEditGalleryDate(id);
  });

  bind("gallery-add-pics-btn", () => {
    handleAddPicture();
  });

  bind("gallery-delete-btn", () => {
    const id = currentPreviewGallery?.id;
    if (!id) {
      showFeedback("Gallery not loaded");
      return;
    }
    handleDeleteGallery(id);
  });
}