const LocationJSTree = $('#Locations-TreeJS');
const ContainerJSTree = $('#Containers-TreeJS');

let LocationID;
let LocationName;
let LocationDescription;

let ContainerID;
let ContainerName;
let ContainerDescription;

// Load Locations
$(document).ready(function(){
    $.post('/locations/get_location_tree/', function(response){
        console.log('Locations Loaded!!!!!');
        LocationJSTree.jstree({
            "core": {
                "data": response['data'],
                'themes': {
                    'name': 'proton',
                    'responsive': true,
                },
                "multiple": false,
                "check_callback" : true,
            },
            "plugins" : [ "wholerow" , "sort",],
        });

        // Load empty container JSTree
        ContainerJSTree.jstree({
            "core": {
                "data": [],
                'themes': {
                    'name': 'proton',
                    'responsive': true,
                },
                "multiple": false,
                "check_callback" : true,
            },
            "plugins" : [ "wholerow" , "sort",],
        });
    });
});

function LoadLocationJSTree(){
    $.post('/locations/get_location_tree/', function(response){
        console.log('Locations Loaded!!!!!');
        LocationJSTree.jstree(true).settings.core.data = response['data'];
        LocationJSTree.jstree(true).refresh();
    });
}

// Load Containers for a selected location
LocationJSTree.on('select_node.jstree', function(event, data){
    document.getElementById('Container-Info-Panel').style.display = 'none';
    document.getElementById('Location-Info-Panel').style.visibility = 'visible';
    document.getElementById('Location-Info-Panel').style.display = 'inline-block';
    LocationID = data['node']['data']['id'];

   $.post('/locations/get_location_info/', {'loc_id': LocationID}, function(response){
       // Update Location-Info-Panel
       LocationName = response['Name'];
       LocationDescription = response['Description'];
       document.getElementById('CurrentLocationHeader').textContent = LocationName;
       document.getElementById('CurrentLocationCreator').textContent = response['Creator'];
       document.getElementById('CurrentLocationDescription').textContent = LocationDescription;
       document.getElementById('CurrentLocationChildren').textContent = response['Children'];

       // Only show delete button if user made attribute
       if(response['CreatorID'] !== CurrentUserID){
           $('#DeleteLocation').hide();
           $('#EditLocation').hide();
       } else{
           $('#DeleteLocation').show();
           $('#EditLocation').show();
       }
   });

    $.post('/locations/get_location_containers/', {'loc_id': LocationID}, function(response){
        console.log(response);
        ContainerJSTree.jstree(true).settings.core.data = response['data'];
        ContainerJSTree.jstree(true).refresh();
    });
});

function LoadContainerJSTree(){
    $.post('/locations/get_location_containers/', {'loc_id': LocationID}, function(response){
        console.log('Containers Loaded!!!!!');
        ContainerJSTree.jstree(true).settings.core.data = response['data'];
        ContainerJSTree.jstree(true).refresh();
    });
}

// Load settings for a selected container
ContainerJSTree.on('select_node.jstree', function(event, data){
    document.getElementById('Location-Info-Panel').style.display = 'none';
    document.getElementById('Container-Info-Panel').style.display = 'inline-block';
    document.getElementById('Container-Info-Panel').style.visibility = 'visible';
    ContainerID = data['node']['data']['id'];
    $.post('/locations/get_container_info/', {'container_id': ContainerID}, function(response){
       // Update Container-Info-Panel
       ContainerName = response['Name'];
       ContainerDescription = response['Description'];
       document.getElementById('CurrentContainerHeader').textContent = ContainerName;
       document.getElementById('CurrentContainerOwner').textContent = response['Owner'];
       document.getElementById('CurrentContainerDescription').textContent = ContainerDescription;

       // Only show delete button if user made attribute
       if(response['CreatorID'] !== CurrentUserID){
           $('#DeleteContainer').hide();
           $('#EditContainer').hide();
       } else{
           $('#DeleteContainer').show();
           $('#EditContainer').show();
       }
   });
});

// Add New Container to Location
$('#AddNewContainer').on('click', function(event){
    if (LocationID !== undefined){
        console.log(LocationID);
        $( "#AddContainerForm" ).dialog(AddContainerDialogInit(event['target']['id'])).dialog("open");
    }
});

