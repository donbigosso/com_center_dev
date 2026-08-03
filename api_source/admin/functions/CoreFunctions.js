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

/**
 * Resolve settings api_address to an absolute URL (handles "../api_engine.php").
 */
export function resolveApiAddress(rawApiAddress) {
  if (!rawApiAddress) return null;
  const raw = String(rawApiAddress);
  try {
    if (typeof window !== "undefined" && window.location?.href) {
      return new URL(raw, window.location.href).href;
    }
  } catch (err) {
    console.error("Invalid api_address:", raw, err);
  }
  return raw;
}

export async function fetchAPIdataWGetParams(params) {
  const rawApiAddress = await getSetting("api_address");
  if (!rawApiAddress) {
    console.error("API address is not defined in settings.");
    return null;
  }
  const base = resolveApiAddress(rawApiAddress);
  const apiAddress = buildURLWithParams(base, params);

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

  const apiAddress = resolveApiAddress(rawApiAddress);

  try {
    const response = await fetch(apiAddress, {
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
/**
 * Universal Infinite Scroller (API page-by-page version)
 *
 * @param {Object} options
 * @param {number}   [options.pageSize=20]
 * @param {Function} options.fetchPage     - async (page, pageSize) => Promise<{items: Array, hasMore: boolean}>
 * @param {Function} options.createWrapper - () => HTMLElement
 * @param {Function} options.createItem    - (item) => HTMLElement
 * @param {HTMLElement} options.target     - Where to put the wrapper
 * @param {string}   [options.sentinelId="infinite-scroll-sentinel"]
 * @param {string}   [options.rootMargin="200px"]
 */
export function createInfiniteScroller({
  pageSize = 20,
  fetchPage,
  createWrapper,
  createItem,
  target,
  sentinelId = "infinite-scroll-sentinel",
  rootMargin = "200px"
}) {
  let currentPage = 1;
  let isLoading = false;
  let hasMore = true;
  let observer = null;

  // 1. Create the wrapper once (pure DOM)
  const wrapper = createWrapper();
  target.appendChild(wrapper);

  // 2. Create the invisible sentinel (pure DOM)
  let sentinel = document.getElementById(sentinelId);
  if (!sentinel) {
    sentinel = document.createElement("div");
    sentinel.id = sentinelId;
    sentinel.style.height = "1px";
    target.appendChild(sentinel);
  }

  // 3. Load next page from API
  async function loadNextPage() {
    if (isLoading || !hasMore) return;

    isLoading = true;

    try {
      const result = await fetchPage(currentPage, pageSize);
      const items = result.items || [];

      // Append new items
      items.forEach(item => {
        const element = createItem(item);
        wrapper.appendChild(element);
      });

      // Update state
      hasMore = Boolean(result.hasMore) && items.length > 0;
      if (items.length > 0) {
        currentPage += 1;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error("Infinite scroller error:", err);
      hasMore = false;
    } finally {
      isLoading = false;
    }
  }

  // 4. Setup scroll watcher
  function setupObserver() {
    if (observer) observer.disconnect();

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: rootMargin,
        threshold: 0
      }
    );

    observer.observe(sentinel);
  }

  // 5. Public API
  return {
    async start() {
      // First page
      await loadNextPage();
      setupObserver();
    },

    async reset() {
      currentPage = 1;
      hasMore = true;
      isLoading = false;
      wrapper.innerHTML = "";          // clear previous items
      await this.start();
    },

    destroy() {
      if (observer) observer.disconnect();
      wrapper.remove();
      if (sentinel.parentNode) sentinel.remove();
    }
  };
}