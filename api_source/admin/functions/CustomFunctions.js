import { getSetting, downloadFile } from "./CoreFunctions.js";   
import { getCookie } from "./CookieFunctions.js";


export async function generateDownloadLink(filename){
    const apiAddress = await getSetting("api_address");
    if (!apiAddress) {
        console.error("API address is not defined in settings.");
        return null;
    }
    const fileURL = `${apiAddress}?request=download&file=${encodeURIComponent(filename)}`;
    console.log("Generated download link (DEB765): ", fileURL);
    return fileURL;  
}

export async function downloadFileFromAPI(filename){
    
    const apiAddress = await getSetting("api_address");
    const fileLink = await generateDownloadLink(filename);
    if (!fileLink) {
        return;
    }
    await downloadFile(fileLink, filename);  
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        console.log('DEB653 Copied successfully!');
        // Optional: Show user feedback, e.g., alert('Copied!');
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}


export async function generateAndCopyDownloadLink(filename){
    const link = await generateDownloadLink(filename);
    if (link) {
        await copyToClipboard(link);
        
    }
}

export function getSessionToken(){
    return getCookie("session_token");
}

function showFeedback(text) {
  const feedbackElement = document.getElementById('global-feedback');
  feedbackElement.innerText = text;
  feedbackElement.classList.remove('opacity-0');
  feedbackElement.classList.add('opacity-100');

  setTimeout(() => {
    feedbackElement.classList.remove('opacity-100');
    feedbackElement.classList.add('opacity-0');
  }, 1500);
}


export function showCopiedLinkFeedback() {
    
 showFeedback("Link copied to clipboard");
}
export function showRenameFeedback(){
    showFeedback("File successfully renamed");
}

export function showDeleteFeedback(){
    showFeedback("File successfully deleted");
}
