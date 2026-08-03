import {
  requestSendTableAdmin,
  createUser,
  deleteUserByAdmin,
  resetUserPasswordByAdmin,
  listGalleriesAdmin,
  deleteGalleryByAdmin,
} from "./functions/RequestFunctions.js";
import {
  drawTable,
  drawUserCreationForm,
  drawUserDeletionForm,
  drawPasswordChangeForm,
  createGalleriesTableWrapper,
  createGalleryTableRow,
  drawGalleryDeletionForm,
} from "./functions/PageAppearance.js";
import {
  showFeedback,
  showUserDeleteFeedback,
  showGalleryDeleteFeedback,
} from "./functions/CustomFunctions.js";
import { createInfiniteScroller } from "./functions/CoreFunctions.js";

const GALLERY_LIST_PAGE_SIZE = 50;

/** @type {{ destroy?: Function } | null} */
let galleriesScroller = null;

function destroyGalleriesScroller() {
  if (galleriesScroller && typeof galleriesScroller.destroy === "function") {
    try {
      galleriesScroller.destroy();
    } catch (err) {
      console.warn("destroyGalleriesScroller:", err);
    }
  }
  galleriesScroller = null;
}

function getResultArea() {
  return document.getElementById("result-area");
}

function clearResultArea() {
  destroyGalleriesScroller();
  const resultArea = getResultArea();
  if (resultArea) resultArea.innerHTML = "";
  return resultArea;
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`Admin tile not found: #${id}`);
    return;
  }
  el.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await handler();
    } catch (err) {
      console.error(`Tile #${id} error:`, err);
      showFeedback(err?.message || "Something went wrong.", "red");
    }
  });
}

async function loadUsersTable() {
  const resultArea = clearResultArea();
  if (!resultArea) return;

  const tableRequest = await requestSendTableAdmin(
    "users",
    [],
    ["user_id", "name", "is_admin", "register_date"]
  );
  if (!tableRequest?.success || !Array.isArray(tableRequest.data)) {
    showFeedback(tableRequest?.error || "Failed to load users table.", "red");
    return;
  }
  resultArea.appendChild(drawTable(tableRequest.data, "nice-table"));
}

async function loadMediaCollectionsTable() {
  const resultArea = clearResultArea();
  if (!resultArea) return;

  const tableRequest = await requestSendTableAdmin(
    "media_collections",
    [],
    [
      "media_collection_id",
      "title",
      "description",
      "register_date",
      "collection_cover_id",
    ]
  );
  if (!tableRequest?.success || !Array.isArray(tableRequest.data)) {
    showFeedback(
      tableRequest?.error || "Failed to load media collections.",
      "red"
    );
    return;
  }
  resultArea.appendChild(drawTable(tableRequest.data, "nice-table"));
}

async function showCreateUserForm() {
  const resultArea = clearResultArea();
  if (!resultArea) return;
  resultArea.appendChild(
    drawUserCreationForm(({ username, password }) => {
      createUser(username, password);
    })
  );
}

async function showDeleteUserForm() {
  const resultArea = clearResultArea();
  if (!resultArea) return;

  const tableRequest = await requestSendTableAdmin("users", [], ["name"]);
  if (!tableRequest?.success || !Array.isArray(tableRequest.data)) {
    showFeedback(tableRequest?.error || "Failed to load users.", "red");
    return;
  }
  const userList = tableRequest.data.flat().filter(Boolean).slice(1);
  resultArea.appendChild(
    drawUserDeletionForm(userList, async ({ username }) => {
      const serverResponse = await deleteUserByAdmin(username);
      if (serverResponse?.success) {
        showUserDeleteFeedback(username);
        return true;
      }
      showFeedback(
        serverResponse?.error || `Failed to delete user ${username}.`,
        "red"
      );
      return false;
    })
  );
}

async function showChangePasswordForm() {
  const resultArea = clearResultArea();
  if (!resultArea) return;

  const tableRequest = await requestSendTableAdmin("users", [], ["name"]);
  if (!tableRequest?.success || !Array.isArray(tableRequest.data)) {
    showFeedback(tableRequest?.error || "Failed to load users.", "red");
    return;
  }
  const userList = tableRequest.data.flat().filter(Boolean).slice(1);
  resultArea.appendChild(
    drawPasswordChangeForm(userList, async ({ username, password }) => {
      const response = await resetUserPasswordByAdmin(username, password);
      if (response?.success) {
        showFeedback(`Password for "${username}" changed successfully.`);
      } else {
        showFeedback(
          response?.error || "Could not change password.",
          "red"
        );
      }
    })
  );
}

async function loadGalleriesList() {
  const resultArea = clearResultArea();
  if (!resultArea) return;

  const heading = document.createElement("h5");
  heading.className = "text-muted mb-3 px-1";
  heading.textContent = "Galleries (scroll for more)";
  resultArea.appendChild(heading);

  galleriesScroller = createInfiniteScroller({
    pageSize: GALLERY_LIST_PAGE_SIZE,
    fetchPage: async (page, pageSize) => {
      const response = await listGalleriesAdmin(page, pageSize);
      if (!response?.success) {
        showFeedback(response?.error || "Failed to load galleries.", "red");
        return { items: [], hasMore: false };
      }
      const data = response.data || {};
      const items = Array.isArray(data.galleries) ? data.galleries : [];
      return {
        items,
        hasMore: Boolean(data.has_more),
      };
    },
    createWrapper: createGalleriesTableWrapper,
    createItem: createGalleryTableRow,
    target: resultArea,
    sentinelId: "admin-galleries-scroll-sentinel",
    rootMargin: "240px",
  });

  await galleriesScroller.start();
}

async function showDeleteGalleryForm() {
  const resultArea = clearResultArea();
  if (!resultArea) return;

  const galleries = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const response = await listGalleriesAdmin(page, 100);
    if (!response?.success) {
      showFeedback(response?.error || "Failed to load galleries.", "red");
      return;
    }
    const batch = Array.isArray(response.data?.galleries)
      ? response.data.galleries
      : [];
    galleries.push(...batch);
    hasMore = Boolean(response.data?.has_more) && batch.length > 0;
    page += 1;
  }

  if (galleries.length === 0) {
    showFeedback("No galleries found.", "red");
    return;
  }

  resultArea.appendChild(
    drawGalleryDeletionForm(galleries, async ({ galleryId, title }) => {
      const serverResponse = await deleteGalleryByAdmin(galleryId);
      if (serverResponse?.success) {
        const mediaDeleted = serverResponse.data?.media_deleted ?? 0;
        showGalleryDeleteFeedback(
          `#${galleryId}${title ? ` (${title})` : ""} — ${mediaDeleted} media removed`
        );
        return true;
      }
      showFeedback(
        serverResponse?.error || `Failed to delete gallery #${galleryId}.`,
        "red"
      );
      return false;
    })
  );
}

function initAdminTiles() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      window.location.href = "./logout.php";
    });
  }

  bindClick("tile-users", loadUsersTable);
  bindClick("tile-create-user", showCreateUserForm);
  bindClick("tile-delete-user", showDeleteUserForm);
  bindClick("tile-change-password", showChangePasswordForm);
  bindClick("tile-media-collections", loadMediaCollectionsTable);
  bindClick("tile-list-galleries", loadGalleriesList);
  bindClick("tile-delete-gallery", showDeleteGalleryForm);

  console.info("Admin tiles initialized.");
}

// Modules are deferred, but bind after DOM is ready for safety
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdminTiles);
} else {
  initAdminTiles();
}