// Container Dialog initialization
function AddContainerDialogInit(source) {
    let CurrentParentNode = LocationID;

    return {
        autoOpen: false,
        buttons: [{
            text: "Add Container to " + LocationName,
            click: function () {
                // Get input values
                const NewContainerName = $('#NewContainerName').val();
                const NewContainerDescription = $('#NewContainerDescription').val();
                const NewContainerRows = $('#NewContainerRows').val();
                const NewContainerColumns = $('#NewContainerColumns').val();
                const data = {
                    'container_name': NewContainerName,
                    'container_description': NewContainerDescription,
                    'container_rows': NewContainerRows,
                    'container_columns': NewContainerColumns,
                    'parent_node': CurrentParentNode
                };

                // POST to Database
                $.post('/locations/add_container_to_db/', data, function (response) {
                    const database_success = response['success'];
                    if (database_success) {
                        $(".ui-dialog-content").dialog("close");
                    } else {
                        const ErrorMessage = document.createElement('p');
                        ErrorMessage.id = 'AddContainerError';
                        ErrorMessage.textContent = response['Error'];
                        ErrorMessage.style.color = '#eb093c';
                        document.getElementById('AddContainerForm').appendChild(ErrorMessage);
                    }
                });
            },
            id: 'SubmitNewContainer',
        }],
        title: "Add New Container to " + LocationName,
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            LoadLocationJSTree();
            // Clear forms and errors
            document.getElementById("NewContainerName").value = null;
            document.getElementById("NewContainerDescription").value = null;
            const ErrorMessage = document.getElementById("AddContainerError");
            if (ErrorMessage) {
                ErrorMessage.remove();
            }
        },
    };
}

// Edit Container
$('#EditContainer').on('click', function(){
    document.getElementById('CurrentContainerHeader').contentEditable = "true";
    document.getElementById('CurrentContainerHeader').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('CurrentContainerHeader').style.borderBottom = 'solid 2px #052049';

    document.getElementById('CurrentContainerDescription').contentEditable = "true";
    document.getElementById('CurrentContainerDescription').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('CurrentContainerDescription').style.borderBottom = 'solid 2px #052049';

    document.getElementById('EditContainer').style.display = "none";
    document.getElementById('EditContainerCancel').style.display = "inline-block";
    document.getElementById('EditContainerSave').style.display = "inline-block";
});

$('#DisplayContainerInformation').on('valuechange input', function(){
    const InputName = $('#CurrentContainerHeader').val();
    const InputDescription = $('#CurrentContainerDescription').val();
    if (InputName !== ContainerName && InputDescription !== ContainerDescription){
        document.getElementById('EditContainerSave').style.display = "inline-block";
    }
});

function CloseContainerEditing(){
    document.getElementById('CurrentContainerHeader').contentEditable = "false";
    document.getElementById('CurrentContainerHeader').style.backgroundColor = null;
    document.getElementById('CurrentContainerHeader').style.borderBottom = null;

    document.getElementById('CurrentContainerDescription').contentEditable = "false";
    document.getElementById('CurrentContainerDescription').style.backgroundColor = null;
    document.getElementById('CurrentContainerDescription').style.borderBottom = null;

    document.getElementById('EditContainer').style.display = "inline-block";
    document.getElementById('EditContainerCancel').style.display = "none";
    document.getElementById('EditContainerSave').style.display = "none";
    document.getElementById('ContainerEditErrors').textContent = null;
    document.getElementById('ContainerEditErrors').style.display = "none";
}

$('#EditContainerCancel').on('click', function(){
    document.getElementById('CurrentContainerHeader').textContent = ContainerName;
    document.getElementById('CurrentContainerDescription').textContent = ContainerDescription;
    CloseContainerEditing();
});

$('#EditContainerSave').on('click', function(){
    const NewLocName = $('#CurrentContainerHeader').text();
    const NewLocDescription = $('#CurrentContainerDescription').text();
    const data = {'new_name': NewLocName, 'new_description': NewLocDescription, 'container_id': ContainerID, 'modification': 'edit'};
    console.log(data);
    $.post('/locations/modify_container/', data, function(response){
        if(response['Success'] === true){
            LoadContainerJSTree();
            CloseContainerEditing();
        } else {
            $('#ContainerEditErrors').text(response['Error']);
        }
    })
});

