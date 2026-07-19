import { fetchAPIdataWGetParams, POSTJSONRequest } from "./CoreFunctions.js";
import { verifySession, getUserByToken } from "./RequestFunctions.js";
import { getSessionToken, showFeedback, getFileSettings } from "./CustomFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";
import { newHideModal } from "./PageAppearance.js";
import { getCookie } from "./CookieFunctions.js";

// Pagination state
let currentPage = 1;
let pageSize = 12;
let allGalleries = [];
let currentLoggedUser = null;
let isLoading = false;
let hasMorePages = true;

// Temporary demo data — remove once backend API is ready
const demoDemoGalleries = [
  {
    id: 1,
    title: "Summer Vibes 2024",
    description: "A collection of sunny moments and golden hour memories",
    owner: "photographer_anna",
    image_count: 24,
    cover_color: "#FF6B6B"
  },
  {
    id: 2,
    title: "Urban Exploration",
    description: "Streets, architecture, and city life through my lens",
    owner: "explorer_mike",
    image_count: 18,
    cover_color: "#4ECDC4"
  },
  {
    id: 3,
    title: "Nature's Palette",
    description: "Landscapes, wildlife, and the beauty of the natural world",
    owner: "nature_lover",
    image_count: 32,
    cover_color: "#95E1D3"
  },
  {
    id: 4,
    title: "Night Photography",
    description: "Stars, long exposures, and the magic of darkness",
    owner: "night_owl",
    image_count: 15,
    cover_color: "#2C3E50"
  },
  {
    id: 5,
    title: "Portrait Sessions",
    description: "Capturing souls and emotions through portraiture",
    owner: "photographer_anna",
    image_count: 28,
    cover_color: "#FFB6C1"
  },
  {
    id: 6,
    title: "Travel Diaries",
    description: "Around the world in photographs",
    owner: "explorer_mike",
    image_count: 42,
    cover_color: "#87CEEB"
  },
  {
    id: 7,
    title: "Macro World",
    description: "Tiny details, big perspectives",
    owner: "detail_seeker",
    image_count: 21,
    cover_color: "#98D8C8"
  },
  {
    id: 8,
    title: "Street Food",
    description: "Culinary adventures around the globe",
    owner: "food_lover",
    image_count: 19,
    cover_color: "#F7DC6F"
  },
  {
    id: 9,
    title: "Abstract Visions",
    description: "Beyond reality - artistic interpretations",
    owner: "artist_leo",
    image_count: 25,
    cover_color: "#DA7297"
  },
  {
    id: 10,
    title: "Minimal Aesthetics",
    description: "Less is more - simplicity in focus",
    owner: "minimalist_jane",
    image_count: 16,
    cover_color: "#F0F0F0"
  }
];

// Get logged-in user (set during init)
async function getLoggedUser() {
  if (currentLoggedUser) return currentLoggedUser;

  const token = getCookie("session_token");
  if (!token) return null;

  try {
    const response = await POSTJSONRequest({ request: "get_user_by_token", token });
    if (response.success && response.data.user_found) {
      currentLoggedUser = response.data.user_found;
      return currentLoggedUser;
    }
  } catch (err) {
    console.error("Error fetching logged user:", err);
  }
  return null;
}

// Fetch galleries from API (or use demo data initially)
async function fetchGalleriesFromAPI(page = 1) {
  try {
    // TODO: Replace with actual API call once backend endpoint exists
    // const response = await fetchAPIdataWGetParams({ request: 'list_galleries', page, limit: pageSize });
    // if (response.success) return response.data.galleries;

    // TEMPORARY: Use demo data — comment out when API is ready
    return demoDemoGalleries;
  } catch (err) {
    console.error("Error fetching galleries:", err);
    return [];
  }
}

// Load galleries with pagination
export async function loadGalleries() {
  if (isLoading || !hasMorePages) return;

  isLoading = true;
  const spinner = document.getElementById("loading-spinner");
  if (spinner) spinner.classList.remove("d-none");

  await new Promise(resolve => setTimeout(resolve, 300)); // simulate network delay

  const galleries = await fetchGalleriesFromAPI(currentPage);
  allGalleries = [...allGalleries, ...galleries];

  if (galleries.length < pageSize) {
    hasMorePages = false;
  }

  currentPage++;
  isLoading = false;

  if (spinner) spinner.classList.add("d-none");

  await renderGalleries();
  setupInfiniteScroll();
}

