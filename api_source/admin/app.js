import { performAdminTests } from "./functions/TestFunctions.js";
import { requestSendTableAdmin, createUser } from "./functions/RequestFunctions.js";
import {drawTable, drawUserCreationForm, drawUserDeletionForm} from "./functions/PageAppearance.js";


const logoutBtn = document.getElementById('logout-btn');
const userTile = document.getElementById('tile-users');
const createUserTile = document.getElementById('tile-create-user');
const resultArea = document.getElementById('result-area');
logoutBtn.addEventListener('click', () => {
           
            window.location.href = './logout.php';
        });

userTile.addEventListener('click', async () => {
    const tableRequest = await requestSendTableAdmin('users',[],['user_id','name','is_admin','register_date']);
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

const deleteUserTile = document.getElementById('tile-delete-user');
deleteUserTile.addEventListener('click', async () => {
    resultArea.innerHTML = '';  
    const mockUsers = ['alice', 'wojtek', 'charlie', 'diana', 'evan'];
    const form = drawUserDeletionForm(mockUsers, ({ username }) => {
        console.log('Delete user:', username);
        // call your API here
        //deleteUser(username);
    });
    resultArea.appendChild(form);
});





document.addEventListener('DOMContentLoaded', () => {
    (async () => {
       
        //const apiAdr = await performAdminTests();
        //console.log(apiAdr   );
    })();
    
});