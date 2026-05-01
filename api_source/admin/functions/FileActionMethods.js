import { showRenameModal, showDeleteModal} from "./NewModalMethods.js";
import { verifySession, requestRenameFile, requestDeleteFile } from "./RequestFunctions.js";
import { getSessionToken, showRenameFeedback, showDeleteFeedback } from "./CustomFunctions.js";
import { newHideModal } from "./PageAppearance.js";
export async function handleFileRename(filename){
   
    const sessionTest = await verifySession();
    
    if(!sessionTest){
        console.error("User must be logged in to rename a file.");
        return;
    }

  showRenameModal(filename);
}

export async function handleDeleteFile(filename){
    const sessionTest = await verifySession();
    
    if(!sessionTest){
        console.error("User must be logged in to rename a file.");
        return;
    }

  showDeleteModal(filename);
}

export async function executeFileRename(filename){
    const newNameFormField= document.getElementById("rename-input");
    const newName = newNameFormField.value;
    const errorField = document.getElementById('modal-alert-field');
    errorField.style.display = "none";
    const filenameRegEx = /^[a-zA-Z0-9._\-\s]{5,50}$/;
    const newfilenameValid = filenameRegEx.test(newName);
    
    if(!newfilenameValid){
        errorField.textContent = "filename must be between 5 and 50 characters long and contain only letters, numbers, dots, hyphens, underscores, and spaces.";
        errorField.style.display = "block";
        return;
    }
    const sessionToken = getSessionToken();
    const renameRequestResponse = await requestRenameFile(filename, newName, sessionToken);
    const renameRequestResult = renameRequestResponse.data.rename_output.renamed;

    console.log("DEB714, rename request result: ", renameRequestResult);
    if(renameRequestResult){
        newHideModal("my_modal");
        //adjust the name in file table
        const fileRow = document.querySelector(`tr[data-filename="${filename}"]`);
        if(fileRow){
            const filenameCell = fileRow.cells[1];
            filenameCell.textContent = newName;
            showRenameFeedback();
        }
        return;
    }
    const filerenameError = renameRequestResponse.data.rename_output.error;
    errorField.textContent = filerenameError;
    errorField.style.display = "block";
    console.log("DEB715, rename request error: ", filerenameError);
    return;
}

export async function executeFileDelete(filename){
    const sessionToken = getSessionToken();
    const deleteRequestResponse = await requestDeleteFile(filename, sessionToken);
    const deleteRequestResult = deleteRequestResponse.data.delete_output.deleted;
    if(deleteRequestResult){
        newHideModal("my_modal");
        //remove the row from the table
        const fileRow = document.querySelector(`tr[data-filename="${filename}"]`);
        if(fileRow){
            fileRow.remove();
            showDeleteFeedback();
            
        }
        return;
    }
    const filedeleteError = deleteRequestResponse.data.delete_output.error;
    console.log("DEB717, delete request error: ", filedeleteError); 
    return;
}