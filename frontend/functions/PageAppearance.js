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

export function disableButton(button) {
  if (checkHTMLInstance(button)) {
    button.disabled = true;
  }
}

export function enableButton(button) {
  if (checkHTMLInstance(button)) {
    button.disabled = false;
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

export function createHTMLelement(elementType, className){
  const element = document.createElement(elementType);
  element.className = className;
  return element;
}

export function createDIV(className){
  return createHTMLelement('div', className);
}

export function createLabel(textContent, htmlFor, className){
  const label = createHTMLelement('label', className);
  label.textContent = textContent;
  label.htmlFor = htmlFor;
  return label;
}

export function createButton(type, text, className){
  const button = createHTMLelement('button', className);
  button.type = type;
  button.textContent = text;
  return button;
}

export function createInput(type, className, id, required){
  const input = createHTMLelement('input', className);
  input.type = type;
  input.id = id;
  input.required = required;
  return input;
}

export function createBootstrapTextInput(id, required, maxLength, value){
  const input = createInput('text', 'form-control', id, required);
  input.maxLength = maxLength;
  input.value = value || '';
  return input;
}

/*

  titleInput.type = "text";
  titleInput.className = "form-control";
  titleInput.id = "gallery-title";
   titleInput.maxLength = 200;
  titleInput.value = config.titleValue || "";

*/

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