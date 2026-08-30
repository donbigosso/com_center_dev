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
  getETH_PLN_w_text,
} from "./ExtApiFunctions.js";

const PIXELS_PER_SECOND = 40; // scroll speed, lower = slower

function addInfobarItem(track, text) {
  if (track.children.length > 0) {
    const sep = document.createElement("span");
    sep.className = "cc-infobar-sep";
    sep.textContent = "•";
    sep.setAttribute("aria-hidden", "true");
    track.appendChild(sep);
  }
  const item = document.createElement("span");
  item.className = "cc-infobar-item";
  item.textContent = text;
  track.appendChild(item);
}

// Runs a fetcher and adds its result to the bar; on failure it's silently
// skipped (no item, no error shown to the user).
async function addInfobarItemSafe(track, fetcher) {
  try {
    addInfobarItem(track, await fetcher());
  } catch (err) {
    console.error("Infobar item failed, skipping:", err);
  }
}

// Duplicates the built items once, so the track can loop seamlessly:
// animating from translateX(0) to translateX(-50%) shows copy 1 then copy 2
// with no visible seam.
function duplicateTrackForLoop(content) {
  Array.from(content.children).forEach((child) => {
    content.appendChild(child.cloneNode(true));
  });
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

  duplicateTrackForLoop(content);
  startInfobarScroll(content);

  document.getElementById("cc-infobar")?.classList.remove("d-none");
}
