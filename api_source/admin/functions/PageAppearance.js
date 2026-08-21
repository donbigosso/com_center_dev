import { checkHTMLInstance } from "./CoreFunctions.js";
import { showFeedback } from "./CustomFunctions.js";
import {
  VALIDATION_CONSTRAINTS,
  validateUserRegistration,
  validateDeleteUserConfirmation,
  validatePasswordChange,
} from "./FormValidation.js";
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




export function showLoggedOnly(){
    const loggedIn = document.querySelectorAll(".logged-only");
    loggedIn.forEach(el => {
  //console.log(el);     // ← add this
  show(el);
});
  }


export function scroolToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}



export function changeButtonText(button, text) {
  if (!(button instanceof HTMLElement)) {
    console.warn("changeButtonText(): invalid button element");
    return;
  }

  button.textContent = text;
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



  export function drawTable(data, className="") {
    const [headers, ...rows] = data;

    const table = document.createElement('table');
    table.className = className;

    // Header row
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });

    // Data rows
    const tbody = table.createTBody();
    rows.forEach(row => {
        const tr = tbody.insertRow();
        row.forEach(cell => {
            const td = tr.insertCell();
            td.textContent = cell ?? '';
        });
    });

    return table;
}

/**
 * Create an empty table with header row (for infinite-scroll row append).
 * @param {string[]} headers
 * @param {string} [className]
 * @returns {HTMLTableElement}
 */
export function createTableWithHeaders(headers, className = "") {
  const table = document.createElement("table");
  table.className = className;

  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  (headers || []).forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });

  // tbody is optional; browsers place appended <tr> correctly after thead
  table.createTBody();
  return table;
}

/**
 * Build one table body row from cell values.
 * @param {Array<string|number|null|undefined>} cells
 * @returns {HTMLTableRowElement}
 */
export function createTableRow(cells) {
  const tr = document.createElement("tr");
  (cells || []).forEach((cell) => {
    const td = tr.insertCell();
    td.textContent = cell == null ? "" : String(cell);
  });
  return tr;
}

/**
 * Table wrapper used by createInfiniteScroller for gallery listing.
 * Returns a table with gallery column headers; rows are appended as items.
 * appendChild(tr) is redirected into tbody so the scroller can treat the
 * table as its wrapper element.
 * @returns {HTMLTableElement}
 */
export function createGalleriesTableWrapper() {
  const table = createTableWithHeaders(
    [
      "ID",
      "Title",
      "Description",
      "Owner",
      "Images",
      "Register date",
      "Cover ID",
    ],
    "nice-table"
  );
  const tbody = table.tBodies[0] || table.createTBody();
  const originalAppend = table.appendChild.bind(table);
  table.appendChild = (node) => {
    if (node && node.nodeName === "TR") {
      return tbody.appendChild(node);
    }
    return originalAppend(node);
  };
  return table;
}

/**
 * One gallery as a table row (for infinite scroller createItem).
 * @param {object} gallery
 * @returns {HTMLTableRowElement}
 */
export function createGalleryTableRow(gallery) {
  return createTableRow([
    gallery?.id ?? "",
    gallery?.title ?? "",
    gallery?.description ?? "",
    gallery?.owner ?? "",
    gallery?.image_count ?? 0,
    gallery?.register_date ?? "",
    gallery?.collection_cover_id ?? "",
  ]);
}

/**
 * Delete-gallery form: select gallery + Delete (simple OK confirm, no typed confirmation).
 * @param {Array<{id:number,title:string,owner?:string|null}>} galleryList
 * @param {(payload:{galleryId:number,title:string}) => Promise<boolean>} onSubmit
 * @returns {HTMLFormElement}
 */
