import { onClick } from "../functions/EventFunctions.js";
import { showLoginModal } from "../functions/NewModalMethods.js";
import { handleAutoLogin, handleLogout } from "../functions/LoginFunctions.js";
import { initApiAddressCache, initFileSettingsCache } from "../functions/CustomFunctions.js";
import { initGalleryPreview, attachGalleryPreviewOwnerHandlers } from "../functions/GalleryFunctions.js";

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await initApiAddressCache();
    await initFileSettingsCache();
    await initGalleryPreview();
    handleAutoLogin();
    attachGalleryPreviewOwnerHandlers();
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
});
