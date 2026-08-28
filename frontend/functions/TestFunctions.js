import {  changeButtonText, showModal } from "./PageAppearance.js";
import { onClick } from "./EventFunctions.js";
import {getSessionToken} from "./CustomFunctions.js";
import {requestDeleteFile} from "./RequestFunctions.js";
import {POSTJSONRequest} from "./CoreFunctions.js";
import {createMediaTilePic, createPictureWrapper} from "./GalleryFunctions.js";
import {getPLN_GMD_w_text, getAstronoutsHTML} from "./ExtApiFunctions.js";



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


export function createImagepics(){
  const wrapper = createPictureWrapper();
  
  for (let i = 0; i < 16; i++) {
    const picFilename = "Image_0000"+i+".jpeg";
    const tile = createMediaTilePic("../galleries/test_junk/regular/"+picFilename, "Title", "Caption");
      wrapper.appendChild(tile);
    }
  document.getElementById("pics").appendChild(wrapper);
}



export async function runtCCtests (){
  const testArea = document.getElementById("cc-test-area");
  
  // Connemt/uncomment below line to display test area
  testArea.classList.add('d-none');
  const resultArea1 = document.getElementById("result_1");  
  const resultArea2 = document.getElementById("result_2");  
//  startISSPositionUpdate();
//  console.log(await getAustronautsNames());
  let GMDconversionRate = await getPLN_GMD_w_text("PLN", "GMD");
  resultArea1.textContent = GMDconversionRate;
  let result2 = await getAstronoutsHTML();
  resultArea2.innerHTML = result2;
}