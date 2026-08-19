import { onClick } from "./functions/EventFunctions.js";
import { showLoginModal } from "./functions/NewModalMethods.js";
import { handleAutoLogin, handleLogout } from "./functions/LoginFunctions.js";
import { initApiAddressCache, initFileSettingsCache, showFeedback } from "./functions/CustomFunctions.js";
import { validateContactForm } from "./functions/FormValidation.js";
import { getSetting } from "./functions/CoreFunctions.js";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const CONTACT_SUBJECT = "Donbigosso Command Center - message";

function initContactForm() {
  const form = document.getElementById("cc-contact-form");
  if (!form) return;

  const nameInput = document.getElementById("contact-name");
  const emailInput = document.getElementById("contact-email");
  const messageInput = document.getElementById("contact-message");
  const alertField = document.getElementById("contact-alert-field");
  const submitBtn = document.getElementById("contact-submit-btn");

  const hideAlert = () => {
    if (!alertField) return;
    alertField.classList.add("d-none");
    alertField.textContent = "";
  };

  const showAlert = (text) => {
    if (!alertField) return;
    alertField.textContent = text;
    alertField.classList.remove("d-none");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const name = (nameInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const message = (messageInput?.value || "").trim();

    const validation = validateContactForm(name, email, message);
    if (!validation.valid) {
      showAlert(validation.error);
      return;
    }

    const accessKey = await getSetting("web3forms_access_key");
    if (!accessKey) {
      showAlert("Contact form is not configured (missing access key).");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject: CONTACT_SUBJECT,
          from_name: name,
          name,
          email,
          message,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        showAlert(result?.message || "Could not send the message. Please try again.");
        return;
      }

      showFeedback("Message sent");
      form.reset();
    } catch (err) {
      console.error("Web3Forms submit failed:", err);
      showAlert("Could not send the message. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send message";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await initApiAddressCache();
    await initFileSettingsCache();
    await handleAutoLogin();
  })();

  const loginButton = document.querySelector("#login-btn");
  const logoutButton = document.querySelector("#logout-btn");

  onClick(loginButton, () => {
    showLoginModal();
  });

  onClick(logoutButton, async () => {
    handleLogout();
  });

  initContactForm();
});
