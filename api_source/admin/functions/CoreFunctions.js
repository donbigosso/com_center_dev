export function checkHTMLInstance (element){
  if (element instanceof HTMLElement) {
    return true;
  }
  else {
    console.warn("Invalid element: ", element);
    return false;
  }
}

export async function getSetting(key) {
  try {
    const randomString = Math.random().toString(36).substring(2, 12);
    const response = await fetch("./settings.json?nocache="+randomString);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const settings = await response.json();

    if (!(key in settings)) {
      throw new Error(`Key "${key}" not found in settings.`);
    }

    return settings[key];
  } catch (error) {
    console.error("Error fetching setting:", error.message);
    return null;
  }
}

export function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

export function buildURLWithParams(baseURL, params) {
  if (!params || Object.keys(params).length === 0) {
    return baseURL;
  }
  
  // Check if URL already has query parameters
  const separator = baseURL.includes('?') ? '&' : '?';
  
  // Build query string, handling arrays and special characters
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle array parameters: tags[]=ai&tags[]=quantum
        return value
          .map(item => `${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`)
          .join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
  
  return `${baseURL}${separator}${queryString}`;
}

//usage example:
// const apiURL = "https://api.example.com/data";
// const params = { search: "test", page: 2, tags: ["ai", "quantum"] };
// const fullURL = buildURLWithParams(apiURL, params);
// console.log(fullURL); // "https://api.example.com/data?search=test&page=2&tags[]=ai&tags[]=quantum"


export async function fetchAPIdata() {
  
  const  apiAddress = await getSetting("api_address");
  if (!apiAddress) {
    console.error("API address is not defined in settings.");
    return null;
  }

  try {
    const response = await fetch(apiAddress);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching API data:", error.message);
    return null;
  }
}

export async function fetchAPIdataWGetParams(params) {
  const rawApiAddress = await getSetting("api_address");
  if (!rawApiAddress) {
    console.error("API address is not defined in settings.");
    return null;
  }
  const apiAddress = await buildURLWithParams(rawApiAddress, params);
  

  try {
    const response = await fetch(apiAddress);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching API data:", error.message);
    return null;
  }
}

export async function downloadFile(url, filename) {
  const response = await fetch(url);
  const blob = await response.blob();
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(link.href); // cleanup
}



export async function POSTJSONRequest(params) {
  const rawApiAddress = await getSetting("api_address");
  if (!rawApiAddress) {
    console.error("API address is not defined in settings.");
    return null;
  }

  

  try {
    const response = await fetch(rawApiAddress, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching POST data:", error.message);
    return null;
  }

}

export async function verifyUserByPassword (username, password) {
  const params = {request: "verify_user_password", name: username, password: password}
  const apiResponse = await POSTJSONRequest(params);
  if (apiResponse.success=true){
    // return apiResponse.data.password_verified;
    return apiResponse;
    
  }

  
  

  
}

export async function checkIfTokenExist(token){
    const tokenTest = await POSTJSONRequest({request: "check_token_existence",token: token});
    return tokenTest.success;
}

// Usage
// downloadFile('https://example.com/path/to/file.pdf', 'file.pdf');