import { checkHTMLInstance } from "./CoreFunctions.js";
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

    const fields = [
        { label: 'Username',         name: 'username',        type: 'text' },
        { label: 'Password',         name: 'password',        type: 'password' },
        { label: 'Confirm Password', name: 'confirmPassword', type: 'password' },
    ];

    fields.forEach(({ label, name, type }) => {
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

        if (!username || !password) return alert('Fill in all fields.');
        if (password !== confirmPassword) return alert('Passwords do not match.');


        onSubmit({ username, password });
    });

    form.appendChild(btnWrapper);
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
    btn.addEventListener('click', () => {
        const selectedUser    = select.value;
        const confirmedUser   = confirmInput.value.trim();

        if (!selectedUser) return alert('Please select a user.');
        if (!confirmedUser) return alert('Please type the username to confirm.');
        if (selectedUser !== confirmedUser) return alert('Username does not match.');

        onSubmit({ username: selectedUser });
    });

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'd-flex justify-content-center mt-2 px-5';
    btnWrapper.appendChild(btn);
    form.appendChild(btnWrapper);

    return form;
}