// Render gallery tiles
async function renderGalleries() {
  const grid = document.getElementById("galleries-grid");
  if (!grid) return;

  const loggedUser = await getLoggedUser();

  grid.innerHTML = allGalleries.map(gallery => {
    const isOwner = loggedUser && loggedUser === gallery.owner;
    const bgColor = gallery.cover_color || "#6C757D";

    return `
      <div class="col-12 col-sm-6 col-lg-4">
        <div class="card gallery-tile h-100" data-gallery-id="${gallery.id}">
          <!-- Cover -->
          <div class="gallery-cover" style="background-color: ${bgColor}; background-image: linear-gradient(135deg, ${bgColor} 0%, rgba(0,0,0,0.2) 100%);">
            <div class="gallery-cover-overlay">
              <div class="display-6">
                <i class="bi bi-images"></i>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="card-body d-flex flex-column">
            <h5 class="card-title text-primary">${gallery.title}</h5>
            <p class="card-text text-muted flex-grow-1">${gallery.description}</p>
            <small class="text-secondary mb-2">
              <i class="bi bi-person"></i> ${gallery.owner}
            </small>
            <small class="text-secondary">
              <i class="bi bi-image"></i> ${gallery.image_count} images
            </small>
          </div>

          <!-- Actions (logged in user only & if owner) -->
          ${isOwner ? `
            <div class="card-footer bg-light border-top">
              <button class="btn btn-sm btn-primary me-1 gallery-edit-btn" data-gallery-id="${gallery.id}">
                <i class="bi bi-pencil"></i> Edit
              </button>
              <button class="btn btn-sm btn-danger gallery-delete-btn" data-gallery-id="${gallery.id}">
                <i class="bi bi-trash"></i> Delete
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners to edit/delete buttons
  document.querySelectorAll('.gallery-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const galleryId = parseInt(btn.dataset.galleryId);
      handleEditGallery(galleryId);
    });
  });

  document.querySelectorAll('.gallery-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const galleryId = parseInt(btn.dataset.galleryId);
      handleDeleteGallery(galleryId);
    });
  });
}

// Setup infinite scroll via IntersectionObserver
function setupInfiniteScroll() {
  const sentinel = document.getElementById("scroll-sentinel");
  if (!sentinel) return;

  // Remove old observer if it exists
  if (window.galleryScrollObserver) {
    window.galleryScrollObserver.disconnect();
  }

  window.galleryScrollObserver = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting && hasMorePages && !isLoading) {
        loadGalleries();
      }
    },
    { rootMargin: "200px" }
  );

  window.galleryScrollObserver.observe(sentinel);
}

// Modal for creating/editing gallery
function showGalleryModal(config) {
  showGenericModal({
    title: config.title || "Gallery",
    bodyHtml: `
      <form id="gallery-form">
        <div class="mb-3">
          <label for="gallery-title" class="form-label">Title</label>
          <input type="text" class="form-control" id="gallery-title" required maxlength="100" value="${config.title || ''}">
        </div>
        <div class="mb-3">
          <label for="gallery-description" class="form-label">Description</label>
          <textarea class="form-control" id="gallery-description" rows="3" maxlength="500">${config.description || ''}</textarea>
        </div>
        <div class="mb-3">
          <label for="gallery-color" class="form-label">Cover Color</label>
          <input type="color" class="form-control form-control-color" id="gallery-color" value="${config.color || '#6C757D'}">
        </div>
      </form>
    `,
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

  // Focus title input
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
    title: "Create Gallery",
    titleValue: "",
    description: "",
    color: "#6C757D",
    isEdit: false
  });
}

// Execute create gallery
async function executeCreateGallery() {
  const titleInput = document.getElementById("gallery-title");
  const descInput = document.getElementById("gallery-description");
  const colorInput = document.getElementById("gallery-color");
  const errorField = document.getElementById("modal-alert-field");

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const color = colorInput.value;

  errorField.style.display = "none";

  // Validation
  if (title.length < 3) {
    errorField.textContent = "Title must be at least 3 characters";
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
    // TODO: Replace with actual API call
    // const response = await POSTJSONRequest({
    //   request: "create_gallery",
    //   title,
    //   description,
    //   cover_color: color,
    //   token: sessionToken
    // });

    // TEMPORARY: Add to local array
    const newGallery = {
      id: Math.max(...allGalleries.map(g => g.id), 0) + 1,
      title,
      description,
      owner: currentLoggedUser,
      image_count: 0,
      cover_color: color
    };
    allGalleries.unshift(newGallery);

    newHideModal("my_modal");
    await renderGalleries();
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
    title: "Edit Gallery",
    titleValue: gallery.title,
    description: gallery.description,
    color: gallery.cover_color,
    galleryId,
    isEdit: true
  });
}

// Execute edit gallery
async function executeEditGallery(galleryId) {
  const titleInput = document.getElementById("gallery-title");
  const descInput = document.getElementById("gallery-description");
  const colorInput = document.getElementById("gallery-color");
  const errorField = document.getElementById("modal-alert-field");

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const color = colorInput.value;

  errorField.style.display = "none";

  if (title.length < 3) {
    errorField.textContent = "Title must be at least 3 characters";
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
    // TODO: Replace with actual API call
    // const response = await POSTJSONRequest({
    //   request: "update_gallery",
    //   gallery_id: galleryId,
    //   title,
    //   description,
    //   cover_color: color,
    //   token: sessionToken
    // });

    // TEMPORARY: Update local array
    const gallery = allGalleries.find(g => g.id === galleryId);
    if (gallery) {
      gallery.title = title;
      gallery.description = description;
      gallery.cover_color = color;
    }

    newHideModal("my_modal");
    await renderGalleries();
    showFeedback("Gallery updated successfully");
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

// Execute delete gallery
async function executeDeleteGallery(galleryId) {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    showFeedback("Session token missing");
    return;
  }

  try {
    // TODO: Replace with actual API call
    // const response = await POSTJSONRequest({
    //   request: "delete_gallery",
    //   gallery_id: galleryId,
    //   token: sessionToken
    // });

    // TEMPORARY: Remove from local array
    allGalleries = allGalleries.filter(g => g.id !== galleryId);

    newHideModal("my_modal");
    await renderGalleries();
    showFeedback("Gallery deleted successfully");
  } catch (err) {
    console.error("Delete gallery error:", err);
    showFeedback("Failed to delete gallery");
  }
}
