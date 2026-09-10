import { onClick } from "./functions/EventFunctions.js";
import { showLoginModal } from "./functions/NewModalMethods.js";
import { handleAutoLogin, handleLogout } from "./functions/LoginFunctions.js";
import { getSessionToken, initApiAddressCache, initFileSettingsCache } from "./functions/CustomFunctions.js";
import { getUserByToken } from "./functions/RequestFunctions.js";
import {
  createEditPostForm,
  getPost,
  renderPostCardWithMedia,
} from "./functions/PostFunctions.js";

function parsePostId() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("post_id") || params.get("id");
  const postId = Number.parseInt(String(raw || "").trim(), 10);
  return Number.isInteger(postId) && postId > 0 ? postId : 0;
}

function showParamAlert(message) {
  const alert = document.getElementById("edit-post-param-alert");
  if (!alert) return;
  alert.textContent = message;
  alert.classList.remove("d-none");
}

function hideParamAlert() {
  const alert = document.getElementById("edit-post-param-alert");
  if (!alert) return;
  alert.textContent = "";
  alert.classList.add("d-none");
}

function setPanelVisible(id, visible) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.toggle("d-none", !visible);
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

function canEditPost(user, post) {
  if (!user || !post) return false;
  if (user.isAdmin) return true;
  return Boolean(post.author) && user.name === post.author;
}

async function renderSavedPost(post) {
  const slot = document.getElementById("edit-post-saved-slot");
  const panel = document.getElementById("edit-post-saved");
  if (!slot || !panel) return;
  slot.replaceChildren();
  slot.appendChild(await renderPostCardWithMedia(post));
  panel.classList.remove("d-none");
}

async function mountEditor(post) {
  const formSlot = document.getElementById("edit-post-form-slot");
  const title = document.getElementById("edit-post-title");
  if (title) {
    title.textContent = post.topic ? `Edit: ${post.topic}` : `Edit post #${post.post_id}`;
  }
  if (!formSlot) return;
  formSlot.replaceChildren();
  setPanelVisible("edit-post-compose", true);
  await createEditPostForm(formSlot, {
    post,
    onSaved: async (updated) => {
      await renderSavedPost(updated);
    },
  });
  await renderSavedPost(post);
}

async function initEditPage() {
  hideParamAlert();
  setPanelVisible("edit-post-compose", false);
  setPanelVisible("edit-post-saved", false);

  const postId = parsePostId();
  if (!postId) {
    showParamAlert("Missing post id. Open this screen with ?post_id=xx.");
    return;
  }

  const user = await getSessionUserInfo();
  if (!user) {
    showParamAlert("Log in to edit this post.");
    return;
  }

  const response = await getPost(postId);
  const post = response?.data?.post;
  if (!response?.success || !post) {
    showParamAlert(response?.error || "Post not found.");
    return;
  }

  if (!canEditPost(user, post)) {
    showParamAlert("Only the author or an admin can edit this post.");
    return;
  }

  hideParamAlert();
  await mountEditor(post);
}

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await initApiAddressCache();
    await initFileSettingsCache();
    await handleAutoLogin();
    await initEditPage();
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
