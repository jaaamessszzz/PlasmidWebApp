
// ##############################
// #    Drag-n Drop Plasmids    #
// ##############################

function dropHandler(event){
    console.log('File(s) dropped');
    // Prevent default behavior (Prevent file from being opened)
    event.preventDefault();

    // Get Plasmid Property Definitions
    const PlasmidProject = $('#dragndrop-project option:selected').val();
    const AddFeatures = document.getElementById("dragndrop-features").checked;
    const AddAttributes = $('#sel option').filter(':selected');

    let AttributesList = [];
    for (let i=0;i<AddAttributes.length;i++){
        console.log(AddAttributes[i]);
        AttributesList.push(AddAttributes[i].val());
    }

    const FileMetadata = {
        'project': PlasmidProject,
        'features': AddFeatures,
        'attributes': [1]
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
                { width: 100, targets: 0 },
                { width: 0, targets: 1 , visible: false},
                { width: 100, targets: 2},
                { width: 200, targets: 3,
                    orderable: false,
                    render : function (data, type, row, meta) {
                        return '<div style="overflow:scroll;width:100%;height:2.75em;">' + row[3] + '</div>';
                    }
                },
                { width: 200, targets: 4,
                    orderable: false,
                    render : function (data, type, row, meta) {
                        return '<div style="overflow:scroll;width:100%;height:2.75em;">' + row[4] + '</div>';
                    }
                },
                { width: 200, targets: 5,
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
                    'id_project': 5,
                    'id_projectindex': 3,
                    'id_features': 2,
                    'id_attributes': 1,
                    'id_description': 0,
                };

                const table = this;

                $('.filterInputsRow').on( "input paste ValueChange", 'input, select', function () {
                    const inputFieldID = this.id;
                    let searchJQO;
                    if ($(this).nodeName === 'SELECT'){
                        searchJQO = $('#id_project option:selected');
                    } else{
                        searchJQO = $(this);
                    }
                    // const inputValue = $.fn.dataTable.util.escapeRegex(searchJQO.val());
                    const inputValue = searchJQO.val();
                    const currentColumn = table.api().column(columnMapping[inputFieldID]);

                    console.log('Input ID', inputFieldID);
                    console.log('Input value', inputValue);
                    console.log('Column index', currentColumn.index());

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

    console.log(reactionDefinition);

    // Add selected rows to reaction definition
    for(let i=0; i<selectedRowsData.length; i++){
        console.log(selectedRowsData[i]);
        const selectedUser = selectedRowsData[i][0];
        const selectedUserID = selectedRowsData[i][1];
        const selectedIndex = selectedRowsData[i][2];

        // Check if Plasmid has already been added... fucking Javascript
        let alreadyIncluded = false;
        for(let j=0;j<reactionDefinition.length;j++){
            let currentElement = reactionDefinition[j];
            if(currentElement[0] === selectedUserID && currentElement[1] === selectedIndex){
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
            $.data(newRow, 'creator', selectedUserID);
            $.data(newRow, 'projectindex', selectedIndex);
            console.log(selectedRowsData[i][1], selectedRowsData[i][2]);
            // Append
            selectedTable.append(newRow);
            // Add plasmid to reaction definition
            reactionDefinition.push([selectedUserID, selectedIndex])
        }
    }
    // Deselect everything
    selectedRows.nodes().to$().removeClass('selected');
}

// Add plasmids to current reaction
$('#addMasterMix').on('click', {'targetTable': $('.MasterMix .assemblyDefinitions')}, addPlasmidsToReactionPool);
$('#addDropIn').on('click', {'targetTable': $('.DropIn .assemblyDefinitions')}, addPlasmidsToReactionPool);

// Define drop-in parts
let NewPartCount = 0;
$('#addDefinedPart').on('click', function(){
    $( "#NewPartDefinition" ).dialog({
            buttons: [
                {text: "Add Part",
                    click: function() {
                        // Get input values
                        const NewPartID = $('#NewPartID').val();
                        const NewPartSequence = $('#NewPartSequence').val();
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
                    }
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
            {text: "Delete",
                click: function(){
                CurrentPart.remove();
                $(this).dialog( "close" );}
                },
            {text: "Update Part",
                click: function(){
                // Get input values
                const NewPartID = $('#NewPartID').val();
                const NewPartSequence = $('#NewPartSequence').val();
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

// Remove database plasmids from current reaction
$('.assemblyDefinition').on('click', '.assemblyPlasmid', function(){
    const thisCreator = $.data(this, 'creator');
    const thisIndex = $.data(this, 'projectindex');

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

    let plasmidPostData = {};
    let masterMix = [];
    let dropIn = [];

    for(let i=0;i<plasmidsMasterMix.length;i++){
        const plasmid = $(plasmidsMasterMix[i]);
        masterMix.push([Number(plasmid.data('creator')), Number(plasmid.data('projectindex'))]);
    }
    for(let i=0;i<plasmidsDropIn.length;i++){
        const plasmid = $(plasmidsDropIn[i]);
        dropIn.push([Number(plasmid.data('creator')), Number(plasmid.data('projectindex'))]);
    }
    plasmidPostData['MasterMix'] = masterMix;
    plasmidPostData['DropIn'] = dropIn;

    // Get reaction definition options
    const reactionType = $('#reactionTypeSelector option:selected').val();
    const reactionEnzyme = $('#enzymeTypeSelector option:selected').val();

    plasmidPostData['ReactionType'] = reactionType;
    plasmidPostData['ReactionEnzyme'] = reactionEnzyme;

    $.post('/database/perform_assemblies/', {'data': JSON.stringify(plasmidPostData)}, function (response) {
        console.log(response);
        const ReportContents = $('#AssemblyReport .reportUploadStatusList');
        // Clear any previous dialog data
        ReportContents.empty();
        // Populate dialog
        for(let i=1;i<Object.keys(response).length + 1; i++){
            const Assemblyli = document.createElement('li');
            const ReactionPlasmids = response[i]['reaction_plasmids'];

            let ReportStatus;
            let ReportParts = '\n';
            for(let j=0;j<ReactionPlasmids.length;j++){
                ReportParts += ReactionPlasmids[j][0] + ' ' + ReactionPlasmids[j][1];
                if (j !== ReactionPlasmids.length - 1){
                    ReportParts += ', ';
                }
            }

            if (response[i]['success'] === true) {
                const AssemblyID = response[i]['assembly_id'];
                ReportStatus = 'Assembly #' + i + ' was added to the Database as User ID ' + AssemblyID;

                Assemblyli.className = 'AssemblySuccess';
                Assemblyli.style.backgroundColor = '#6EA400';
                ReportContents.append(Assemblyli);
            }
            else{
                ReportStatus = 'Assembly #' + i + ' failed...';
                Assemblyli.className = 'AssemblyFailure';
                Assemblyli.style.backgroundColor = '#EB093C';
            }
            Assemblyli.innerText = ReportStatus + ReportParts;
        }

        // Initalize and Generate Assembly Report Dialog
        $( "#AssemblyReport" ).dialog({
            buttons: [
                {text: "OK",
                    click: function() {
                        $( this ).dialog( "close" );
                    }
                }],
            title: "Assembly Results",
            minWidth: 400,
            modal: true,
            beforeClose: function( event, ui ) {
                $('.assemblyPlasmid').remove();
                reactionDefinition = [];
            }
        }).dialog("open");
    });
}

// Perform Assembly Reaction
$('#performReaction').on('click', performPlasmidAssembly);

// #######################
// #   Attribute Menu    #
// #######################

const AttrSelector = $('#dragndrop-attributes');
// Populate Attribute Menu
AttrSelector.on('click', '.TreeMenuCaret', function(){
    let ParentNode = this.parentNode;
    let ParentNodeJQO = $(ParentNode);
    let NodeAttrID;

    // Get Attribute PK from data-nodeinit if it exists
    if (ParentNodeJQO.attr('data-nodeinit')) {
        NodeAttrID = ParentNodeJQO.attr('data-nodeinit');
    // Get Attribute PK from $.data()
    } else {
        NodeAttrID = ParentNodeJQO.data('attr_pk');
    }

    console.log(ParentNode);
    console.log(NodeAttrID);

    if(!ParentNode.classList.contains('loaded')){
        $.post('/database/get_attribute_children/', {'attr_pk': NodeAttrID}, function (response) {
            const AttrChildren = response['attr_children'];
            const NodesWithChildren = response['nodes_with_children'];
            // Create new list
            let NestedList = document.createElement('ul');
            NestedList.classList.add('nested');
            NestedList.classList.add('active');
            for(let i=0;i<AttrChildren.length;i++){
                const ChildAttr = AttrChildren[i];
                let NewLineList = document.createElement('li');
                // Add caret if node has children
                if(NodesWithChildren.includes(ChildAttr[0])){
                    let NewLineListSpan = document.createElement('span');
                    NewLineListSpan.className = 'TreeMenuCaret';
                    NewLineList.appendChild(NewLineListSpan);
                }
                NewLineList.textContent = ChildAttr[1];
                NewLineList.classList.add('terminal');
                $(NewLineList).data('attr_pk', ChildAttr[0]);
                NestedList.appendChild(NewLineList);
            }
            ParentNodeJQO.append(NestedList);
            ParentNode.classList.add('loaded');
        });
    } else{
        ParentNode.querySelector(".nested").classList.toggle("active");
    }

    // Toggle caret if caret exists
    if(ParentNode.querySelector('.TreeMenuCaret')){
        ParentNode.querySelector('.TreeMenuCaret').classList.toggle("caret-down");
    }
});

// Select Atrtibutes
AttrSelector.on('click', 'li', function(){
    if(this.classList.contains('terminal')){
        this.classList.toggle('selected');
    }
});