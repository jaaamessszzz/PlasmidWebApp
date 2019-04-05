// #######################
// #   Attribute Menu    #
// #######################

// Load Menu
$(document).ready(function(){
    $.post('/database/get_attribute_tree/', function(response){
        console.log('Attributes Loaded!!!!!');
        $('#DragnDropAttr-TreeJS').jstree({
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

function LoadAttributejsTree(){
    $.post('/database/get_attribute_tree/', function(response){
        console.log('Attributes Loaded!!!!!');
        AttributeJSTree.jstree(true).settings.core.data = response['data'];
        AttributeJSTree.jstree(true).refresh();
    });
}

const AttributeJSTree = $('#DragnDropAttr-TreeJS');
let AttributeID;
let AttributeName;
let AttributeDescription;

// Get Node Attributes on Click and Load into Attribute-Info-Panel
AttributeJSTree.on('select_node.jstree', function(event, data){
   CloseAttributeEditing();
   document.getElementById('Attribute-Info-Panel').style.visibility = 'visible';
   AttributeID = data['node']['data']['id'];

   $.post('/database/get_attribute_info/', {'attr_id': AttributeID}, function(response){
       // Update Attribute-Info-Panel
       AttributeName = response['Name'];
       AttributeDescription = response['Description'];
       document.getElementById('CurrentAttributeHeader').textContent = AttributeName;
       document.getElementById('CurrentAttributeCreator').textContent = response['Creator'];
       document.getElementById('CurrentAttributeDescription').textContent = AttributeDescription;
       document.getElementById('CurrentAttributeChildren').textContent = response['Children'];

       // Only show delete button if user made attribute
       if(response['CreatorID'] !== CurrentUserID){
           $('#DeleteAttribute').hide();
           $('#EditAttribute').hide();
       } else{
           $('#DeleteAttribute').show();
           $('#EditAttribute').show();
       }
   });
});

// Attribute Dialog initialization
function AddAttributeDialogInit(source) {
    let CurrentParentNode;
    if(source === 'AddNewAttribute'){
        CurrentParentNode = null;
    } else {CurrentParentNode = AttributeID;}

    return {
        autoOpen: false,
        buttons: [{
            text: "Add Attribute",
            click: function () {
                // Get input values
                const NewAttributeName = $('#NewAttributeName').val();
                const NewAttributeDescription = $('#NewAttributeDescription').val();
                const data = {
                    'attribute_name': NewAttributeName,
                    'attribute_description': NewAttributeDescription,
                    'parent_node': CurrentParentNode
                };

                // POST to Database
                $.post('/database/add_attribute_to_db/', data, function (response) {
                    const database_success = response['success'];
                    if (database_success) {
                        $(".ui-dialog-content").dialog("close");
                    } else {
                        const ErrorMessage = document.createElement('p');
                        ErrorMessage.id = 'AddAttributeError';
                        ErrorMessage.textContent = response['Error'];
                        ErrorMessage.style.color = '#eb093c';
                        document.getElementById('AddAttributeForm').appendChild(ErrorMessage);
                    }
                });
            },
            id: 'SubmitNewAttribute',
        }],
        title: "New Attribute Definition",
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            LoadAttributejsTree();
            // Clear forms and errors
            document.getElementById("NewAttributeName").value = null;
            document.getElementById("NewAttributeDescription").value = null;
            const ErrorMessage = document.getElementById("AddAttributeError");
            if (ErrorMessage) {
                ErrorMessage.remove();
            }
        },
    };
}

// Add Root Attribute
$('#AddNewAttribute').on('click', function(event){
    $( "#AddAttributeForm" ).dialog(AddAttributeDialogInit(event['target']['id'])).dialog("open");
});

// Add Child Attribute
$('#AddNewChildAttribute').on('click', function(event){
    $( "#AddAttributeForm" ).dialog(AddAttributeDialogInit(event['target']['id'])).dialog("open");
});

// Edit Attribute
$('#EditAttribute').on('click', function(){
    document.getElementById('CurrentAttributeHeader').contentEditable = "true";
    document.getElementById('CurrentAttributeHeader').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('CurrentAttributeHeader').style.borderBottom = 'solid 2px #052049';

    document.getElementById('CurrentAttributeDescription').contentEditable = "true";
    document.getElementById('CurrentAttributeDescription').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('CurrentAttributeDescription').style.borderBottom = 'solid 2px #052049';

    document.getElementById('EditAttribute').style.display = "none";
    document.getElementById('EditAttributeCancel').style.display = "inline-block";
    document.getElementById('EditAttributeSave').style.display = "inline-block";
});

$('#DisplayAttributeInformation').on('valuechange input', function(){
    const InputName = $('#CurrentAttributeHeader').val();
    const InputDescription = $('#CurrentAttributeDescription').val();
    if (InputName !== AttributeName && InputDescription !== AttributeDescription){
        document.getElementById('EditAttributeSave').style.display = "inline-block";
    }
});

function CloseAttributeEditing(){
    document.getElementById('CurrentAttributeHeader').contentEditable = "false";
    document.getElementById('CurrentAttributeHeader').style.backgroundColor = null;
    document.getElementById('CurrentAttributeHeader').style.borderBottom = null;

    document.getElementById('CurrentAttributeDescription').contentEditable = "false";
    document.getElementById('CurrentAttributeDescription').style.backgroundColor = null;
    document.getElementById('CurrentAttributeDescription').style.borderBottom = null;
    
    document.getElementById('EditAttribute').style.display = "inline-block";
    document.getElementById('EditAttributeCancel').style.display = "none";
    document.getElementById('EditAttributeSave').style.display = "none";
    document.getElementById('AttributeEditErrors').textContent = null;
    document.getElementById('AttributeEditErrors').style.display = "none";
}

$('#EditAttributeCancel').on('click', function(){
    document.getElementById('CurrentAttributeHeader').textContent = AttributeName;
    document.getElementById('CurrentAttributeDescription').textContent = AttributeDescription;
    CloseAttributeEditing();
});

$('#EditAttributeSave').on('click', function(){
    const NewAttrName = $('#CurrentAttributeHeader').text();
    const NewAttrDescription = $('#CurrentAttributeDescription').text();
    const data = {'new_name': NewAttrName, 'new_description': NewAttrDescription, 'attribute_id': AttributeID, 'modification': 'edit'};
    console.log(data);
    $.post('/database/modify_attribute/', data, function(response){
        if(response['Success'] === true){
            LoadAttributejsTree();
            CloseAttributeEditing()
        } else {
            $('#AttributeEditErrors').text(response['Error']);
        }
    })
});

// Delete Attribute
$('#DeleteAttribute').on('click', function(){
    $('#AttributeDeletionWarning').text('Are you sure you want to delete ' + AttributeName + '?');
    $('#DeleteAttributeForm').dialog({
        autoOpen: false,
        buttons: [{
            text: "Delete Attribute",
            id: "AttributeDeleteConfirmation",
            click: function(){
                $.post('/database/modify_attribute/', {'attribute_id': AttributeID, 'modification': 'delete'}, function(response){
                    if(response['Success']){
                        $(".ui-dialog-content").dialog("close");
                    }
                    else{
                        const ErrorMessage = document.createElement('p');
                        ErrorMessage.id = 'DeleteAttributeError';
                        ErrorMessage.textContent = response['Error'];
                        ErrorMessage.style.color = '#eb093c';
                        document.getElementById('DeleteAttributeForm').appendChild(ErrorMessage);
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
        title: "Delete Attribute",
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            LoadAttributejsTree();
            // Clear forms and errors
            const ErrorMessage = document.getElementById("DeleteAttributeError");
            if (ErrorMessage) {
                ErrorMessage.remove();
            }
        },
   }).dialog("open");
});

// Disable submit button by default
$("#SubmitNewAttribute").button("disable");

$('#NewAttributeName').on('valuechange input', function(){
    // Remove dialog error message if name input changes
    const ErrorMessage = document.getElementById("AddAttributeError");
    if(ErrorMessage){
        ErrorMessage.remove();
    }
    // Only enable submit button when a name is entered
    if(!$(this).val()){
        $("#SubmitNewAttribute").button("disable");
    } else{
        $("#SubmitNewAttribute").button("enable");
    }
});

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

// ######################
// #   Feature Table    #
// ######################

$('#FeatureDataTable').DataTable({

});