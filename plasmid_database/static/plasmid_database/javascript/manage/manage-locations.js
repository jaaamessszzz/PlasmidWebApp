// ######################
// #   Location Menu    #
// ######################
// All of this is literally just copy/pasted from above with replaced location variable names... EZ

// Load Menu
$(document).ready(function(){
    $.post('/database/get_location_tree/', function(response){
        console.log('Locations Loaded!!!!!');
        $('#DragnDropLoc-TreeJS').jstree({
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
    });
});

function LoadLocationjsTree(){
    $.post('/database/get_location_tree/', function(response){
        console.log('Locations Loaded!!!!!');
        LocationJSTree.jstree(true).settings.core.data = response['data'];
        LocationJSTree.jstree(true).refresh();
    });
}

const LocationJSTree = $('#DragnDropLoc-TreeJS');
let LocationID;
let LocationName;
let LocationDescription;

// Get Node Locations on Click and Load into Location-Info-Panel
LocationJSTree.on('select_node.jstree', function(event, data){
   CloseLocationEditing();
   document.getElementById('Location-Info-Panel').style.visibility = 'visible';
   LocationID = data['node']['data']['id'];

   $.post('/database/get_location_info/', {'loc_id': LocationID}, function(response){
       // Update Location-Info-Panel
       LocationName = response['Name'];
       LocationDescription = response['Description'];
       document.getElementById('CurrentLocationHeader').textContent = LocationName;
       document.getElementById('CurrentLocationCreator').textContent = response['Creator'];
       document.getElementById('CurrentLocationDescription').textContent = LocationDescription;
       document.getElementById('CurrentLocationChildren').textContent = response['Children'];

       // Only show delete button if user made location
       if(response['CreatorID'] !== CurrentUserID){
           $('#DeleteLocation').hide();
           $('#EditLocation').hide();
       } else{
           $('#DeleteLocation').show();
           $('#EditLocation').show();
       }
   });
});

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
                $.post('/database/add_location_to_db/', data, function (response) {
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
    $.post('/database/modify_location/', data, function(response){
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
                $.post('/database/modify_location/', {'location_id': LocationID, 'modification': 'delete'}, function(response){
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
