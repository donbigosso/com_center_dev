import { performAdminTests } from "./functions/TestFunctions.js";
import { requestSendTableAdmin } from "./functions/RequestFunctions.js";
import {drawTable, drawUserCreationForm} from "./functions/PageAppearance.js";


const logoutBtn = document.getElementById('logout-btn');
const userTile = document.getElementById('tile-users');
const createUserTile = document.getElementById('tile-create-user');
const resultArea = document.getElementById('result-area');
logoutBtn.addEventListener('click', () => {
           
            window.location.href = './logout.php';
        });

userTile.addEventListener('click', async () => {
    const tableRequest = await requestSendTableAdmin('users');
    resultArea.innerHTML = '';  
    const tableData = tableRequest.data;
    const drawnTable = drawTable(tableData, "nice-table");
    resultArea.appendChild(drawnTable);
});

createUserTile.addEventListener('click', async () => {
    resultArea.innerHTML = '';  
    const form = drawUserCreationForm(({ username, password }) => {
        console.log('Create user:', username, password);
        // call your API here
    });
    resultArea.appendChild(form);
});




document.addEventListener('DOMContentLoaded', () => {
    (async () => {
       
        //const apiAdr = await performAdminTests();
        //console.log(apiAdr   );
    })();
    
});