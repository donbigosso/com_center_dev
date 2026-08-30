// currencies
function createNBPConversionLink(table,currency){
    let linkBeg = "https://api.nbp.pl/api/exchangerates/rates/"
    let linkEnd = "?format=json";
    return linkBeg + table + "/" + currency + "/" + linkEnd;
}

async function getNBPConversion(table, currency) {
    const link = createNBPConversionLink(table, currency);
    const response = await fetch(link);
    const data = await response.json();
    return data.rates[0].mid;
}

export async function getUSD_PLNrate(){
    let rate = await getNBPConversion("a", "usd");
    return rate.toFixed(2);
}

export async function getUSD_PLN_w_text(){
    let rate = await getNBPConversion("a", "usd");
    return "USD/PLN: " + rate.toFixed(2);
}

export async function getEUR_PLNrate(){
    let rate = await getNBPConversion("a", "eur");
    return rate.toFixed(2);
}

export async function getEUR_PLN_w_text(){
    let rate = await getNBPConversion("a", "eur");
    return "EUR/PLN: " + rate.toFixed(2);
}

export async function getGBP_PLNrate(){
    let rate = await getNBPConversion("a", "gbp");
    return rate.toFixed(2);
}

export async function get_GBP_PLN_w_text(){
    let rate = await getNBPConversion("a", "gbp");
    return "GBP/PLN: " + rate.toFixed(2);
}

export async function getEUR_USDrate(){
    let USD_PLN = await getNBPConversion("a", "usd");
    let EUR_PLN = await getNBPConversion("a", "eur");
    return (EUR_PLN / USD_PLN).toFixed(2);
}

export async function getEUR_USD_w_text(){
    let rate = await getEUR_USDrate();
    return "EUR/USD: " + rate;
}
//Frankfurt Bank
function createECBconversionLink(currency1, currency2){
  //https://api.frankfurter.dev/v2/rates?base=PLN&quotes=GMD
  let beginining = "https://api.frankfurter.dev/v2/rates?base=";
  let end = "&quotes=" + currency2;
  let finalLink = beginining + currency1 + end;
  return finalLink;

}

async function getECBConversion(currency1, currency2) {
  const link = createECBconversionLink(currency1, currency2);
  const response = await fetch(link);
  const data = await response.json();
  return data[0].rate;
}

export async function getPLN_GMD_w_text(){  
  let rate = await getECBConversion("PLN", "GMD");
  return "PLN/GMD: " + rate.toFixed(2);
}

export async function getEUR_GMD_w_text(){  
  let rate = await getECBConversion("EUR", "GMD");
  return "EUR/GMD: " + rate.toFixed(2);
}


// crypto (FreeCryptoAPI)

const FREECRYPTOAPI_BASE = "https://api.freecryptoapi.com/v1";
let cachedFreeCryptoApiKey = null;

async function fetchWithTimeout(url, timeoutMs = 5000, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getFreeCryptoApiKey() {
  if (cachedFreeCryptoApiKey) return cachedFreeCryptoApiKey;
  const { getSetting } = await import("./CoreFunctions.js");
  const key = await getSetting("freecryptoapi_key");
  if (!key) throw new Error("freecryptoapi_key not set in settings.json");
  cachedFreeCryptoApiKey = key;
  return key;
}

async function getFreeCryptoData(symbol) {
  const apiKey = await getFreeCryptoApiKey();
  const url = new URL(FREECRYPTOAPI_BASE + "/getData");
  url.searchParams.set("symbol", symbol);
  const data = await fetchWithTimeout(url.toString(), 5000, {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  });
  const entry = Array.isArray(data) ? data[0] : (data.symbols ? data.symbols[0] : data);
  const price = entry?.last ?? entry?.price ?? entry?.value;
  if (price === undefined) {
    console.error("FreeCryptoAPI raw response:", JSON.stringify(data));
    throw new Error("Unexpected FreeCryptoAPI response shape");
  }
  return Number(price);
}

export async function getBTC_USDrate() {
  const price = await getFreeCryptoData("BTC");
  return price.toFixed(2);
}

export async function getETH_USDrate() {
  const price = await getFreeCryptoData("ETH");
  return price.toFixed(2);
}

export async function getBTC_USD_w_text() {
  const rate = await getBTC_USDrate();
  return "BTC/USD: " + rate;
}

export async function getETH_USDrate_w_text(){
  const rate = await getETH_USDrate();
  return "ETH/USD: " + rate;
}

export async function getBTC_PLNrate() {
  const btcUsd = await getFreeCryptoData("BTC");
  const usdPln = await getNBPConversion("a", "usd");
  return (btcUsd * usdPln).toFixed(2);
}

export async function getETH_PLrate(){
  const ethUsd = await getFreeCryptoData("ETH");
  const usdPln = await getNBPConversion("a", "usd");
  return (ethUsd * usdPln).toFixed(2);
}

export async function getETH_PLN_w_text(){
  const rate = await getETH_PLrate();
  return "ETH/PLN: " + rate;
}

export async function getBTC_PLN_w_text() {
  const rate = await getBTC_PLNrate();
  return "BTC/PLN: " + rate;
}