// Delete Container
$('#DeleteContainer').on('click', function(){
    $('#ContainerDeletionWarning').text('Are you sure you want to delete ' + ContainerName + '?');
    $('#DeleteContainerForm').dialog({
        autoOpen: false,
        buttons: [{
            text: "Delete Container",
            id: "ContainerDeleteConfirmation",
            click: function(){
                $.post('/locations/modify_container/', {'container_id': ContainerID, 'modification': 'delete'}, function(response){
                    if(response['Success']){
                        LoadContainerJSTree();
                        $(".ui-dialog-content").dialog("close");
                    }
                    else{
                        const ErrorMessage = document.createElement('p');
                        ErrorMessage.id = 'DeleteContainerError';
                        ErrorMessage.textContent = response['Error'];
                        ErrorMessage.style.color = '#eb093c';
                        document.getElementById('DeleteContainerForm').appendChild(ErrorMessage);
                    }
                });
            },
        },
        {
           text: "Oops, Nevermind...",
           click: function(){
               $(".ui-dialog-content").dialog("close");
           }
        }],
        title: "Delete Container",
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            LoadContainerJSTree();
            document.getElementById('Container-Info-Panel').style.visibility = 'hidden';
            // Clear forms and errors
            const ErrorMessage = document.getElementById("DeleteContainerError");
            if (ErrorMessage) {
                ErrorMessage.remove();
            }
        },
   }).dialog("open");
});

//========================
// Location Functions
//=========================

function LoadLocationjsTree(){
    $.post('/locations/get_location_tree/', function(response){
        console.log('Locations Loaded!!!!!');
        LocationJSTree.jstree(true).settings.core.data = response['data'];
        LocationJSTree.jstree(true).refresh();
    });
}

// Location Dialog initialization
function AddLocationDialogInit(source) {
    let CurrentParentNode;
    if(source === 'AddNewLocation'){
        CurrentParentNode = null;
    } else {CurrentParentNode = LocationID;}

    return {
        autoOpen: false,
        buttons: [{
            text: "Add Location",
            click: function () {
                // Get input values
                const NewLocationName = $('#NewLocationName').val();
                const NewLocationDescription = $('#NewLocationDescription').val();
                const data = {
                    'location_name': NewLocationName,
                    'location_description': NewLocationDescription,
                    'parent_node': CurrentParentNode
                };

                // POST to Database
                $.post('/locations/add_location_to_db/', data, function (response) {
                    const database_success = response['success'];
                    if (database_success) {
                        $(".ui-dialog-content").dialog("close");
                    } else {
                        const ErrorMessage = document.createElement('p');
                        ErrorMessage.id = 'AddLocationError';
                        ErrorMessage.textContent = response['Error'];
                        ErrorMessage.style.color = '#eb093c';
                        document.getElementById('AddLocationForm').appendChild(ErrorMessage);
                    }
                });
            },
            id: 'SubmitNewLocation',
        }],
        title: "New Location Definition",
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            LoadLocationjsTree();
            // Clear forms and errors
            document.getElementById("NewLocationName").value = null;
            document.getElementById("NewLocationDescription").value = null;
            const ErrorMessage = document.getElementById("AddLocationError");
            if (ErrorMessage) {
                ErrorMessage.remove();
            }
        },
    };
}

// Add Root Location
$('#AddNewLocation').on('click', function(event){
    $( "#AddLocationForm" ).dialog(AddLocationDialogInit(event['target']['id'])).dialog("open");
});

// Add Child Location
$('#AddNewChildLocation').on('click', function(event){
    $( "#AddLocationForm" ).dialog(AddLocationDialogInit(event['target']['id'])).dialog("open");
});

// Edit Location
$('#EditLocation').on('click', function(){
    document.getElementById('CurrentLocationHeader').contentEditable = "true";
    document.getElementById('CurrentLocationHeader').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('CurrentLocationHeader').style.borderBottom = 'solid 2px #052049';

    document.getElementById('CurrentLocationDescription').contentEditable = "true";
    document.getElementById('CurrentLocationDescription').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('CurrentLocationDescription').style.borderBottom = 'solid 2px #052049';

    document.getElementById('EditLocation').style.display = "none";
    document.getElementById('EditLocationCancel').style.display = "inline-block";
    document.getElementById('EditLocationSave').style.display = "inline-block";
});

