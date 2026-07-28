import { fetchAPIdataWGetParams, POSTJSONRequest, getUrlParam } from "./CoreFunctions.js";
import { verifySession } from "./RequestFunctions.js";
import { getSessionToken, showFeedback } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import { newHideModal, createHTMLelement, createDIV, createLabel, createButton, createBootstrapTextInput, adjustElementClassAndText, createBootstrapTextArea } from "./PageAppearance.js";
import { getCookie } from "./CookieFunctions.js";
import { VALIDATION_CONSTRAINTS, validateGallery } from "./FormValidation.js";

// Pagination state
let currentPage = 1;
const pageSize = 12;
let allGalleries = [];
let currentLoggedUser = null;
let isLoading = false;
let hasMorePages = true;
let infiniteScrollReady = false;
let ownerFilter = undefined;

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
    cover_color: coverColorForId(id),
  };
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
  const bgColor = gallery.cover_color || coverColorForId(gallery.id);

  const col = createDIV("col-12 col-sm-6 col-lg-4");

  const card = createDIV("card gallery-tile h-100");
  card.dataset.galleryId = gallery.id;

  // Cover — dark metallic gradient
  const cover = createDIV("gallery-cover");
  cover.style.backgroundColor = bgColor;
  cover.style.backgroundImage =
    `radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 50%),` +
    `linear-gradient(160deg, ${bgColor} 0%, #000000 100%)`;

  const overlay = createDIV("gallery-cover-overlay");
  const coverIcon = document.createElement("i");
  coverIcon.className = "bi bi-images";
  overlay.appendChild(coverIcon);
  cover.appendChild(overlay);

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

  col.appendChild(card);
  return col;
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
 * Build the create/edit gallery form entirely via DOM APIs.
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

  const colorWrapper = createDIV("mb-3");
  const colorLabel = createLabel("Cover Color", "gallery-color", "form-label");
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "form-control form-control-color";
  colorInput.id = "gallery-color";
  colorInput.value = config.color || "#1a1a1a";
  colorWrapper.appendChild(colorLabel);
  colorWrapper.appendChild(colorInput);

  form.appendChild(titleWrapper);
  form.appendChild(descWrapper);
  form.appendChild(colorWrapper);

  return form;
}

// Modal for creating/editing gallery
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
          config.isEdit ? executeEditGallery(config.galleryId) : executeCreateGallery();
        }
      }
    ]
  });

  setTimeout(() => {
    const titleInput = document.getElementById("gallery-title");
    if (titleInput) titleInput.focus();
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
    color: "#1a1a1a",
    isEdit: false
  });
}

// Execute create gallery — persists to media_collections + collection_owners
async function executeCreateGallery() {
  const titleInput = document.getElementById("gallery-title");
  const descInput = document.getElementById("gallery-description");
  const colorInput = document.getElementById("gallery-color");
  const errorField = document.getElementById("modal-alert-field");

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const color = colorInput?.value || "#1a1a1a";

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
    // Keep chosen UI cover color (not stored in DB yet)
    newGallery.cover_color = color;

    ensureOwnerFilterLoaded();
    // Only show in the grid if we're browsing all or this owner's page
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

// Handle edit gallery
async function handleEditGallery(galleryId) {
  const gallery = allGalleries.find(g => g.id === galleryId);
  if (!gallery) return;

  showGalleryModal({
    modalTitle: "Edit Gallery",
    titleValue: gallery.title,
    description: gallery.description,
    color: gallery.cover_color,
    galleryId,
    isEdit: true
  });
}

// Execute edit gallery (local until update_gallery API exists)
async function executeEditGallery(galleryId) {
  const titleInput = document.getElementById("gallery-title");
  const descInput = document.getElementById("gallery-description");
  const colorInput = document.getElementById("gallery-color");
  const errorField = document.getElementById("modal-alert-field");

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const color = colorInput.value;

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
    // TODO: POST update_gallery when backend supports it
    const gallery = allGalleries.find(g => g.id === galleryId);
    if (gallery) {
      gallery.title = title;
      gallery.description = description;
      gallery.cover_color = color;
    }

    newHideModal("my_modal");
    await renderGalleries(allGalleries, { replace: true });
    showFeedback("Gallery updated locally (not saved to DB yet)");
  } catch (err) {
    console.error("Edit gallery error:", err);
    errorField.textContent = "Failed to update gallery";
    errorField.style.display = "block";
  }
}

// Handle delete gallery
async function handleDeleteGallery(galleryId) {
  const gallery = allGalleries.find(g => g.id === galleryId);
  if (!gallery) return;

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

//Galery items

//Picture wrapper
//  <div class="row g-4" id="picture-tile-test">
export function createPictureWrapper() {
  const row = createDIV("row g-4");
  row.id = "picture-tile-test";
  return row;
}

//Picture tile
export function createMediaTilePic(mediaUrl, title, caption) {
  const col = createDIV("col-auto");
  const card = createDIV("card border border-2 media-tile-card");
  const img = createHTMLelement("img", "w-100 media-tile-img");
  img.src = mediaUrl;
  const titleDIV = createDIV("bg-secondary text-white px-2 py-1");
  const titleSpan = createHTMLelement("span", "fw-bold");
  titleSpan.textContent = title;
  const captionBody = createDIV("card-body p-2");
  const captionP = createHTMLelement("p", "card-text small mb-0");
  captionP.textContent = caption;

  captionBody.appendChild(captionP);
  titleDIV.appendChild(titleSpan);
  card.appendChild(img);
  card.appendChild(titleDIV);
  card.appendChild(captionBody);
  col.appendChild(card);
  return col;
}