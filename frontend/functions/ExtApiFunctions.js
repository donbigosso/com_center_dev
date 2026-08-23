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


//ISS

function getISSpositionURL(){
    return "http://api.open-notify.org/iss-now.json";
}

function getISSaustronautsLink(){
    return "http://api.open-notify.org/astros.json";
}

async function getISSastroData(){
    const link = getISSaustronautsLink();
    const response = await fetch(link);
    const data = await response.json();
    return data;
}

export async function getCurrentAstronoutNumber(){
    const data = await getISSastroData();
    return data.number;
}

export async function getCurrentAstronouts_w_text(){
    const number = await getCurrentAstronoutNumber();
    return "People in space: " + number;
}

export async function getAustronautsNames(){
    const data = await getISSastroData();
    return data.people;
}

export async function getISSposition(){
    const link = getISSpositionURL();
    const response = await fetch(link);
    const data = await response.json();
    const longitude = data.iss_position.longitude;
    const latitude = data.iss_position.latitude;
    return longitude +", " +latitude;
}


export async function updateISSPosition() {
    const resultArea2 = document.getElementById("result_2");  
  try {
    const link = getISSpositionURL();
    const response = await fetch(link);
    const data = await response.json();
    const issPosition = `ISS position: ${data.iss_position.latitude}, ${data.iss_position.longitude}`;
    resultArea2.textContent = issPosition;
  } catch (error) {
    resultArea2.textContent = 'Error fetching ISS position';
    console.error(error);
  }
}

export function startISSPositionUpdate() {
  updateISSPosition();
  setInterval(() => {
    updateISSPosition();
  }, 5000);
}