$('#DisplayLocationInformation').on('valuechange input', function(){
    const InputName = $('#CurrentLocationHeader').val();
    const InputDescription = $('#CurrentLocationDescription').val();
    if (InputName !== LocationName && InputDescription !== LocationDescription){
        document.getElementById('EditLocationSave').style.display = "inline-block";
    }
});

function CloseLocationEditing(){
    document.getElementById('CurrentLocationHeader').contentEditable = "false";
    document.getElementById('CurrentLocationHeader').style.backgroundColor = null;
    document.getElementById('CurrentLocationHeader').style.borderBottom = null;

    document.getElementById('CurrentLocationDescription').contentEditable = "false";
    document.getElementById('CurrentLocationDescription').style.backgroundColor = null;
    document.getElementById('CurrentLocationDescription').style.borderBottom = null;

    document.getElementById('EditLocation').style.display = "inline-block";
    document.getElementById('EditLocationCancel').style.display = "none";
    document.getElementById('EditLocationSave').style.display = "none";
    document.getElementById('LocationEditErrors').textContent = null;
    document.getElementById('LocationEditErrors').style.display = "none";
}

$('#EditLocationCancel').on('click', function(){
    document.getElementById('CurrentLocationHeader').textContent = LocationName;
    document.getElementById('CurrentLocationDescription').textContent = LocationDescription;
    CloseLocationEditing();
});

$('#EditLocationSave').on('click', function(){
    const NewLocName = $('#CurrentLocationHeader').text();
    const NewLocDescription = $('#CurrentLocationDescription').text();
    const data = {'new_name': NewLocName, 'new_description': NewLocDescription, 'location_id': LocationID, 'modification': 'edit'};
    console.log(data);
    $.post('/locations/modify_location/', data, function(response){
        if(response['Success'] === true){
            LoadLocationjsTree();
            CloseLocationEditing();
        } else {
            $('#LocationEditErrors').text(response['Error']);
        }
    })
});

// Delete Location
$('#DeleteLocation').on('click', function(){
    $('#LocationDeletionWarning').text('Are you sure you want to delete ' + LocationName + '?');
    $('#DeleteLocationForm').dialog({
        autoOpen: false,
        buttons: [{
            text: "Delete Location",
            id: "LocationDeleteConfirmation",
            click: function(){
                $.post('/locations/modify_location/', {'location_id': LocationID, 'modification': 'delete'}, function(response){
                    if(response['Success']){
                        LoadLocationjsTree();
                        $(".ui-dialog-content").dialog("close");
                    }
                    else{
                        const ErrorMessage = document.createElement('p');
                        ErrorMessage.id = 'DeleteLocationError';
                        ErrorMessage.textContent = response['Error'];
                        ErrorMessage.style.color = '#eb093c';
                        document.getElementById('DeleteLocationForm').appendChild(ErrorMessage);
                    }
                });
            },
        },
        {
           text: "Oops, Nevermind...",
           click: function(){
               $(".ui-dialog-content").dialog("close");
           }
        }],
        title: "Delete Location",
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            LoadLocationjsTree();
            document.getElementById('Location-Info-Panel').style.visibility = 'hidden';
            // Clear forms and errors
            const ErrorMessage = document.getElementById("DeleteLocationError");
            if (ErrorMessage) {
                ErrorMessage.remove();
            }
        },
   }).dialog("open");
});

// Disable submit button by default
$("#SubmitNewLocation").button("disable");

$('#NewLocationName').on('valuechange input', function(){
    // Remove dialog error message if name input changes
    const ErrorMessage = document.getElementById("AddLocationError");
    if(ErrorMessage){
        ErrorMessage.remove();
    }
    // Only enable submit button when a name is entered
    if(!$(this).val()){
        $("#SubmitNewLocation").button("disable");
    } else{
        $("#SubmitNewLocation").button("enable");
    }
});
