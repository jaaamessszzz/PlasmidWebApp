
// ###############################
// #    Load Add Plasmid Tabs    #
// ###############################

$('ul.pageTabs').each(function(){
    var $active, $content, $links = $(this).find('a');
    $active = $($links.filter('[href="'+location.hash+'"]')[0] || $links[0]);
    $active.addClass('active');
    $content = $($active[0].hash);
    $links.not($active).each(function () {
        $(this.hash).hide();
    });

    $(this).on('click', 'a', function(e){
    $active.removeClass('active');
    $content.hide();

    $active = $(this);
    $content = $(this.hash);

    $active.addClass('active');
    $content.show();

    e.preventDefault();
  });
});

// ##############################
// #    Drag-n Drop Plasmids    #
// ##############################

function dropHandler(event){
    console.log('File(s) dropped');
    // Prevent default behavior (Prevent file from being opened)
    event.preventDefault();

    if (event.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (var i = 0; i < event.dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (event.dataTransfer.items[i].kind === 'file') {
                const file = event.dataTransfer.items[i].getAsFile();
                console.log('... file[' + i + '].name = ' + file.name);
                const processFileResponse = uploadPlasmidFile(file);
                // Update status list if response is not null
                if (processFileResponse != null) {
                    reportFileUploadStatus(processFileResponse)
                }
            }
        }
    }
    else {
        // Use DataTransfer interface to access the file(s)
        for (var i = 0; i < event.dataTransfer.files.length; i++) {
            console.log('... file[' + i + '].name = ' + event.dataTransfer.files[i].name);
            const processFileResponse = uploadPlasmidFile(event.dataTransfer.files[i]);
            // Update status list if response is not null
            if (processFileResponse != null){
                reportFileUploadStatus(processFileResponse)
            }
        }
    }
}


function dragOverHandler(event){
  console.log('File(s) in drop zone');

  // Prevent default behavior (Prevent file from being opened)
  event.preventDefault();
}


function uploadPlasmidFile(file){
    const filename = file.name.toString();
    const file_ext = filename.split('.').pop();

    if(['gb', 'dna'].includes(file_ext)){
        console.log('Genbank/Snapgene file found!');

        // List item
        let listItem = document.createElement('li');
        listItem.className = file.name.toString();
        listItem.style.backgroundColor = '#506380';

        // Loader icon
        let loaderIcon = document.createElement('div');
        loaderIcon.className = 'ld ld-spinner ld-spin-fast';
        loaderIcon.style.display = 'inline-block';
        loaderIcon.style.fontSize = '10pt';
        loaderIcon.style.margin = '0 8pt 0 0';
        loaderIcon.style.color = '#052049';

        // Status text
        let statusText = document.createElement('div');
        statusText.className = 'statusText';
        statusText.style.display = 'inline';
        statusText.innerText = 'Uploading ' + filename + '...';

        listItem.appendChild(loaderIcon);
        listItem.appendChild(statusText);

        document.getElementsByClassName('reportUploadStatusList')[0].appendChild(listItem);

        // Push formData to server
        let formData = new FormData();
        formData.append("file", file, filename);

        // async=false as async submission of plasmids messes up sequential id numbering...
        // I tried adding a trigger database-side but the problem persists, the same index is assigned to multiple
        // rows before insert which results in integrity errors. 
        let jqXHR = $.ajax({
            async: false,
            type: "POST",
            url: '/database/add_plasmid_by_file/',
            data: formData,
            processData: false,
            contentType: false,
        });
        return jqXHR.responseText;

    }
    else{
        // Ignore anything that isn't .gb or .dna
        console.log('Get this outta my face');
        return null;
    }
}


function reportFileUploadStatus(response) {
    const responseJSON = $.parseJSON(response)

    // Get list element created when file upload started
    let fileUploadStatus = document.getElementsByClassName(responseJSON['filename'])[0];

    // Get rid of loading icon
    fileUploadStatus.removeChild(fileUploadStatus.firstChild);

    // Update status and color
    if (responseJSON['success'] === true) {
        fileUploadStatus.className += ' uploadSuccess';
        fileUploadStatus.style.backgroundColor = '#6EA400';

        fileUploadStatus.textContent = responseJSON['filename'] + ' successfully uploaded as User ID ' + responseJSON['plasmid_id'][1];
    } else {
        fileUploadStatus.className += ' uploadFailure';
        fileUploadStatus.style.backgroundColor = '#EB093C';
        fileUploadStatus.textContent = responseJSON['filename'] + ' file upload failed!\n' + responseJSON['error'];
    }
}

// ###############################
// #    Plasmid Filter Tables    #
// ###############################

// Keep track of draws for Datatables server-side rendering
let drawCount = 0;

