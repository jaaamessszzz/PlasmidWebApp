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