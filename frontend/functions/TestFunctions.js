import {  changeButtonText, showModal } from "./PageAppearance.js";
import { onClick } from "./EventFunctions.js";
import {getSessionToken} from "./CustomFunctions.js";
import {requestDeleteFile} from "./RequestFunctions.js";
import {POSTJSONRequest} from "./CoreFunctions.js";
import {createMediaTilePic, createPictureWrapper} from "./GalleryFunctions.js";
import {getPLN_GMD_w_text} from "./ExtApiFunctions.js";
import { createPostForm, listPosts, renderPostCard } from "./PostFunctions.js";



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

export async function renderLastPost(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.replaceChildren();
  const response = await listPosts({ page: 1, limit: 1 });
  const posts = response?.data?.posts || [];

  if (!response?.success || posts.length === 0) {
    container.textContent = "no posts";
    return;
  }

  container.appendChild(renderPostCard(posts[0]));
}

export function mountTestPostForm(container, onCreated) {
  if (!(container instanceof HTMLElement)) {
    return null;
  }

  container.replaceChildren();
  return createPostForm(container, { onCreated });
}

export async function initHomepagePostTest() {
  const formSlot = document.getElementById("result_1");
  const readSlot = document.getElementById("result_2");
  if (!formSlot || !readSlot) {
    return;
  }

  mountTestPostForm(formSlot, async () => {
    await renderLastPost(readSlot);
  });
  await renderLastPost(readSlot);
}

export async function runtCCtests (){
  const testArea = document.getElementById("cc-test-area");
  
  // Keep visible so homepage post create/read can be tested
  if (testArea) {
    testArea.classList.remove("d-none");
  }

  await initHomepagePostTest();
}
