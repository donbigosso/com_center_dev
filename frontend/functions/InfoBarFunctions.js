import {
  getEUR_PLN_w_text,
  getUSD_PLN_w_text,
  get_GBP_PLN_w_text,
  getEUR_USD_w_text,
  getBTC_PLN_w_text,
  getBTC_USD_w_text,
  getETH_USDrate_w_text,
  getPLN_GMD_w_text,
  getEUR_GMD_w_text,
  getCurrentAstronouts_w_text,
  getISSposition,
  startISSPositionUpdate,
  getETH_PLN_w_text,
  getAstronoutsHTML,
} from "./ExtApiFunctions.js";
import { showGenericModal } from "./NewModalMethods.js";

const ISS_ITEM_ID = "cc-infobar-iss";
const ASTRONAUTS_ITEM_ID = "cc-infobar-astronauts";
const PIXELS_PER_SECOND = 40; // scroll speed, lower = slower

function createInfobarSeparator() {
  const sep = document.createElement("span");
  sep.className = "cc-infobar-sep";
  sep.textContent = "•";
  sep.setAttribute("aria-hidden", "true");
  return sep;
}

function addInfobarItem(track, text) {
  if (track.children.length > 0) {
    track.appendChild(createInfobarSeparator());
  }
  const item = document.createElement("span");
  item.className = "cc-infobar-item";
  item.textContent = text;
  track.appendChild(item);
  return item;
}

// Runs a fetcher and adds its result to the bar; on any failure it's
// silently skipped (no item, no error shown to the user).
async function addInfobarItemSafe(track, fetcher) {
  try {
    const text = await fetcher();
    return addInfobarItem(track, text);
  } catch (err) {
    console.error("Infobar item failed, skipping:", err);
    return null;
  }
}

async function showAstronautsModal() {
  let bodyHtml;
  try {
    bodyHtml = await getAstronoutsHTML();
  } catch (err) {
    console.error("Failed to load astronaut list:", err);
    bodyHtml = "<p>Could not load astronaut data right now.</p>";
  }
  showGenericModal({
    title: "People currently in space",
    bodyHtml,
    buttons: [{ hidden: true }, { hidden: true }, { hidden: true }],
  });
}

function makeItemClickable(item, onClick) {
  if (!item) return;
  item.classList.add("cc-infobar-item-clickable");
  item.setAttribute("role", "button");
  item.setAttribute("tabindex", "0");
  item.addEventListener("click", onClick);
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  });
}

// Duplicates the built items once, so the track can loop seamlessly:
// animating from translateX(0) to translateX(-50%) shows copy 1 then copy 2
// with no visible seam.
// Returns the clone of the ISS item (if any), so its text can be kept in
// sync with the original on later refreshes.
function duplicateTrackForLoop(content) {
  const originalChildren = Array.from(content.children);
  let issItemClone = null;
  originalChildren.forEach((child) => {
    const clone = child.cloneNode(true);
    // Re-wire click handlers on the astronaut item's clone (cloneNode does
    // not copy JS listeners), and drop the duplicate id.
    if (clone.id === ASTRONAUTS_ITEM_ID) {
      clone.removeAttribute("id");
      makeItemClickable(clone, showAstronautsModal);
    } else if (clone.id === ISS_ITEM_ID) {
      clone.removeAttribute("id");
      issItemClone = clone;
    } else if (clone.id) {
      clone.removeAttribute("id");
    }
    content.appendChild(clone);
  });
  return issItemClone;
}

// The ISS item refreshes its text every 5s via startISSPositionUpdate, which
// only knows about the original (by id). Mirror those text changes onto the
// duplicate copy so both stay in sync as the ticker loops.
function mirrorIssUpdates(source, clone) {
  const observer = new MutationObserver(() => {
    clone.textContent = source.textContent;
    clone.classList.toggle("d-none", source.classList.contains("d-none"));
  });
  observer.observe(source, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

function startInfobarScroll(content) {
  const trackWidth = content.scrollWidth / 2; // content now holds two copies
  const viewportWidth = content.parentElement?.clientWidth || 0;
  if (trackWidth <= viewportWidth) return; // nothing to scroll, avoid pointless motion

  const duration = trackWidth / PIXELS_PER_SECOND;
  content.style.setProperty("--cc-infobar-duration", duration + "s");

  content.addEventListener("mouseenter", () => content.classList.add("cc-infobar-paused"));
  content.addEventListener("mouseleave", () => content.classList.remove("cc-infobar-paused"));
}

export async function initInfobar() {
  const content = document.getElementById("cc-infobar-content");
  if (!content) return;

  await addInfobarItemSafe(content, getEUR_PLN_w_text);
  await addInfobarItemSafe(content, getUSD_PLN_w_text);
  await addInfobarItemSafe(content, getPLN_GMD_w_text);
  await addInfobarItemSafe(content, getEUR_GMD_w_text);
  await addInfobarItemSafe(content, get_GBP_PLN_w_text);
  await addInfobarItemSafe(content, getEUR_USD_w_text);
  await addInfobarItemSafe(content, getBTC_USD_w_text);
  await addInfobarItemSafe(content, getETH_USDrate_w_text);
  await addInfobarItemSafe(content, getBTC_PLN_w_text);
  await addInfobarItemSafe(content, getETH_PLN_w_text);

  const issItem = await addInfobarItemSafe(content, async () => "ISS position: " + (await getISSposition()));
  if (issItem) {
    issItem.id = ISS_ITEM_ID;
    startISSPositionUpdate(ISS_ITEM_ID);
  }

  // Small stagger so this call doesn't fire in the same instant as the ISS
  // position call above and trip open-notify's rate limit together.
  await new Promise((r) => setTimeout(r, 800));
  const astronautsItem = await addInfobarItemSafe(content, getCurrentAstronouts_w_text);
  if (astronautsItem) {
    astronautsItem.id = ASTRONAUTS_ITEM_ID;
    makeItemClickable(astronautsItem, showAstronautsModal);
  }

  const issClone = duplicateTrackForLoop(content);
  if (issItem && issClone) mirrorIssUpdates(issItem, issClone);
  startInfobarScroll(content);
}



export function showInfobarAfter(miliseconds){
  let infobarElement = document.getElementById("cc-infobar");
  if (infobarElement) {
    setTimeout(() => {
      infobarElement.classList.remove("d-none");
    }, miliseconds);
  }
}