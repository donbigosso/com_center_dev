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
async function getLoggedUser() {
  if (currentLoggedUser) return currentLoggedUser;

  const token = getCookie("session_token");
  if (!token) return null;

  try {
    const response = await POSTJSONRequest({ request: "get_user_by_token", token });
    if (response?.success && response.data?.user_found) {
      currentLoggedUser = response.data.user_found;
      return currentLoggedUser;
    }
  } catch (err) {
    console.error("Error fetching logged user:", err);
  }
  return null;
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
 * Redirect to the main galleries listing page.
 */
function redirectToGalleriesIndex() {
  window.location.replace("index.html");
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

    const items = media.map((raw) => {
      const miniName =
        raw.miniature_filename || toMiniatureFilename(raw.filename) || raw.filename;
      const fullName = raw.filename || null;
      const url = folder && miniName
        ? `${folder}${encodeURIComponent(miniName)}`
        : null;
      const fullUrl = folder && fullName
        ? `${folder}${encodeURIComponent(fullName)}`
        : url;
      return {
        id: Number(raw.id) || 0,
        title: raw.title || "Untitled",
        caption: raw.description || "",
        url,
        fullUrl,
        filename: fullName,
        media_type: raw.media_type || null,
      };
    }).filter((item) => item.url);

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

  if (isOwner) {
    const footer = createDIV("card-footer");

    const editBtn = createButton("button", "", "btn btn-sm gallery-edit-btn");
    editBtn.dataset.galleryId = gallery.id;
    const editIcon = document.createElement("i");
    editIcon.className = "bi bi-pencil";
    editBtn.appendChild(editIcon);
    editBtn.appendChild(document.createTextNode(" Edit"));

    const deleteBtn = createButton("button", "", "btn btn-sm gallery-delete-btn");
    deleteBtn.dataset.galleryId = gallery.id;
    const deleteIcon = document.createElement("i");
    deleteIcon.className = "bi bi-trash";
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.appendChild(document.createTextNode(" Delete"));

    footer.appendChild(editBtn);
    footer.appendChild(deleteBtn);
    card.appendChild(footer);
  }

  // Open gallery preview when clicking the card (edit/delete stop propagation)
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
  root.querySelectorAll(".gallery-edit-btn").forEach(btn => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const galleryId = parseInt(btn.dataset.galleryId, 10);
      handleEditGallery(galleryId);
    });
  });

  root.querySelectorAll(".gallery-delete-btn").forEach(btn => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const galleryId = parseInt(btn.dataset.galleryId, 10);
      handleDeleteGallery(galleryId);
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
function buildGalleryForm(config) {
  const form = document.createElement("form");
  form.id = "gallery-form";

  const titleWrapper = createDIV("mb-3");
  const titleLabel = createLabel("Title", "gallery-title", "form-label");
  const titleInput = createBootstrapTextInput(
    "gallery-title",
    true,
    VALIDATION_CONSTRAINTS.galleryTitleMaxLength,
    config.titleValue || ""
  );
  titleWrapper.appendChild(titleLabel);
  titleWrapper.appendChild(titleInput);

  const descWrapper = createDIV("mb-3");
  const descLabel = createLabel("Description", "gallery-description", "form-label");
  const descInput = createBootstrapTextArea(
    "gallery-description",
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
    const titleInput = document.getElementById("gallery-title");
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
  const titleInput = document.getElementById("gallery-title");
  const descInput = document.getElementById("gallery-description");
  const errorField = document.getElementById("modal-alert-field");

  const title = titleInput.value.trim();
  const description = descInput.value.trim();

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
  const titleInput = document.getElementById("gallery-title");
  const descInput = document.getElementById("gallery-description");
  const errorField = document.getElementById("modal-alert-field");

  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  errorField.style.display = "none";

  const galleryValidation = validateGallery(title, description);
  if (!galleryValidation.valid) {
    errorField.textContent = galleryValidation.error;
    errorField.style.display = "block";
    return;
  }

  try {
    const result = await persistGalleryUpdate({
      id: galleryId,
      title,
      description,
    });

    if (!result.ok) {
      errorField.textContent = result.error;
      errorField.style.display = "block";
      return;
    }

    newHideModal("my_modal");
    showFeedback("Gallery updated");
  } catch (err) {
    console.error("Edit gallery error:", err);
    errorField.textContent = "Failed to update gallery";
    errorField.style.display = "block";
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

// Execute delete gallery (local until delete_gallery API exists)
async function executeDeleteGallery(galleryId) {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    showFeedback("Session token missing");
    return;
  }

  try {
    // TODO: POST delete_gallery when backend supports it
    allGalleries = allGalleries.filter(g => g.id !== galleryId);

    newHideModal("my_modal");
    await renderGalleries(allGalleries, { replace: true });
    showFeedback("Gallery removed locally (not deleted from DB yet)");
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
 * @param {{ onClick?: () => void, fullUrl?: string|null }} [options]
 */
export function createMediaTilePic(mediaUrl, title, caption, options = {}) {
  const col = createDIV("col-auto");
  const card = createDIV("card border border-2 media-tile-card");
  const img = createHTMLelement("img", "w-100 media-tile-img");
  img.src = mediaUrl || "";
  img.alt = title || "Gallery picture";
  img.loading = "lazy";
  img.decoding = "async";

  const titleDIV = createDIV("bg-secondary text-white px-2 py-1");
  const titleSpan = createHTMLelement("span", "fw-bold");
  titleSpan.textContent = title || "Untitled";
  const captionBody = createDIV("card-body p-2");
  const captionP = createHTMLelement("p", "card-text small mb-0");
  captionP.textContent = caption || "";

  captionBody.appendChild(captionP);
  titleDIV.appendChild(titleSpan);
  card.appendChild(img);
  card.appendChild(titleDIV);
  card.appendChild(captionBody);

  if (typeof options.onClick === "function") {
    card.classList.add("media-tile-card--clickable");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.title = "Open full size";
    const open = (e) => {
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

  const close = () => closePictureLightbox();
  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showLightboxAt(lightboxIndex - 1);
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showLightboxAt(lightboxIndex + 1);
  });

  // Clicking the image itself should not close
  img.addEventListener("click", (e) => e.stopPropagation());

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

  if (!lightboxKeyHandler) {
    lightboxKeyHandler = (e) => {
      if (e.key === "Escape") {
        closePictureLightbox();
      } else if (e.key === "ArrowLeft") {
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
 */
export function closePictureLightbox() {
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

  closePictureLightbox();
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
      const index = loadedGalleryPictures.length;
      loadedGalleryPictures.push(item);
      return createMediaTilePic(item.url, item.title, item.caption, {
        fullUrl: item.fullUrl,
        onClick: () => openPictureLightbox(index),
      });
    },
    target,
    sentinelId: "gallery-pictures-sentinel",
    rootMargin: "240px",
  });

  await galleryPicturesScroller.start();

  if (spinner) spinner.classList.add("d-none");
  if (firstPageEmpty && emptyState) {
    emptyState.classList.remove("d-none");
  }
}

/**
 * Entry point for preview_gallery.html.
 * Requires ?id=<galleryId>; invalid/missing id redirects to index.html.
 */
export async function initGalleryPreview() {
  const galleryId = getGalleryIdFromUrl();
  if (!galleryId) {
    redirectToGalleriesIndex();
    return;
  }

  const spinner = document.getElementById("loading-spinner");
  if (spinner) spinner.classList.remove("d-none");

  const gallery = await fetchGalleryById(galleryId);
  if (!gallery) {
    redirectToGalleriesIndex();
    return;
  }

  currentPreviewGallery = gallery;

  const loggedUser = await getLoggedUser();
  const isOwner = Boolean(
    loggedUser && gallery.owner && loggedUser === gallery.owner
  );

  const coverUrl = await fetchGalleryCoverFullUrl(galleryId);
  renderGalleryPreviewBanner(gallery, coverUrl, isOwner);

  await startGalleryPicturesScroller(galleryId);

  if (spinner) spinner.classList.add("d-none");
}

/**
 * Wire owner-tool buttons on the preview page.
 * Title/description and added date are live; picture add/remove still stubbed.
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
    showFeedback("Add pictures — not implemented yet");
  });

  bind("gallery-remove-pics-btn", () => {
    showFeedback("Remove pictures — not implemented yet");
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