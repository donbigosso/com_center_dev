import { performAdminTests } from "./functions/TestFunctions.js";
console.log("DEB123 app.js loaded");
document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        const apiAdr = await performAdminTests();
        console.log(apiAdr   );
    })();
    
});