import { requestSendTableAdmin, createUser, deleteUserByAdmin, resetUserPasswordByAdmin } from "./functions/RequestFunctions.js";
import {drawTable, drawUserCreationForm, drawUserDeletionForm, drawPasswordChangeForm} from "./functions/PageAppearance.js";
import { showFeedback, showUserDeleteFeedback } from "./functions/CustomFunctions.js";


const logoutBtn = document.getElementById('logout-btn');
const userTile = document.getElementById('tile-users');
const createUserTile = document.getElementById('tile-create-user');
const deleteUserTile = document.getElementById('tile-delete-user');
const resultArea = document.getElementById('result-area');
const changePasswordTile = document.getElementById('tile-change-password');
logoutBtn.addEventListener('click', () => {
           
            window.location.href = './logout.php';
        });

userTile.addEventListener('click', async () => {
    resultArea.innerHTML = '';  
    const tableRequest = await requestSendTableAdmin('users',[],['user_id','name','is_admin','register_date'],);
    const tableData = tableRequest.data;
    const drawnTable = drawTable(tableData, "nice-table");
    resultArea.appendChild(drawnTable);
});

createUserTile.addEventListener('click', async () => {
    resultArea.innerHTML = '';  
    const form = drawUserCreationForm(({ username, password }) => {
        //console.log('Create user:', username, password);
        // call your API here
        createUser(username, password);
    });
    resultArea.appendChild(form);
});


deleteUserTile.addEventListener('click', async () => {
    resultArea.innerHTML = '';
    const tableRequest = await requestSendTableAdmin('users',[],['name']);
    const tableData = tableRequest.data;
    const result = tableData.flat().filter(Boolean).slice(1);
    const userList = result;
    const form = drawUserDeletionForm(userList, async ({ username }) => {
        const serverResponse = await deleteUserByAdmin(username);
        if (serverResponse.success) {
            showUserDeleteFeedback(username);
            return true;
        } else {
            showFeedback(`Failed to delete user ${username}.`,"red");
            return false;
        }
    });
    resultArea.appendChild(form);
});


changePasswordTile.addEventListener('click', async () => {
    resultArea.innerHTML = '';
    const tableRequest = await requestSendTableAdmin('users', [], ['name']);
    const tableData = tableRequest.data;
    const userList = tableData.flat().filter(Boolean).slice(1);
    const form = drawPasswordChangeForm(userList, async ({ username, password }) => {
        const response = await resetUserPasswordByAdmin(username, password);
        const message = "";
        if (response.success) {
            message =`Password for "${username}" changed successfully.`;
            showFeedback(message);    
           // resultArea.innerHTML = '';
        } else {
            message = 'Could not change password.';
            showFeedback(message,"red");    
        }
    });
    resultArea.appendChild(form);
});





document.addEventListener('DOMContentLoaded', () => {
    (async () => {
       
        //const apiAdr = await performAdminTests();
        //console.log(apiAdr   );
    })();
    
});