// ##############################
// #    Drag-n Drop Plasmids    #
// ##############################

function dropHandler(event){
    console.log('File(s) dropped');
    // Prevent default behavior (Prevent file from being opened)
    event.preventDefault();

    // Get Plasmid Property Definitions
    const PlasmidProject = $('#dragndrop-project option:selected').val();
    //const PlasmidDescription = document.getElementByID()
    const AddFeatures = document.getElementById("dragndrop-features").checked;
    const AddAttributes = document.querySelectorAll("[aria-selected='true']");
    // const AddAttributes = $('#sel option').filter(':selected');


    let AttributesList = [];
    for (let i=0;i<AddAttributes.length;i++){
        console.log(AddAttributes[i]);
        AttributesList.push(AddAttributes[i].id.split('-')[1]);
    }

    const FileMetadata = {
        'project': PlasmidProject,
        'features': AddFeatures,
        'attributes': AttributesList,
    };

    if(PlasmidProject !== ''){
        // Send data off to the server for processing
        if (event.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            for (var i = 0; i < event.dataTransfer.items.length; i++) {
                // If dropped items aren't files, reject them
                if (event.dataTransfer.items[i].kind === 'file') {
                    const file = event.dataTransfer.items[i].getAsFile();
                    console.log('... file[' + i + '].name = ' + file.name);
                    const processFileResponse = uploadPlasmidFile(file, FileMetadata);
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
                const processFileResponse = uploadPlasmidFile(event.dataTransfer.files[i], FileMetadata);
                // Update status list if response is not null
                if (processFileResponse != null){
                    reportFileUploadStatus(processFileResponse)
                }
            }
        }
    }
    else{
        $( "#SelectProjectForPlasmid" ).dialog({
            title: "Project Missing",
            minWidth: 500,
            modal: true,
        }).dialog("open");
    }
}

function dragOverHandler(event){
  // Prevent default behavior (Prevent file from being opened)
  event.preventDefault();
}

function uploadPlasmidFile(file, FileMetadata){
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

        // Add file metadata to FormData
        let formData = new FormData();

        // Push formData to server
        for ( var metadata in FileMetadata ) {
            formData.append(metadata, FileMetadata[metadata]);
        }
        formData.append("file", file, filename);

        // async=false as async submission of plasmids messes up sequential creator id assignment...
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
    const responseJSON = $.parseJSON(response);

    // Get list element created when file upload started
    let fileUploadStatus = document.getElementsByClassName(responseJSON['filename'])[0];
    console.log(fileUploadStatus);

    // Get rid of loading icon
    fileUploadStatus.removeChild(fileUploadStatus.firstChild);
    // Update status and color
    if (responseJSON['success'] === true) {
        fileUploadStatus.className += ' uploadSuccess';
        fileUploadStatus.style.backgroundColor = '#6EA400';
        fileUploadStatus.textContent = responseJSON['filename'] + ' successfully uploaded as Project ID ' + responseJSON['plasmid_id'][1];
    } else {
        fileUploadStatus.className += ' uploadFailure';
        fileUploadStatus.style.backgroundColor = '#EB093C';
        fileUploadStatus.textContent = responseJSON['filename'] + ' file upload failed!\n' + responseJSON['error'];
    }
}

// ###############################
// #    Plasmid Filter Tables    #
// ###############################

// Initialize DataTable
let datatable = $('#filteredPlasmidsTable').DataTable({
            "dom": "iprt",
            "ajax": '/database/update_filter_table/',
            "processing": true,
            "serverSide": true,
            "deferRender": true,
            "orderCellsTop": true,
            "scroller": true,
            "sScrollY": 300,
            "search": { "regex": true },
            "order": [[ 1, "asc" ]],
            "fixedColumns": true,
            "columnDefs": [
                { name: 'id', width: 100, targets: 0, visible: false},
                { name: 'project', width: 100, targets: 1 },
                { name: 'projectindex', width: 100, targets: 2},
                { name: 'features', width: 200, targets: 3,
                    orderable: false,
                    render : function (data, type, row, meta) {
                        return '<div style="overflow:scroll;width:100%;height:2.75em;">' + row[3] + '</div>';
                    }
                },
                { name: 'attributes', width: 200, targets: 4,
                    orderable: false,
                    render : function (data, type, row, meta) {
                        return '<div style="overflow:scroll;width:100%;height:2.75em;">' + row[4] + '</div>';
                    }
                },
                { name: 'description', width: 200, targets: 5,
                    orderable: false,
                    render : function (data, type, row, meta) {
                        return '<div style="overflow:scroll;width:100%;height:2.75em;">' + row[5] + '</div>';
                    }
                },
            ],
            "drawCallback": function( settings ) {
                this.api().columns.adjust();
            },
            "initComplete": function() {
                // I can't figure out how to get column inputs from  datatable.api()... so here's a map
                const columnMapping = {
                    'id_project': 4,
                    'id_projectindex': 3,
                    'id_features': 2,
                    'id_attributes': 1,
                    'id_description': 0,
                };

                const table = this;

                $('.filterInputsRow').on( "input paste ValueChange", 'input, select', function () {
                    const CurrentColumnName = this.name;
                    let searchJQO;
                    if ($(this).nodeName === 'SELECT'){
                        searchJQO = $('#id_project option:selected');
                    } else{
                        searchJQO = $(this);
                    }
                    // const inputValue = $.fn.dataTable.util.escapeRegex(searchJQO.val());
                    const inputValue = searchJQO.val();
                    const currentColumn = table.api().column(CurrentColumnName + ':name');
                    currentColumn.search( inputValue, false, false ).draw();
                    });
            },
});

// Enable row selection on datatable
datatable.on( 'click', 'tr', function () {
        $(this).toggleClass('selected');
});

// ##############################
// #    Reaction Definitions    #
// ##############################

let reactionDefinition = [];

// Add selected database plasmids to reaction
function addPlasmidsToReactionPool (event) {
    const selectedTable = event.data.targetTable;
    const selectedRows = datatable.rows('.selected');
    const selectedRowsData = selectedRows.data();

    // Add selected rows to reaction definition
    for(let i=0; i<selectedRowsData.length; i++){
        const selectedPlasmidID = Number(selectedRowsData[i][0]);
        const selectedUser = selectedRowsData[i][1];
        const selectedIndex = selectedRowsData[i][2];

        // Check if Plasmid has already been added... fucking Javascript
        let alreadyIncluded = false;
        for(let j=0;j<reactionDefinition.length;j++){
            let currentElement = reactionDefinition[j];
            console.log(currentElement);
            console.log(selectedPlasmidID);
            if(currentElement === selectedPlasmidID){
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
            $.data(newRow, 'PlasmidID', selectedPlasmidID);
            // Append
            selectedTable.append(newRow);
            // Add plasmid to reaction definition
            reactionDefinition.push(Number(selectedPlasmidID));
        }
    }
    // Deselect everything
    selectedRows.nodes().to$().removeClass('selected');
}

// Add plasmids to current reaction
$('#addMasterMix').on('click', {'targetTable': $('.MasterMix .assemblyDefinitions')}, addPlasmidsToReactionPool);
$('#addDropIn').on('click', {'targetTable': $('.DropIn .assemblyDefinitions')}, addPlasmidsToReactionPool);

// Only show enzymes if Golden Gate is selected
const EnzymeSelector = $('#enzymeTypeSelectorContainer');
$('#reactionTypeSelector').on('input', function(){
    if($('#reactionTypeSelector option:selected').val() === 'goldengate') {
        console.log(EnzymeSelector);
        EnzymeSelector.show();
    }else{
        EnzymeSelector.filter('select>option:eq(0)').prop('selected', true);
        EnzymeSelector.hide();
    }
});

// Define drop-in parts
let UnnamedPartCounter = 0;
$('#addDefinedPart').on('click', function(){
    $( "#NewPartDefinition" ).dialog({
            buttons: [
                {text: "Add Part",
                    click: function() {
                    // Get input values
                    const TempPartID = $('#NewPartID').val();
                    let NewPartID;
                    if(TempPartID !== ''){
                        NewPartID = TempPartID;
                    }else{
                        UnnamedPartCounter += 1;
                        NewPartID = 'Part ' + UnnamedPartCounter;
                    }
                    const NewPartSequence = $('#NewPartSequence').val().trim();
                    // Create button
                    const NewPartButton = document.createElement('button');
                    NewPartButton.innerText = NewPartID;
                    NewPartButton.className = 'definedPart';
                    // Assign values
                    $.data(NewPartButton, 'PartID', NewPartID);
                    $.data(NewPartButton, 'PartSequence', NewPartSequence);
                    // Add Part definition to $('.UserDefinedParts .assemblyDefinitions')
                    $('.UserDefinedParts .assemblyDefinitions').append(NewPartButton);
                    $(this).dialog( "close" );
                    },
                id: "AddDefinedPartButton",
                }],
            title: "New Part Definition",
            minWidth: 500,
            modal: true,
            beforeClose: function( event, ui ) {
                document.getElementById("NewPartID").value = null;
                document.getElementById("NewPartSequence").value = null;
            },
        }).dialog("open");
});

// Edit defined parts
$('.UserDefinedParts .assemblyDefinitions').on('click', 'button', function(){
    const CurrentPart = $(this);
    const CurrentPartID = CurrentPart.data('PartID');
    const CurrentPartSeq = CurrentPart.data('PartSequence');

    // Populate dialog with previous values
    document.getElementById("NewPartID").value = CurrentPartID;
    document.getElementById("NewPartSequence").value = CurrentPartSeq;

    // Open Dialog
    $('#NewPartDefinition').dialog({
        buttons: [
            {text: "Update Part",
                click: function(){
                // Get input values
                const NewPartID = $('#NewPartID').val();
                const NewPartSequence = $('#NewPartSequence').val().trim();
                // Update Button
                CurrentPart.text(NewPartID);
                // Update Part values
                CurrentPart.data('PartID', NewPartID);
                CurrentPart.data('PartSequence', NewPartSequence);
                $(this).dialog( "close" );
                }}],
        title: "Edit Part Definition",
        minWidth: 500,
        modal: true,
        beforeClose: function( event, ui ) {
            document.getElementById("NewPartID").value = null;
            document.getElementById("NewPartSequence").value = null;
        }
    });
});

// Only allow DNA ATCG in Part Sequence Text Area
const DNARegex = new RegExp('^[ATCGatcg]+$');
const PartSequenceTextArea = $('#NewPartSequence');
const DNAWarningMessage = $('#DNAWarningMessage');
// Part button toggling doesn't work with saved selections for some reason?
PartSequenceTextArea.on('input paste ValueChange', function(){
    if(DNARegex.test($(this).val())){
        $("#AddDefinedPartButton").button("enable");
        DNAWarningMessage.hide();
    }else{
        $("#AddDefinedPartButton").button("disable");
        DNAWarningMessage.show();
    }
});

// Remove database plasmids from current reaction
$('.assemblyDefinition').on('click', '.assemblyPlasmid', function(){
    const thisPlasmidID = $.data(this, 'PlasmidID');
    for( var i = 0; i < reactionDefinition.length; i++){
       if ( reactionDefinition[i] === thisPlasmidID) {
           console.log('Removing '+ reactionDefinition[i]);
           reactionDefinition.splice(i, 1);
       }
    }
    $(this).remove();
});


// #######################
// #   Attribute Menu    #
// #######################

const AttributeJSTree = $('#DragnDropAttr-TreeJS');

$(document).ready(function(){
    document.getElementById('dragndrop-project').value = user_index;  // Drag-n-drop
    $.post('/database/get_attribute_tree/', function(response){
        AttributeJSTree.jstree({
            "core": {
                "multiple": true,
                "data": response['data'],
                'themes': {
                    'name': 'proton',
                    'responsive': true
                },
            },
            "plugins" : [ "wholerow" , "sort"],
            "checkbox" : {
                "keep_selected_style" : false
            },
        });
    })
});
