import { displayLoggedUser, showLoggedOnly, hideUnloggedOnly, showUnloggedOnly, hideLoggedOnly, newHideModal } from "./PageAppearance.js"; 
import {verifyUserByPassword, checkIfTokenExist}from "./CoreFunctions.js";
import {setUserToken, verifySession, clearUserToken} from "./RequestFunctions.js";
import  {setCookie, deleteCookie} from "./CookieFunctions.js";


export async function handleLogIn(){
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorField = document.getElementById('modal-alert-field');
    const frontednValidation = await validateLoginAndPassFrontend();
    const showError = function(){
        errorField.style.display = "block";
        errorField.innerText = "Invalid credentials";
    }
    if(frontednValidation){
        
        const apiValidation = await validateLoginAndPassAPI(username, password);
        const validationStatus = apiValidation.data.password_verification;
        
        if(!validationStatus){
            showError();
            return;
        }
    }
    else {
       showError();
        return;
    }
    
    // Set session token
    const sessionTokenResponse = await setSessionToken(14, username);
    
    showLoggedOnly();
    displayLoggedUser();
    hideUnloggedOnly();
    console.log("DEB635 befor hide");
    newHideModal("my_modal");
    console.log("DEB635 after hide");
}

export async function validateLoginAndPassFrontend(){
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const passRegex = /^(?=.*[A-Z])(?=.*\d).{10,}$/;
    const usrNameRegex = /^[a-zA-Z0-9_]{4,16}$/;
    const isPassValid = passRegex.test(password);
    const isUsrNameValid = usrNameRegex.test(username);
    if(isPassValid && isUsrNameValid){
       
         return true;
    }
    else {
        
        return false;
    }
    
   
}

export async function validateLoginAndPassAPI(username, password){
    
    const passwordVerification = await verifyUserByPassword(username, password);
    
    return passwordVerification;


}




async function createSessionToken() { //from Grok
    while (true) {
        // Generate a reasonably long random token
        const token = 
            Math.random().toString(36).substring(2, 15) + 
            Math.random().toString(36).substring(2, 15);
        
        const tokenExistence = await checkIfTokenExist(token);
        
       

        if (!tokenExistence) {
            return token;           // ← found a free one → return it
        }

        // If we get here → token already exists → loop again
    }
}

export async function setSessionToken(days = 14, username){
    const token = await createSessionToken();
    setCookie("session_token", token, days);
    //set_user_token
    const setUserTokenResponse = await setUserToken(username, token, days);

   return setUserTokenResponse;

}

export async function handleAutoLogin(){
    // Check if user is already logged in
    const user = await verifySession();
    if (user) {
        showLoggedOnly();
        displayLoggedUser();
        hideUnloggedOnly();
    }
}


export async function handleLogout(){
   showUnloggedOnly();
     hideLoggedOnly();
     deleteCookie("session_token");
     await clearUserToken();
}