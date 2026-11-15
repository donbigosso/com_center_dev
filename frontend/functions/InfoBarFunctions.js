import {

  getEUR_PLNrate,
  getUSD_PLNrate,
  getPLN_GMDrate,
  getEUR_GMDrate,
  getGBP_PLNrate,
  getEUR_USDrate,
  getBTC_USDrate,
  getETH_USDrate,
  getBTC_PLNrate,
  getETH_PLNrate,
  

} from "./ExtApiFunctions.js";




const infobarLabels = {
  EUR_PLN:"EUR/PLN: ",
  USD_PLN:"USD/PLN: ",
  PLN_GMD:"PLN/GMD: ",
  EUR_GMD:"EUR/GMD: ",
  GBP_PLN:"GBP/PLN: ",
  EUR_USD:"EUR/USD: ",
  BTC_USD:"BTC/USD: ",
  ETH_USD:"ETH/USD: ",
  BTC_PLN:"BTC/PLN: ",
  ETH_PLN:"ETH/PLN: ",
}

const infobarValues = {
  EUR_PLN: "n/a",
  USD_PLN: "n/a",
  PLN_GMD: "n/a",
  EUR_GMD: "n/a",
  GBP_PLN: "n/a",
  EUR_USD: "n/a",
  BTC_USD: "n/a",
  ETH_USD: "n/a",
  BTC_PLN: "n/a",
  ETH_PLN: "n/a",
}

async function upateAllItems() {
  // Update all infobar values
  infobarValues.EUR_PLN = await getEUR_PLNrate();
  infobarValues.USD_PLN = await getUSD_PLNrate();
  infobarValues.PLN_GMD = await getPLN_GMDrate();
  infobarValues.EUR_GMD = await getEUR_GMDrate();
  infobarValues.GBP_PLN = await getGBP_PLNrate();
  infobarValues.EUR_USD = await getEUR_USDrate();
  infobarValues.BTC_USD = await getBTC_USDrate();
  infobarValues.ETH_USD = await getETH_USDrate();
  infobarValues.BTC_PLN = await getBTC_PLNrate();
  infobarValues.ETH_PLN = await getETH_PLNrate();
}

async function adjustAllItems() {
  // Adjust all infobar values
  Object.keys(infobarValues).forEach(key => {
    updateInfobarItem(key);
  });
}

async function upadteAndAdjustAllItems(){
  await upateAllItems();
  await adjustAllItems();
}

const verifyLabelValueAmount = ()=>{
  let labelAmount = Object.keys(infobarLabels).length;
  let valueAmount = Object.keys(infobarValues).length;
  
  if (labelAmount !== valueAmount) {
    console.error("Infobar: label and value amounts do not match");
    return false;
  }
  
  return true;
}

const verifyInfobarKey = (key) => {
  return Object.keys(infobarLabels).includes(key) && Object.keys(infobarValues).includes(key);
}




const PIXELS_PER_SECOND = 40; // scroll speed, lower = slower

function addInfobarItem(track, key) {
  if (track.children.length > 0) {
    const sep = document.createElement("span");
    sep.className = "cc-infobar-sep";
    sep.textContent = "•";
    sep.setAttribute("aria-hidden", "true");
    track.appendChild(sep);
  }
  const item = document.createElement("span");
  item.className = "cc-infobar-item";
  item.dataset.key = key;                       // instead of id
  item.textContent = infobarLabels[key] + infobarValues[key];
  track.appendChild(item);
}


const updateInfobarItem = (key) => {
  if (!verifyInfobarKey(key)) {
    console.error(`Infobar: key (${key}) not found. Can't update.`);
    return;
  }
  // update every copy (original + clones)
  document.querySelectorAll(`.cc-infobar-item[data-key="${key}"]`)
    .forEach(item => {
      item.textContent = infobarLabels[key] + infobarValues[key];
    });
};

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
  if (!verifyLabelValueAmount()) return;
  // --- MOCK DATA (shows immediately) ---
  


  
  addInfobarItem(content, "EUR_PLN");

  addInfobarItem(content, "USD_PLN");
  addInfobarItem(content, "PLN_GMD");
  addInfobarItem(content, "EUR_GMD");
  addInfobarItem(content, "GBP_PLN");
  addInfobarItem(content, "EUR_USD");
  addInfobarItem(content, "BTC_USD");
  addInfobarItem(content, "ETH_USD");
  addInfobarItem(content, "BTC_PLN");
  addInfobarItem(content, "ETH_PLN");
  upadteAndAdjustAllItems()
  

  console.log("Debug1311 (content):", content);
  duplicateTrackForLoop(content);
  startInfobarScroll(content);
  document.getElementById("cc-infobar")?.classList.remove("d-none");
}
