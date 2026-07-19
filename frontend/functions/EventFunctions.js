export function onClick(button, handler) {
  if (!button) {
    console.warn("onClick: button is null");
    return;
  }

  button.addEventListener("click", handler);
}