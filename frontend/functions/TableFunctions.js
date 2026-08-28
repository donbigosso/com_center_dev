//file table sorting
import { downloadFileFromAPI, showCopiedLinkFeedback, generateAndCopyDownloadLink } from "./CustomFunctions.js";
import {handleFileRename, handleDeleteFile} from "./FileActionMethods.js";


function sortTable(columnIndex, isNumeric = false, isDate = false) {
  const tbody = document.getElementById('file-table-body');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    let aText = a.children[columnIndex].textContent.trim();
    let bText = b.children[columnIndex].textContent.trim();

      // Case-insensitive comparison for filename column
    if (columnIndex === 1) {
      aText = aText.toLowerCase();
      bText = bText.toLowerCase();
    }

    if (isNumeric) {
      aText = parseFloat(aText.replace(/[^0-9.]/g, '')) || 0;
      bText = parseFloat(bText.replace(/[^0-9.]/g, '')) || 0;
    }

    if (isDate) {
      aText = new Date(aText);
      bText = new Date(bText);
    }

    if (aText > bText) return 1;
    if (aText < bText) return -1;
    return 0;
  });

  // Toggle direction on second click (simple: reverse if already sorted)
  if (tbody.dataset.sorted === columnIndex.toString()) {
    rows.reverse();
    delete tbody.dataset.sorted;
  } else {
    tbody.dataset.sorted = columnIndex;
  }

  // Append sorted rows
  rows.forEach(row => tbody.appendChild(row));
  //Update row numbers after sorting
  updateRowNumbers();
}

function sortByColumnIndex(index) {
  if (index === 1) sortTable(1);              // File Name (text)
  if (index === 2) sortTable(2, true);        // Size (numeric after cleaning)
  if (index === 3) sortTable(3, false, true); // Uploaded (date)
}

export function initializeTableSorting() {
document.querySelectorAll('thead th').forEach((th, index) => {
  if (index === 4) return; // skip Actions column

  th.addEventListener('click', () => {
   // if (index === 0) sortTable(0, true);        // # (numeric) this column idicates the amount of rows and should not be sorted
    sortByColumnIndex(index);
  });
});

document.querySelectorAll('.ft-sort-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const index = Number(btn.dataset.sort);
    sortByColumnIndex(index);
  });
});
}


//-------------add row to table--------------------
export function addRowToTable(fileName, fileSize, date) {
  const tableBody = document.getElementById('file-table-body');
  const newRow = document.createElement('tr');
  //for name adjustment function after rename
newRow.dataset.filename = fileName;
  const nextRowNumber = tableBody.querySelectorAll('tr').length + 1;

  newRow.innerHTML = `
    <th class="ft-row-num" scope="row">${nextRowNumber}</th>
    <td class="ft-file-name" data-label="File">${fileName}</td>
    <td class="ft-file-size" data-label="Size">${fileSize}</td>
    <td class="ft-file-date" data-label="Uploaded">${date}</td>
    <td class="ft-actions text-center">
      <button type="button" class="btn ft-action-btn ft-action-download" data-action="download" aria-label="Download"><i class="bi bi-download"></i></button>
      <button type="button" class="btn ft-action-btn ft-action-copy" data-action="copy-link" aria-label="Copy link"><i class="bi bi-link-45deg"></i></button>
      <button type="button" class="btn ft-action-btn ft-action-rename logged-only" data-action="rename" aria-label="Rename"><i class="bi bi-pencil"></i></button>
      <button type="button" class="btn ft-action-btn ft-action-delete logged-only" data-action="delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
    </td>
  `;

  tableBody.appendChild(newRow);
}
//-------------delete row from table--------------------
export function deleteRow(rowNumber) {
    // Get the table body
    const tableBody = document.getElementById('file-table-body');
    
    // Get all rows in the table
    const rows = tableBody.querySelectorAll('tr');
    
    // Check if the row number is valid (1-based index)
    if (rowNumber < 1 || rowNumber > rows.length) {
        console.log(`Row ${rowNumber} does not exist. Total rows: ${rows.length}`);
        return;
    }
    
    // Convert to 0-based index and remove the row
    const rowToDelete = rows[rowNumber - 1];
    rowToDelete.remove();
    
    // Optional: Update the row numbers for all remaining rows
    updateRowNumbers();
}

// Optional helper function to renumber rows after deletion
function updateRowNumbers() {
    const tableBody = document.getElementById('file-table-body');
    const rows = tableBody.querySelectorAll('tr');
    
    rows.forEach((row, index) => {
        // Update the first <th> element (row number)
        const rowNumberCell = row.querySelector('th');
        if (rowNumberCell) {
            rowNumberCell.textContent = index + 1;
        }
    });
}

export function addFileListToTable(fileArray){
  /* example of file array 
  [
  ["meeting_notes.txt", 1345, "2024-06-14"],
  ["budget.xlsx", 450, "2024-06-13"],
  ["presentation.pptx", 1800, "2024-06-12"]
]
  */
  
  fileArray.forEach(file => {
    const fileSizeKB = file[1] + " KB";
    addRowToTable(file[0], fileSizeKB, file[2]);
   })
}

// Table buttons

export function initializeTableButtons() {
  document.getElementById('file-table-body').addEventListener('click', function(e) {
  const actionButton = e.target.closest('button[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    const row = actionButton.closest('tr');

    // Get file info from row
    const fileName = row.cells[1].textContent;
    const fileSize = row.cells[2].textContent;
    const date = row.cells[3].textContent;

    if (action === 'download') {
      // handle download
      console.log('Download:', fileName);
      downloadFileFromAPI(fileName);
    } else if (action === 'rename') {
      // handle rename
      handleFileRename(fileName);

    } else if (action === 'delete') {
      // handle delete - e.g., row.remove();
      console.log('Delete:', fileName);
      handleDeleteFile(fileName);
    /*  const deleteResponse = true; //this will come from external function basing on serer response
      if(deleteResponse){
        row.remove();
    }*/
    }
    else if (action === 'copy-link') {
      // handle copy link
      const button = e.target.closest('button');
     

  generateAndCopyDownloadLink(fileName);

  showCopiedLinkFeedback();
    }
  }
});

}

