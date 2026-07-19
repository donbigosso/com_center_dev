import { getSetting, downloadFile } from "./CoreFunctions.js";   
import { getCookie } from "./CookieFunctions.js";
import { POSTJSONRequest } from "./CoreFunctions.js";

let cachedApiAddress = null; // so that copy urs will not be async (does not work in Safari)
let cachedFileSettings = null;

export async function initApiAddressCache(){
    cachedApiAddress = await getSetting("api_address");
    if (!cachedApiAddress) {
        console.error("API address is not defined in settings.");
    }
   
}

export function getFileSettings(){
    return cachedFileSettings;
}

export async function initFileSettingsCache(){
    const serverResponse= await POSTJSONRequest({request: "get_file_settings"});
    if (serverResponse.success) {
        cachedFileSettings = serverResponse.data;
    }
  
}

export async function generateDownloadLinkOld(filename){
    const apiAddress = await getSetting("api_address");
    if (!apiAddress) {
        console.error("API address is not defined in settings.");
        return null;
    }
    const fileURL = `${apiAddress}?request=download&file=${encodeURIComponent(filename)}`;
    
    return fileURL;  
}

export function generateDownloadLink(filename){
    if (!cachedApiAddress) {
        console.error("API address not cached yet.");
        return null;
    }
    return `${cachedApiAddress}?request=download&file=${encodeURIComponent(filename)}`;
}

export async function downloadFileFromAPI(filename){
    
   
    const fileLink = await generateDownloadLink(filename);
    if (!fileLink) {
        return;
    }
    await downloadFile(fileLink, filename);  
}

export function copyToClipboard(text) {
     
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Clipboard write failed: ', err);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(textarea);
}


export async function generateAndCopyDownloadLinkOld(filename){
    const link = await generateDownloadLink(filename);
    if (link) {
        await copyToClipboard(link);
        
    }
}

export function generateAndCopyDownloadLink(filename){
    const link = generateDownloadLink(filename);
    if (link) {
        copyToClipboard(link); // now fully synchronous up to this point
        showCopiedLinkFeedback();
    }
}

export function getSessionToken(){
    return getCookie("session_token");
}

export function showFeedback(text) {
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

export function showUploadFeedback(){
    showFeedback("File(s) successfully uploaded");
}
