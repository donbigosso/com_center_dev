import { fetchAPIdataWGetParams } from "./CoreFunctions.js ";
import { POSTJSONRequest } from "./CoreFunctions.js";
import {showFeedback} from "./CustomFunctions.js";
import{getCookie} from "./CookieFunctions.js";
import { validateUsernameAndPassword } from "./FormValidation.js";
export async function getFileList() {
    const apiResponse = await fetchAPIdataWGetParams({ request: 'list_files' });
    const success = apiResponse.success;
    if (success) {
        const fileList = apiResponse.data.files;
        if(fileList.length === 0){
            console.warn("No files available from the API.");
        }
        else {
        // console.log("File List:", fileList);
        return fileList;}
        
        
    } else {
        console.error(apiResponse.error);
        return [];
    }

}

export async function createUser(username, password) { //Butatren@344
    const validation = validateUsernameAndPassword(username, password);
    if(validation.valid){
        // TODO: Call API to create user
     
        const serverResponse= await POSTJSONRequest({request: "create_user",name:username, password:password});
        if(serverResponse.success){
            console.log("DEB764 Server response - user creation:", serverResponse.data.user_created);
            const user_was_created = serverResponse.data.user_created;
            const lowercaseUsername = username.toLowerCase();
            if (user_was_created){
                const alertTextContent = "User " + lowercaseUsername + " created successfully!";
                showFeedback(alertTextContent, 'green');
            }
            else {
                const alertTextContent = 'Failed to create user. Check if username is already taken.';
                showFeedback(alertTextContent, 'red');
            }
            
            return true;
        }
        else {
            console.error("DEB765 Server response:", serverResponse);
            return false;
        }
    }
    else {
        console.warn("DEB762 Invalid username or password:", validation.error);
        showFeedback(validation.error, 'red');
        return false;
    }
}

export async function setUserToken(username, token, days = 14){
    const serverResponse = await POSTJSONRequest({request: "set_user_token", name: username, token: token , days: days} );
    return serverResponse;
}


export async function getUserByToken(token){
    const serverResponse = await POSTJSONRequest({request: "get_user_by_token", token: token});
    return serverResponse;
}

export async function clearUserToken() {
    const loggedUser = await verifySession();
    if (loggedUser) {
        const serverResponse = await POSTJSONRequest({request: "clear_token", name: loggedUser});
       
        return serverResponse;
    }
    console.warn("DEB877 No logged user found to clear token");
}

export async function verifySession() {
    const sessionCookie = getCookie("session_token");
    if (!sessionCookie) {
        console.warn("DEB876 No session token found");
        return false;
    }
    const serverResponse = await POSTJSONRequest({request: "get_user_by_token", token: sessionCookie});
    return serverResponse.data.user_found;
}

export async function requestRenameFile(oldFilename, newFilename, sessionToken){
    const serverResponse = await POSTJSONRequest({request: "rename_file", old_filename: oldFilename, new_filename: newFilename, token: sessionToken});
    return serverResponse;
}

export async function requestDeleteFile(filename, sessionToken){
    const serverResponse = await POSTJSONRequest({request: "delete_file", file_to_delete: filename, token: sessionToken});
    return serverResponse;
}

export  async function uploadFiles(files) {
    
}

export async function requestSendTableAdmin(tableName, conditions = [], columns = ['*']){
    const token = window.SESSION.token;
    const serverResponse = await POSTJSONRequest({request: "send_table_to_frontend", table_name: tableName, token: token, conditions: conditions, columns: columns});
    return serverResponse;
}

export async function deleteUserByAdmin(username){
    const token = window.SESSION.token;
    const serverResponse = await POSTJSONRequest({request: "delete_user", name: username, token: token});
    return serverResponse;
}

export async function resetUserPasswordByAdmin(username, password) {
    const token = window.SESSION.token;
    const serverResponse = await POSTJSONRequest({ request: "reset_password_by_admin", name: username, password: password, token: token });
    return serverResponse;
}
