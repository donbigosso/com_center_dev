import { checkHTMLInstance } from "./CoreFunctions.js";
import { verifySession } from "./RequestFunctions.js";
export function show(element, display = "inline-block") {
  if (!(element instanceof HTMLElement)) {
    console.warn("show(): invalid element");
    return;
  }

  element.style.display = display;
}
export function hide(element) {
  if (!(element instanceof HTMLElement)) {
    console.warn("hide(): invalid element");
    return;
  }

  element.style.display = "none";
}

export function showModal(modalID) {
  const modal = document.getElementById(modalID);
  modal.classList.add('show', 'd-block');
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  document.body.style.overflow = 'hidden';
}

export function hideModal(modalID) {
  const modal = document.getElementById(modalID);
  modal.classList.remove('show', 'd-block');
  modal.style.backgroundColor = '';
  document.body.style.overflow = '';
}
export function newHideModal(modalID) {
  const modal = document.getElementById(modalID);
  if (!modal) return;

  // 1. blur FIRST — before Bootstrap does anything
  if (document.activeElement && modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  // 2. now safe to hide
  const bsModal = bootstrap.Modal.getInstance(modal);
  if (bsModal) {
    bsModal.hide();
  }
}

export function showLoggedOnly(){
    const loggedIn = document.querySelectorAll(".logged-only");
    loggedIn.forEach(el => {
  //console.log(el);     // ← add this
  show(el);
});
  }

export function hideLoggedOnly(){
    const loggedIn = document.querySelectorAll(".logged-only");
    loggedIn.forEach(el => hide(el));                           
} 
export function showUnloggedOnly(){
    const unlogged = document.querySelectorAll(".unlogged-only");
    unlogged.forEach(el => show(el));   }  

    export function hideUnloggedOnly(){
    const unlogged = document.querySelectorAll(".unlogged-only");
    unlogged.forEach(el => hide(el));                           
}

export function scroolToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function scrollToDown() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

export function changeButtonText(button, text) {
  if (!(button instanceof HTMLElement)) {
    console.warn("changeButtonText(): invalid button element");
    return;
  }

  button.textContent = text;
}

export function changeButtonStyle(button) {
 if(checkHTMLInstance(button)){

 }
}

export function changeInnerTextContent(element, textContent) {
  if (checkHTMLInstance(element)) {
    element.textContent = textContent;
    }
}

export function changeInnerHTML(element, htmlContent) {
  if (checkHTMLInstance(element)) {
    element.innerHTML = htmlContent;
    }
}

export async function displayLoggedUser(){
  const user =await verifySession();
  const userField = document.getElementById("user-field");
  if(!userField){
    console.warn("DEB122  user field not found");
    return;
  }
  if (user) {
    // TODO: Display user information
    userField.textContent = user;
  }
  else {
    console.log("DEB 124 User is not logged in");
    return;
  }
  }