export function drawGalleryDeletionForm(galleryList, onSubmit) {
  const form = document.createElement("form");

  const selectWrapper = createDIV("mb-3 px-5");
  const selectLabel = createLabel("Select Gallery", "selectGallery", "form-label");

  const select = createHTMLelement("select", "form-select");
  select.name = "selectGallery";
  select.id = "selectGallery";

  const defaultOption = document.createElement("option");
  defaultOption.textContent = "-- Select a gallery --";
  defaultOption.value = "";
  select.appendChild(defaultOption);

  (galleryList || []).forEach((g) => {
    const option = document.createElement("option");
    option.value = String(g.id);
    const owner = g.owner ? ` · ${g.owner}` : "";
    option.textContent = `#${g.id} — ${g.title || "Untitled"}${owner}`;
    select.appendChild(option);
  });

  selectWrapper.appendChild(selectLabel);
  selectWrapper.appendChild(select);
  form.appendChild(selectWrapper);

  const hint = createDIV("form-text text-muted px-5 mb-3");
  hint.textContent =
    "This permanently deletes the gallery and all media files that belong to it.";
  form.appendChild(hint);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Delete Gallery";
  btn.className = "btn btn-danger w-50";
  btn.addEventListener("click", async () => {
    const galleryId = parseInt(select.value, 10);
    if (!galleryId) {
      return showFeedback("Please select a gallery.", "red");
    }

    const selectedOption = select.options[select.selectedIndex];
    const title = selectedOption
      ? selectedOption.textContent.replace(/^#\d+\s*—\s*/, "").split(" · ")[0]
      : String(galleryId);

    const ok = window.confirm(
      `Delete gallery #${galleryId} ("${title}") and all of its media files?\n\nThis cannot be undone.`
    );
    if (!ok) return;

    const wasDeleted = await onSubmit({ galleryId, title });
    if (wasDeleted) {
      const optionToRemove = select.querySelector(`option[value="${galleryId}"]`);
      if (optionToRemove) optionToRemove.remove();
      select.value = "";
    }
  });

  const btnWrapper = createDIV("d-flex justify-content-center mt-2 px-5");
  btnWrapper.appendChild(btn);
  form.appendChild(btnWrapper);

  return form;
}

export function drawUserCreationForm(onSubmit) {
    const form = document.createElement('form');
    form.setAttribute('autocomplete', 'off');

    const fields = [
        { label: 'Username',         name: 'username',        type: 'text',     autocomplete: 'off' },
        { label: 'Password',         name: 'password',        type: 'password', autocomplete: 'new-password' },
        { label: 'Confirm Password', name: 'confirmPassword', type: 'password', autocomplete: 'new-password' },
    ];

    fields.forEach(({ label, name, type, autocomplete }) => {
        const wrapper = createDIV('mb-3 px-5');
        const lbl = createLabel(label, name, 'form-label');

        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.id = name;
        input.className = 'form-control';
        input.autocomplete = autocomplete;

        wrapper.appendChild(lbl);
        wrapper.appendChild(input);
        form.appendChild(wrapper);
    });

    const btn = createButton('button', 'Create User', 'btn btn-primary w-50');
    const btnWrapper = createDIV('d-flex justify-content-center');

    btnWrapper.appendChild(btn);
    btn.addEventListener('click', () => {
        const username        = form.username.value.trim();
        const password        = form.password.value;
        const confirmPassword = form.confirmPassword.value;

        const validation = validateUserRegistration(username, password, confirmPassword);
        if (!validation.valid) return showFeedback(validation.error, 'red');

        onSubmit({ username, password });
    });

    form.appendChild(btnWrapper);

    // Clear any browser-autofilled values once the form is in the DOM
    requestAnimationFrame(() => form.reset());

    return form;
}
export function drawUserDeletionForm(userList, onSubmit) {
    const form = document.createElement('form');

    // Mock users
    

    // Dropdown
    const selectWrapper = createDIV('mb-3 px-5');
    const selectLabel = createLabel('Select User', 'selectUser', 'form-label');

    const select = createHTMLelement('select', 'form-select');
    select.name = 'selectUser';
    select.id = 'selectUser';

    const defaultOption = document.createElement('option');
    defaultOption.textContent = '-- Select a user --';
    defaultOption.value = '';
    select.appendChild(defaultOption);

    userList.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        select.appendChild(option);
    });

    selectWrapper.appendChild(selectLabel);
    selectWrapper.appendChild(select);
    form.appendChild(selectWrapper);

    // Confirm username input
    const confirmWrapper = createDIV('mb-3 px-5');
    const confirmLabel = createLabel('Type username to confirm', 'confirmUsername', 'form-label');

    const confirmInput = document.createElement('input');
    confirmInput.type = 'text';
    confirmInput.name = 'confirmUsername';
    confirmInput.id = 'confirmUsername';
    confirmInput.className = 'form-control';
    confirmInput.placeholder = 'Type username here...';

    confirmWrapper.appendChild(confirmLabel);
    confirmWrapper.appendChild(confirmInput);
    form.appendChild(confirmWrapper);

    // Delete button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Delete User';
    btn.className = 'btn btn-danger w-50';
    btn.addEventListener('click', async () => {
        const selectedUser    = select.value;
        const confirmedUser   = confirmInput.value.trim();

        const validation = validateDeleteUserConfirmation(selectedUser, confirmedUser);
        if (!validation.valid) return showFeedback(validation.error, "red");

        const wasDeleted = await onSubmit({ username: selectedUser });

        if (wasDeleted) {
            const optionToRemove = select.querySelector(`option[value="${selectedUser}"]`);
            if (optionToRemove) optionToRemove.remove();
            select.value = '';
            confirmInput.value = '';
        }
    });

    const btnWrapper = createDIV('d-flex justify-content-center mt-2 px-5');
    btnWrapper.appendChild(btn);
    form.appendChild(btnWrapper);

    return form;
}

