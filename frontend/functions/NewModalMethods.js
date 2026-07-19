import { handleLogIn } from "./LoginFunctions.js";
import { newHideModal } from "./PageAppearance.js";
import { executeFileRename, executeFileDelete } from "./FileActionMethods.js";

const modal = {
  element: document.getElementById('my_modal'),
  title:    document.getElementById('my-modal-label'),
  body:     document.querySelector('.modal-body'),
  alert:    document.getElementById('modal-alert-field'),
  btn1:     document.getElementById('modal-btn-1'),
  btn2:     document.getElementById('modal-btn-2'),
  btn3:     document.getElementById('modal-btn-3'),
  closeBtn: document.getElementById('modal-close-btn')
};

function resetModal() {
  modal.body.innerHTML = '';
  modal.alert.style.display = 'none';
  modal.btn1.style.display = '';
  modal.btn2.style.display = '';
  modal.btn3.style.display = '';
  // remove old listeners – important!
  modal.btn1.replaceWith(modal.btn1.cloneNode(true));
  modal.btn2.replaceWith(modal.btn2.cloneNode(true));
  modal.btn3.replaceWith(modal.btn3.cloneNode(true));
  // re-assign variables because we cloned
  modal.btn1 = document.getElementById('modal-btn-1');
  modal.btn2 = document.getElementById('modal-btn-2');
  modal.btn3 = document.getElementById('modal-btn-3');
}

export function showGenericModal(config) {
  resetModal();

  modal.title.textContent = config.title || 'Modal';

  if (config.bodyHtml) {
    modal.body.innerHTML = config.bodyHtml;
  } else if (config.bodyText) {
    modal.body.textContent = config.bodyText;
  }

  // buttons
  if (config.buttons) {
    config.buttons.forEach((btnCfg, i) => {
      const btn = [null, modal.btn1, modal.btn2, modal.btn3][i+1];
      if (!btn) return;
      if (btnCfg.hidden) {
        btn.style.display = 'none';
        return;
      }
      btn.textContent = btnCfg.text || 'Button';
      btn.className = btn.className.replace(/btn-\w+/, '') + ' ' + (btnCfg.class || 'btn-secondary');
      if (btnCfg.action) {
        btn.addEventListener('click', btnCfg.action);  // btn.addEventListener('click', btnCfg.action, {once: true});  - this was original; it allows only one click
      }
    });
  }

  // show
  const bsModal = new bootstrap.Modal(modal.element, {
  backdrop: 'static',    // clicking backdrop (outside) does NOTHING
  keyboard: false        // optional: also disable Esc key
});
 bsModal.show();
}

//usage
  // Login
export function showLoginModal(){

showGenericModal({
  title: "User Login",
  bodyHtml: `
    <form id="login-form">
      <div class="mb-3">
        <label for="loginUsername" class="form-label">Username</label>
        <input type="text" class="form-control" id="loginUsername" required>
      </div>
      <div class="mb-3">
        <label for="loginPassword" class="form-label">Password</label>
        <input type="password" class="form-control" id="loginPassword" required>
      </div>
    </form>`,
  buttons: [
   // { text: "Cancel", class: "btn-secondary", action: () => bootstrap.Modal.getInstance(modal.element).hide() },
     { text: "Cancel", class: "btn-secondary", action: () => newHideModal("my-modal") },
    { hidden: true },
    { text: "Login", class: "btn-primary", action: handleLogIn }
  ]
});
}
// Rename
export function showRenameModal(filename){
  const bodyHtml = `
    <form id="rename-form">
      <div class="mb-3">
        <label for="rename-input" class="form-label">New name</label>
        <input type="text" class="form-control" id="rename-input" required value="${filename}">
      </div>
    </form>
  `;

showGenericModal({
  title: "Rename file",
  bodyHtml: bodyHtml,
  buttons: [
    { text: "Cancel", class: "btn-secondary", action: () => newHideModal("my-modal")},
    { hidden: true },
    { text: "Rename", class: "btn-primary", action: () => {executeFileRename(filename); } }
  ] 
});

const renameInput = document.getElementById("rename-input");
renameInput.focus();

}

export function showDeleteModal(filename){
  const bodyText = "Are you sure you want to delete "+filename+"?";
  showGenericModal({
    title: "Delete file",
    bodyText: bodyText,
    buttons:[
         { text: "Cancel", class: "btn-secondary", action: () => newHideModal("my-modal")},
    { hidden: true },
    { text: "Delete", class: "btn-danger", action: () => {executeFileDelete(filename);   } }
    ]

  });
}