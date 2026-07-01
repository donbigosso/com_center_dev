import { checkHTMLInstance } from "./CoreFunctions.js";
import { showFeedback } from "./CustomFunctions.js";
import { verifySession} from "./RequestFunctions.js";
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
//Santamonika!1

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

export function drawUserCreationForm(onSubmit) {
    const form = document.createElement('form');
    form.setAttribute('autocomplete', 'off');

    const fields = [
        { label: 'Username',         name: 'username',        type: 'text',     autocomplete: 'off' },
        { label: 'Password',         name: 'password',        type: 'password', autocomplete: 'new-password' },
        { label: 'Confirm Password', name: 'confirmPassword', type: 'password', autocomplete: 'new-password' },
    ];

    fields.forEach(({ label, name, type, autocomplete }) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-3 px-5';

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.htmlFor = name;
        lbl.className = 'form-label';

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

    const btn = document.createElement('button');
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'd-flex justify-content-center';

    btnWrapper.appendChild(btn);
    btn.type = 'button';
    btn.textContent = 'Create User';
    btn.className = 'btn btn-primary w-50';
    btn.addEventListener('click', () => {
        const username        = form.username.value.trim();
        const password        = form.password.value;
        const confirmPassword = form.confirmPassword.value;

        if (!username || !password) return showFeedback('Please fill in all fields.', 'red');
        if (password !== confirmPassword) return showFeedback('Passwords do not match.', 'red');

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
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'mb-3 px-5';

    const selectLabel = document.createElement('label');
    selectLabel.textContent = 'Select User';
    selectLabel.htmlFor = 'selectUser';
    selectLabel.className = 'form-label';

    const select = document.createElement('select');
    select.name = 'selectUser';
    select.id = 'selectUser';
    select.className = 'form-select';

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
    const confirmWrapper = document.createElement('div');
    confirmWrapper.className = 'mb-3 px-5';

    const confirmLabel = document.createElement('label');
    confirmLabel.textContent = 'Type username to confirm';
    confirmLabel.htmlFor = 'confirmUsername';
    confirmLabel.className = 'form-label';

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

        if (!selectedUser) return showFeedback('Please select a user.',"red");
        if (!confirmedUser) return showFeedback('Please type the username to confirm.',"red");
        if (selectedUser !== confirmedUser) return showFeedback('Username does not match.', 'red');

        const wasDeleted = await onSubmit({ username: selectedUser });

        if (wasDeleted) {
            const optionToRemove = select.querySelector(`option[value="${selectedUser}"]`);
            if (optionToRemove) optionToRemove.remove();
            select.value = '';
            confirmInput.value = '';
        }
    });

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'd-flex justify-content-center mt-2 px-5';
    btnWrapper.appendChild(btn);
    form.appendChild(btnWrapper);

    return form;
}

export function drawPasswordChangeForm(userList, onSubmit) {
    const passRegex = /^(?=.*[A-Z])(?=.*\d).{10,}$/;
    const form = document.createElement('form');

    // User dropdown
    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'mb-3 px-5';

    const selectLabel = document.createElement('label');
    selectLabel.textContent = 'Select User';
    selectLabel.htmlFor = 'selectUserPwd';
    selectLabel.className = 'form-label';

    const select = document.createElement('select');
    select.name = 'selectUserPwd';
    select.id = 'selectUserPwd';
    select.className = 'form-select';

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
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-3 px-5';

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.htmlFor = id;
        lbl.className = 'form-label';

        const input = document.createElement('input');
        input.type = 'password';
        input.name = name;
        input.id = id;
        input.className = 'form-control';

        wrapper.appendChild(lbl);
        wrapper.appendChild(input);
        form.appendChild(wrapper);
    });

    // Password requirements hint
    const hint = document.createElement('p');
    hint.className = 'text-muted px-5 small';
    hint.textContent = 'Password must be at least 10 characters, contain one uppercase letter and one number.';
    form.appendChild(hint);

    // Submit button
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'd-flex justify-content-center mt-2 px-5';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Change Password';
    btn.className = 'btn btn-warning w-50';

    btn.addEventListener('click', () => {
        const username        = select.value;
        const password        = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        if (!username)         return showFeedback('Please select a user.',"red");
        if (!password)         return showFeedback('Please enter a new password.',"red");
        if (!passRegex.test(password)) return showFeedback('Password must be at least 10 characters, include one uppercase letter and one number.',"red");
        if (password !== confirmPassword) return showFeedback('Passwords do not match.',"red");

        onSubmit({ username, password });
    });

    btnWrapper.appendChild(btn);
    form.appendChild(btnWrapper);

    return form;
}