export function drawPasswordChangeForm(userList, onSubmit) {
    const form = document.createElement('form');

    // User dropdown
    const selectWrapper = createDIV('mb-3 px-5');
    const selectLabel = createLabel('Select User', 'selectUserPwd', 'form-label');

    const select = createHTMLelement('select', 'form-select');
    select.name = 'selectUserPwd';
    select.id = 'selectUserPwd';

    const defaultOption = document.createElement('option');
    defaultOption.textContent = '-- Select a user --';
    defaultOption.value = '';
    select.appendChild(defaultOption);

    userList.forEach(user => {
        const option = document.createElement('option');
        option.value = user;
        option.textContent = user;
        select.appendChild(option);
    });

    selectWrapper.appendChild(selectLabel);
    selectWrapper.appendChild(select);
    form.appendChild(selectWrapper);

    // Password fields
    const fields = [
        { label: 'New Password',     name: 'newPassword',     id: 'newPassword' },
        { label: 'Confirm Password', name: 'confirmPassword', id: 'confirmPwd'  },
    ];

    fields.forEach(({ label, name, id }) => {
        const wrapper = createDIV('mb-3 px-5');
        const lbl = createLabel(label, id, 'form-label');

        const input = document.createElement('input');
        input.type = 'password';
        input.name = name;
        input.id = id;
        input.className = 'form-control';

        wrapper.appendChild(lbl);
        wrapper.appendChild(input);
        form.appendChild(wrapper);
    });

    // Password requirements hint (from central constraints)
    const hint = document.createElement('p');
    hint.className = 'text-muted px-5 small';
    hint.textContent = `Password must be ${VALIDATION_CONSTRAINTS.passwordPatternHint}.`;
    form.appendChild(hint);

    // Submit button
    const btnWrapper = createDIV('d-flex justify-content-center mt-2 px-5');

    const btn = createButton('button', 'Change Password', 'btn btn-warning w-50');

    btn.addEventListener('click', () => {
        const username        = select.value;
        const password        = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        const validation = validatePasswordChange(username, password, confirmPassword);
        if (!validation.valid) return showFeedback(validation.error, "red");

        onSubmit({ username, password });
        return showFeedback('Password for ' + username + ' has been changed successfully!');
    });

    btnWrapper.appendChild(btn);
    form.appendChild(btnWrapper);

    return form;
}

export function drawMessagesList(messages, onDelete) {
  const wrap = createDIV("");

  if (!messages.length) {
    const empty = createDIV("text-muted px-1");
    empty.textContent = "No messages.";
    wrap.appendChild(empty);
    return wrap;
  }

  messages.forEach((msg) => {
    const card = createDIV("card mb-3");
    const body = createDIV("card-body");

    const meta = createDIV("small text-muted mb-2");
    meta.textContent = `#${msg.id} · ${msg.created_at || ""} · ${msg.sender_ip || ""}`;

    const from = document.createElement("p");
    from.className = "mb-1";
    from.innerHTML = `<strong>${escapeHtml(msg.name || "")}</strong> &lt;${escapeHtml(msg.email || "")}&gt;`;

    const text = document.createElement("p");
    text.className = "mb-3 message-clamp";
    text.textContent = msg.message || "";
    text.addEventListener("click", () => {
      text.classList.toggle("message-clamp");
    });

    const del = createButton("button", "Delete", "btn btn-sm btn-outline-danger");
    del.addEventListener("click", async () => {
      const ok = window.confirm(`Delete message #${msg.id}?`);
      if (!ok) return;
      const deleted = await onDelete(msg.id);
      if (deleted) card.remove();
    });

    body.append(meta, from, text, del);
    card.appendChild(body);
    wrap.appendChild(card);
  });

  return wrap;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}