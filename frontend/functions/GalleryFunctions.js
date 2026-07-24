import { fetchAPIdataWGetParams, POSTJSONRequest, getUrlParam } from "./CoreFunctions.js";
import { verifySession } from "./RequestFunctions.js";
import { getSessionToken, showFeedback } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import { newHideModal, createDIV, createLabel, createButton, createBootstrapTextInput, adjustElementClassAndText, createBootstrapTextArea } from "./PageAppearance.js";
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
  const loggedHeading = document.querySelector(".logged-only h1");
  const unloggedHeading = document.querySelector(".unlogged-only h1");
  const unloggedHint = document.querySelector(".unlogged-only p");

  if (username) {
    const label = `Galleries by ${username}`;
    if (loggedHeading) loggedHeading.textContent = label;
    if (unloggedHeading) unloggedHeading.textContent = label;
    if (unloggedHint) {
      unloggedHint.textContent = `Showing galleries owned by ${username}.`;
    }
  } 
}

// Soft palette for cover tiles (no cover color column in DB yet)
const COVER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#95E1D3", "#2C3E50", "#FFB6C1",
  "#87CEEB", "#98D8C8", "#F7DC6F", "#DA7297", "#6C757D",
  "#A8E6CF", "#FFD3B6", "#5C6BC0", "#26A69A", "#EF5350"
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
    : "No galleries found yet.";

  const col = createDIV("col-12");
  const alert = createDIV("alert alert-light border text-center text-muted py-5");

  const icon = document.createElement("i");
  icon.className = "bi bi-images display-6 d-block mb-3";

  alert.appendChild(icon);
  alert.appendChild(document.createTextNode(message));
  col.appendChild(alert);

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
    const empty = grid.querySelector(".alert");
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
 * Build one gallery tile (the col > card structure) entirely via DOM APIs.
 */
function createGalleryCard(gallery, loggedUser) {
  const isOwner = loggedUser && gallery.owner && loggedUser === gallery.owner;
  const bgColor = gallery.cover_color || coverColorForId(gallery.id);

  const col = createDIV("col-12 col-sm-6 col-lg-4");

  const card = createDIV("card gallery-tile h-100");
  card.dataset.galleryId = gallery.id;

  // Cover
  const cover = createDIV("gallery-cover");
  cover.style.backgroundColor = bgColor;
  cover.style.backgroundImage = `linear-gradient(135deg, ${bgColor} 0%, rgba(0,0,0,0.2) 100%)`;

  const overlay = createDIV("gallery-cover-overlay");
  const iconWrap = createDIV("display-6");
  const coverIcon = document.createElement("i");
  coverIcon.className = "bi bi-images";
  iconWrap.appendChild(coverIcon);
  overlay.appendChild(iconWrap);
  cover.appendChild(overlay);

  // Body
  const body = createDIV("card-body d-flex flex-column");

  const title = document.createElement("h5");
  adjustElementClassAndText(title, "card-title text-primary", gallery.title);


  const description = document.createElement("p");
  adjustElementClassAndText(description, "card-text text-muted flex-grow-1", gallery.description);

  const ownerLine = document.createElement("small");
  ownerLine.className = "text-secondary mb-2";
  const ownerIcon = document.createElement("i");
  ownerIcon.className = "bi bi-person";
  ownerLine.appendChild(ownerIcon);
  ownerLine.appendChild(document.createTextNode(" "));
  if (gallery.owner) {
    ownerLine.appendChild(document.createTextNode(gallery.owner));
  } else {
    const unknownOwner = document.createElement("span");
    adjustElementClassAndText(unknownOwner, "text-muted", "Unknown");
    ownerLine.appendChild(unknownOwner);
  }

  const countLine = document.createElement("small");
  countLine.className = "text-secondary";
  const countIcon = document.createElement("i");
  countIcon.className = "bi bi-image";
  countLine.appendChild(countIcon);
  countLine.appendChild(document.createTextNode(` ${gallery.image_count} images`));

  body.appendChild(title);
  body.appendChild(description);
  body.appendChild(ownerLine);
  body.appendChild(countLine);

  if (gallery.register_date) {
    const dateLine = document.createElement("small");
    dateLine.className = "text-secondary d-block mt-1";
    const dateIcon = document.createElement("i");
    dateIcon.className = "bi bi-calendar3";
    dateLine.appendChild(dateIcon);
    dateLine.appendChild(document.createTextNode(` ${String(gallery.register_date).slice(0, 10)}`));
    body.appendChild(dateLine);
  }

  card.appendChild(cover);
  card.appendChild(body);

  if (isOwner) {
    const footer = createDIV("card-footer bg-light border-top");

    const editBtn = createButton("button", "", "btn btn-sm btn-primary me-1 gallery-edit-btn");
    editBtn.dataset.galleryId = gallery.id;
    const editIcon = document.createElement("i");
    editIcon.className = "bi bi-pencil";
    editBtn.appendChild(editIcon);
    editBtn.appendChild(document.createTextNode(" Edit"));

    const deleteBtn = createButton("button", "", "btn btn-sm btn-danger gallery-delete-btn");
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
  colorInput.value = config.color || "#6C757D";
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
    color: "#6C757D",
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
  const color = colorInput?.value || "#6C757D";

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