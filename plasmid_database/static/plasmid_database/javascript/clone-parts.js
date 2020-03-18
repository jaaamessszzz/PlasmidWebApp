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
    let partTextAreaLines = $('#partEntry').val().split('\n');
    let addStandardized = document.getElementById("addStandard").checked;
    // Get entry vector
    let entryVectorID = document.getElementById('partEntryVectors').value;
    console.log(entryVectorID);
    let projectID = document.getElementById('partProject').value;

    // Validate Rows
    let rowErrors = [];
    const DNARegex = new RegExp('^[ATCGatcg]+$');
    const RxnSiteRegex = new RegExp('^CGTCTC|GAGACG|GGTCTC|GAGACC|GCGGCCGC|CGCCGGCG$');

    // Part entry format (tab-delimited): Description  Part Type  Sequence
    partTextAreaLines.forEach(function(element, idx){
        let index = idx + 1;
        let rowElements = element.split('\t');
        // Skip returns
        if (element === ''){return;}
        if(rowElements.length !== 3){
            rowErrors.push('Row ' + index + ' requires all fields!');
            return;
        }

        // Description is required
        let userDescription = rowElements[0].trim();

        // Part type syntax: 3 | 2-4 | 5-1
        // Use plasmid map to automatically determine multi-component parts
        let tk_parts = ['1', '2a', '2b', '3a', '3b', '4a', '4b', '5', '6', '7', '8a', '8b'];
        let partTypeRaw = rowElements[1].trim();
        let leftPartOverhang;
        let rightPartOverhang;
        let partSequence = rowElements[2].trim();

        if (partTypeRaw.includes('-')){
            // Parts defined as spans
            let partTypes = partTypeRaw.split('-');
            let leftPartOverhang = partTypes[0];
            let rightPartOverhang = partTypes[partTypes.length-1];

            // Verify that parts are in part list
            if (!tk_parts.includes(leftPartOverhang) || !PlasmidMap.tk_parts.includes(rightPartOverhang)){
                rowErrors.push('Row ' + index + ' has a problem with the part definition!');
            }

        } else {
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
                    leftPartOverhang = partSubset[0];
                    rightPartOverhang = partSubset[partSubset.length-1];
                }
            }
            // else no logic needed, just make sure entry is in part list
            else{
                if (!tk_parts.includes(partTypeRaw)) {
                    rowErrors.push('Row ' + index + ' has a problem with the part definition!');
                }
                leftPartOverhang = partTypeRaw;
                rightPartOverhang = partTypeRaw;
            }
        }
        // Ensure sequence is ATCG
        if(!DNARegex.test(partSequence)){
            rowErrors.push('Row ' + index + ' contains invalid DNA symbols!');
        }
        // Check for restriction sites
        if (RxnSiteRegex.test(partSequence)){
            rowErrors.push('Row ' + index + ' contains a BsaI/BsmBI/NotI restriciton site!');
        }
        // Check codons for coding sequences
        if (leftPartOverhang.includes('3') && rightPartOverhang.includes('3')){
            if(partSequence.length % 3 !== 0){
                rowErrors.push('Row ' + index + ' sequence needs to be in frame with complete codons!');
            }
        }

        // Add data to POST dict
        partPostData[index] = [[leftPartOverhang, rightPartOverhang], partSequence, userDescription]
    });

    // Submit parts to database if all rows pass validation
    if (rowErrors.length === 0){
        // Send form, report assembly results
        console.log(partPostData);
        let postData = {'parts': partPostData, 'addStandard': addStandardized, 'entryVectorID': entryVectorID, 'projectID': projectID};
        console.log(postData);

        $.ajax({
            url: '/database/part_assembly/',
            data: postData,
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