// Initialize DataTable
let datatable = $('#filteredPlasmidsTable').DataTable({
            "dom": "iprt",
            "processing": true,
            "deferRender": true,
            "scroller": true,
            "sScrollY": 300,
            "columnDefs": [
                {   "targets": 2,
                    "orderable": false,
                    "render" : function (data, type, row, meta) {
                    return '<div style="overflow:hidden;width:100%;height:2.75em;">' + row[2] + '</div>';
                    }
                }
            ],
});

function postPlasmidFilter(){
    const selectedCreator = $('#id_creator').find(":selected").text();
    const selectedCreatorIndex = Number($('#id_creator_index').val());
    const descriptionFilter = $('#id_description').val();

    console.log(selectedCreatorIndex);

    const data = {
        'filter_data': {
            'creator': selectedCreator,
            'creatorindex': selectedCreatorIndex,
            'description': descriptionFilter,
        },
        'draw_count': drawCount,
        'csrfmiddlewaretoken': csrftoken
    };

    $.post('/database/assembly_plasmid_filter/', {data: JSON.stringify(data)},
        function(response){
        drawCount += 1;
        datatable.clear();
        datatable.rows.add(response['data']);
        datatable.draw();
    });
}

// Initialize table when page is loaded
$(document).ready(function(){
    postPlasmidFilter();
    datatable.children('th').each()

});

// Update table when any of the filter fields are altered
let userFormInput = $('.userSearchInput').children();
$(userFormInput).on("input paste ValueChange",function() {
    postPlasmidFilter();
    datatable.columns.adjust()
});

// Enable row selection on datatable
datatable.on( 'click', 'tr', function () {
        $(this).toggleClass('selected');
});

// ##############################
// #    Reaction Definitions    #
// ##############################

let reactionDefinition = [];
let addedPlasmids = 0;

function addPlasmidsToReactionPool (event) {
    const selectedTable = event.data.targetTable;
    const selectedRows = datatable.rows('.selected');
    const selectedRowsData = selectedRows.data();

    console.log(reactionDefinition);

    // Add selected rows to reaction definition
    for(let i=0; i<selectedRowsData.length; i++){

        const selectedUser = selectedRowsData[i][0];
        const selectedIndex = selectedRowsData[i][1];

        // Check if Plasmid has already been added... fucking Javascript
        let alreadyIncluded = false;
        for(let j=0;j<reactionDefinition.length;j++){
            let currentElement = reactionDefinition[j];
            if(currentElement[0] === selectedUser && currentElement[1] === selectedIndex){
                alreadyIncluded = true;
            }
        }

        // Add plasmid if not already included in reaction
        if(!alreadyIncluded){
            // Create row elements
            let newRow = document.createElement('button');
            newRow.innerText = selectedUser + ' ' + selectedIndex;
            newRow.className = 'assemblyPlasmid';
            // Assign values
            $.data(newRow, 'creator', selectedUser);
            $.data(newRow, 'creatorindex', selectedIndex);
            console.log(selectedRowsData[i][0], selectedRowsData[i][1]);
            // Append
            selectedTable.append(newRow);
            // Add plasmid to reaction definition
            reactionDefinition.push([selectedUser, selectedIndex])
        }
    }
    // Deselect everything
    selectedRows.nodes().to$().removeClass('selected');
}

// Add plasmids to current reaction
$('#addMasterMix').on('click', {'targetTable': $('.MasterMix .assemblyDefinitions')}, addPlasmidsToReactionPool);
$('#addDropIn').on('click', {'targetTable': $('.DropIn .assemblyDefinitions')}, addPlasmidsToReactionPool);

// Remove plasmids from current reaction
$('.assemblyDefinition').on('click', '.assemblyPlasmid', function(){
    const thisCreator = $.data(this, 'creator');
    const thisIndex = $.data(this, 'creatorindex');

    for( var i = 0; i < reactionDefinition.length; i++){
       if ( reactionDefinition[i][0] === thisCreator && reactionDefinition[i][1] === thisIndex) {
           console.log('Removing '+ reactionDefinition[i]);
           reactionDefinition.splice(i, 1);
       }
    }

    $(this).remove();
});

// ############################
// #    Perform Assemblies    #
// ############################

function performPlasmidAssembly(){
    // Get plasmid values from tables
    const plasmidsMasterMix = $('.MasterMix .assemblyDefinitions').children("button.assemblyPlasmid");
    const plasmidsDropIn = $('.DropIn .assemblyDefinitions').children("button.assemblyPlasmid");
    console.log(plasmidsMasterMix);
    console.log(plasmidsDropIn);
}

// Perform Assembly Reaction
$('#performReaction').on('click', performPlasmidAssembly);
