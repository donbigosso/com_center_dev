import { performAdminTests } from "./functions/TestFunctions.js";
import { requestSendTableAdmin, createUser, deleteUserByAdmin } from "./functions/RequestFunctions.js";
import {drawTable, drawUserCreationForm, drawUserDeletionForm} from "./functions/PageAppearance.js";


const logoutBtn = document.getElementById('logout-btn');
const userTile = document.getElementById('tile-users');
const createUserTile = document.getElementById('tile-create-user');
const deleteUserTile = document.getElementById('tile-delete-user');
const resultArea = document.getElementById('result-area');
logoutBtn.addEventListener('click', () => {
           
            window.location.href = './logout.php';
        });

userTile.addEventListener('click', async () => {
     
    resultArea.innerHTML = '';  
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
    const form = drawUserDeletionForm(userList, ({ username }) => {
        //console.log('Delete user:', username);
        // call your API here
        console.log(deleteUserByAdmin(username));
    });
    resultArea.appendChild(form);
});





document.addEventListener('DOMContentLoaded', () => {
    (async () => {
       
        //const apiAdr = await performAdminTests();
        //console.log(apiAdr   );
    })();
    
});