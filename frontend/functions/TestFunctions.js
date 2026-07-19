import {  changeButtonText, showModal } from "./PageAppearance.js";
import { onClick } from "./EventFunctions.js";
import {getSessionToken} from "./CustomFunctions.js";
import {requestDeleteFile} from "./RequestFunctions.js";
import {POSTJSONRequest} from "./CoreFunctions.js";



export function changeTestResultText(text){
    const testField = document.querySelector('.test-results');
    testField.textContent = text;
}






export function performTests(){

    const testButton = document.querySelector("#testBtn");
    const testButton2 = document.querySelector("#testBtn2");
    changeButtonText(testButton, "Test admin check");
    changeButtonText(testButton2, "Test delete API");

    onClick(testButton, async () => {
      const sessionToken = getSessionToken();
      const testResponse = await POSTJSONRequest({request:"test",token:sessionToken}) 
      console.log(testResponse);
    });
      onClick(testButton2, async () => {
 // const test_response = await verifyUserByPassword("bisssgos","Budwajzer@13");
 //    const test_response= await POSTJSONRequest({request: "create_user",name:"szymon644", password:"maskarada"});
const test_response= await requestDeleteFile("	sddefault.jpg", "supertoken1234");
//const test_response= await POSTJSONRequest({request: "set_user_token",name:"bigos", token:"supertoken1234"});
      console.log(test_response);
       
    }); 


    
}