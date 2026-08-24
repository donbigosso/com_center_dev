import {
  getEUR_PLN_w_text,
  getUSD_PLN_w_text,
  get_GBP_PLN_w_text,
  getEUR_USD_w_text,
  getBTC_PLN_w_text,
  getBTC_USD_w_text,
  getCurrentAstronouts_w_text,
  getISSposition,
  startISSPositionUpdate,
} from "./ExtApiFunctions.js";

const ISS_ITEM_ID = "cc-infobar-iss";

function createInfobarSeparator() {
  const sep = document.createElement("span");
  sep.className = "cc-infobar-sep";
  sep.textContent = "•";
  sep.setAttribute("aria-hidden", "true");
  return sep;
}

function addInfobarItem(container, text) {
  if (container.children.length > 0) {
    container.appendChild(createInfobarSeparator());
  }
  const item = document.createElement("span");
  item.className = "cc-infobar-item";
  item.textContent = text;
  container.appendChild(item);
  return item;
}

// Runs a fetcher and adds its result to the bar; on any failure it's
// silently skipped (no item, no error shown to the user).
async function addInfobarItemSafe(container, fetcher) {
  try {
    const text = await fetcher();
    return addInfobarItem(container, text);
  } catch (err) {
    console.error("Infobar item failed, skipping:", err);
    return null;
  }
}

function checkInfobarOverflow() {
  const content = document.getElementById("cc-infobar-content");
  const toggle = document.getElementById("cc-infobar-toggle");
  if (!content || !toggle) return;

  if (content.classList.contains("cc-infobar-expanded")) return;

  const isOverflowing = content.scrollHeight > content.clientHeight + 1;
  toggle.classList.toggle("d-none", !isOverflowing);
}

function initInfobarToggle() {
  const content = document.getElementById("cc-infobar-content");
  const toggle = document.getElementById("cc-infobar-toggle");
  const icon = toggle?.querySelector("i");
  if (!content || !toggle) return;

  toggle.addEventListener("click", () => {
    const expanded = content.classList.toggle("cc-infobar-expanded");
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-label", expanded ? "Show less" : "Show more");
    if (icon) {
      icon.className = expanded ? "bi bi-chevron-up" : "bi bi-chevron-down";
    }
    if (!expanded) {
      checkInfobarOverflow();
    }
  });
}

export async function initInfobar() {
  const content = document.getElementById("cc-infobar-content");
  if (!content) return;

  initInfobarToggle();

  await addInfobarItemSafe(content, getEUR_PLN_w_text);
  await addInfobarItemSafe(content, getUSD_PLN_w_text);
  await addInfobarItemSafe(content, get_GBP_PLN_w_text);
  await addInfobarItemSafe(content, getEUR_USD_w_text);
  await addInfobarItemSafe(content, getBTC_PLN_w_text);
  await addInfobarItemSafe(content, getBTC_USD_w_text);

  const issItem = await addInfobarItemSafe(content, async () => "ISS position: " + (await getISSposition()));
  if (issItem) {
    issItem.id = ISS_ITEM_ID;
    startISSPositionUpdate(ISS_ITEM_ID);
    // Re-check overflow after each refresh, since a failed refresh hides the item.
    setInterval(checkInfobarOverflow, 5000);
  }

  // Small stagger so this call doesn't fire in the same instant as the ISS
  // position call above and trip open-notify's rate limit together.
  await new Promise((r) => setTimeout(r, 800));
  await addInfobarItemSafe(content, getCurrentAstronouts_w_text);

  checkInfobarOverflow();
  window.addEventListener("resize", checkInfobarOverflow);
}
