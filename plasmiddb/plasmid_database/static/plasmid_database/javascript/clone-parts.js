// Import PlasmidMap
// import { PlasmidMap } from './clone-standardized.js';

// todo: figure out how to do imports in javascript...
// Copied from clone-standardized.js
// class PlasmidMap {
//     // Cirular double linked list for plasmid part definitions 5'->3'
//     constructor(){
//         this.head = null;
//         this.size = 0;
//         this.tk_parts = ['1', '2a', '2b', '3a', '3b', '4a', '4b', '5', '6', '7', '8a', '8b'];
//     }
//
//     add(part){
//         var newNode = new Node(part);
//
//         if (this.head == null){
//             this.head = newNode;
//             newNode.next = newNode;
//             newNode.previous = newNode;
//         }
//
//         else {
//             const tail = this.head.previous;
//             tail.next = newNode;
//             newNode.previous = tail;
//             newNode.next = this.head;
//             this.head.previous = newNode;
//         }
//         this.size++;
//     }
// }

// Part instructions collapsible
$('#partInstructionsButton').on('click', function(){
    let collapsibleDiv = document.getElementById('partInstructionsDiv');
    if (collapsibleDiv.style.display === "block"){
        collapsibleDiv.style.display = "none";
    } else {
        collapsibleDiv.style.display = "block";
    }
});

// Submit Parts for Assembly
$('#partForm').submit(function(e) {
    e.preventDefault();

    let partPostData = {};
    const partEntryField = $('#partEntry');
    let partTextAreaLines = partEntryField.val().split('\n');

    const templateEntryField = $('#templateEntry');
    let templateTextAreaLines = templateEntryField.val().split('\n');

    let addStandardized = document.getElementById("addStandard").checked;
    // Get entry vector
    let entryVectorID = document.getElementById('partEntryVectors').value;
    let projectID = document.getElementById('partProject').value;

    // Upload a .zip file of PCR templates

    // Code for upload goes here - reference the dragndrop section

    // Validate Rows - todo: No longer throw an error - try to remove RS instead
    let rowErrors = [];
    const DNARegex = new RegExp('^[ATCGatcg]+$');
    // todo: split up restriction site recognition based on user inputs
    // todo: check for restriction sites at beginning/end of sequence (assumes part 3)
    //const RxnSiteRegex = new RegExp('CGTCTC|GAGACG|GAAGAC|GTCTTC');

    // Empty form check
    if (partEntryField.val().length === 0){
        rowErrors.push('Form is empty!');
    }

    // Part entry format (tab-delimited): Description,  Part Type,  Sequence, method="None" fiveprime="", threeprime=""
    partTextAreaLines.forEach(function(element, idx){
        let index = idx + 1;
        let rowElements = element.split('\t');
        // Skip returns
        if (element === ''){return;}
        if(rowElements.length < 3){
            rowErrors.push('Row ' + index + ' requires all fields!');
            return;
        }

        // Description is required
        let userDescription = rowElements[0].trim();

        // Part type syntax: 3 | 2-4 | 5-1
        // Use plasmid map to automatically determine multi-component parts
        let tk_parts = ['1', '2a', '2b', '3a', '3b', '3c', '3d', '3e', '4a', '4b', '5', '6', '7','Custom'];
        let partTypeRaw = rowElements[1].trim();

        let leftPartType;
        let rightPartType;
        let fiveprime;
        let threeprime;

        if (partTypeRaw == 'Custom'){
            leftPartType = 'Custom';
            rightPartType = 'Custom';
            // Check to make sure the custom overhangs are included
            if (rowElements.length === 6){
              fiveprime = rowElements[4].trim();
              threeprime = rowElements[5].trim();
            } else {
              rowErrors.push('Row ' + index + ' is a Custom assembly and is missing overhang definitions!');
            }
        } else if (partTypeRaw.includes('-')){
            // Parts defined as spans
            let partTypes = partTypeRaw.split('-');
            leftPartType = partTypes[0];
            rightPartType = partTypes[1];

            // Verify that parts are in part list
            if (!tk_parts.includes(leftPartType) || !tk_parts.includes(rightPartType)){
                rowErrors.push('Row ' + index + ' has a problem with the part definition!');
            }

        } // else no logic needed, just make sure entry is in part list
        else {
            if (!tk_parts.includes(partTypeRaw)) {
                rowErrors.push('Row ' + index + ' has a problem with the part definition!');
            }
            leftPartType = partTypeRaw;
            rightPartType = partTypeRaw;
          }

        let partSequence = rowElements[2].trim().toUpperCase();

        // Ensure sequence is ATCG
        if(!DNARegex.test(partSequence)){
            rowErrors.push('Row ' + index + ' contains invalid DNA symbols!');
        }

        let method;
        if (rowElements.length > 3){
          method = rowElements[3].trim();
          if (method === ''){
            method = 'None';
          }
          // Ensure the selected Method is compatible with the downstream partAssembly script
          let available_methods = ['None','gBlocks','Oligo Assembly','PCR','PCA']
          if (!available_methods.includes(method)){
              rowErrors.push('Row ' + index + ' has a problem with the Method!');
          }
        }

        /* else {
            // if length == 1, get all parts in part list, sort, select start and end accordingly
            if (partTypeRaw.length === 1 ){
                // todo: figure out why Chrome doesn't recognize this array comprehension
                // let partSubset = [for (part of PlasmidMap.tk_parts) if (part[0] === partTypeRaw) part];
                let partSubset = [];
                // todo: get parts from PlasmidMap
                for (part of tk_parts){
                    if (part[0] === partTypeRaw){
                        partSubset.push(part);
                    }
                }
                if (partSubset.length === 0 ){
                    rowErrors.push('Row ' + index + ' has a problem with the part definition!');
                } else{
                    leftPartType = partSubset[0];
                    rightPartType = partSubset[partSubset.length-1];
                }
            }
            */
        // Add data to POST dict
        partPostData[index] = [userDescription, [leftPartType, rightPartType], partSequence, method, fiveprime, threeprime]
      });

      let possibleTemplates = {};

      templateTextAreaLines.forEach(function(element, idx){
          let index = idx + 1;
          let rowElements = element.split('\t');
          // Skip returns
          if (element === ''){return;}
          if(rowElements.length < 2){
              rowErrors.push('Row ' + index + ' requires all fields!');
              return;
          }
          // Add data to the possibleTemplates dict
          possibleTemplates[rowElements[0]] = rowElements[1]
        });


    // Submit parts to database if all rows pass validation
    if (rowErrors.length === 0){
        // Send form, report assembly results
        console.log(partPostData);
        let postData = {'parts': partPostData, 'addStandard': addStandardized, 'entryVectorID': entryVectorID, 'projectID': projectID, 'possibleTemplates': possibleTemplates};
        console.log(postData);

        $.ajax({
            url: '/database/part_assembly/',
            data: {'data': JSON.stringify(postData)},
            method: "POST",
            success: function () {
                window.location.href = '/database/assembly_results/';
            }
        });

    } else { // Report failed rows
        let errorList = document.getElementById('partErrorList');
        errorList.innerHTML = '';
        rowErrors.forEach(function (element) {
            let errorPoint = document.createElement('li');
            console.log(element);
            errorPoint.innerText = element;
            errorList.appendChild(errorPoint);
        });

        document.getElementById('partErrors').style.display = 'block';
    }
});

// Page Loaded
$(document).ready(function(){
    // Set Project to User
    document.getElementById('partProject').value = user_index;
    console.log('Page loaded!');
    pageLoaded = true;
});
