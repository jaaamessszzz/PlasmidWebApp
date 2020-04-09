$(document).ready(function(){
    if (plasmidCreator === CurrentUserID){
        console.log(CurrentUserID);
        document.getElementById('EditPlasmid').style.display = 'inline-block';
    }
});

let locationJSTree = $('#DragnDropLoc-TreeJS');
let attributeJSTree = $('#DragnDropAttr-TreeJS');

$('#EditPlasmid').on('click', function () {
    // Load and show location tree
    $.post('/database/get_location_tree/', function(response){
        console.log('Locations Loaded!!!!!');
        console.log(plasmidLocations);

        locationJSTree.jstree({
            "core": {
                "data": response['data'],
                'themes': {
                    'name': 'proton',
                    'responsive': true,
                },
                "multiple": true,
                "check_callback" : true,
            },
            "plugins" : [ "sort", "checkbox"],
        }).bind("ready.jstree", function (event, data) {
             $(this).jstree("select_node", plasmidLocations);
        });
    });
    document.getElementById('ulLocations').style.display = 'none';
    document.getElementById('DragnDropLoc-TreeJS').style.display = 'inline-block';

    // Load and show attribute tree
    $.post('/database/get_attribute_tree/', function(response){
        console.log('Attributes Loaded!!!!!');
        console.log(plasmidAttributes);

        attributeJSTree.jstree({
            "core": {
                "data": response['data'],
                'themes': {
                    'name': 'proton',
                    'responsive': true,
                },
                "multiple": true,
                "check_callback" : true,
            },
            "plugins" : [ "sort", "checkbox"],
        }).bind("ready.jstree", function (event, data) {
             $(this).jstree("select_node", plasmidAttributes);
        });
    });
    document.getElementById('ulAttributes').style.display = 'none';
    document.getElementById('DragnDropAttr-TreeJS').style.display = 'inline-block';

    // Make description editable
    document.getElementById('PlasmidDescription').contentEditable = "true";
    document.getElementById('PlasmidDescription').style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
    document.getElementById('PlasmidDescription').style.borderBottom = 'solid 2px #052049';

    // Show cancel and save buttons
    document.getElementById('EditPlasmid').style.display = 'none';
    document.getElementById('SavePlasmid').style.display = 'inline-block';
    document.getElementById('CancelEdits').style.display = 'inline-block';
});

// Save Edits
$('#SavePlasmid').on('click', function(){

    let newLocations = locationJSTree.jstree("get_selected",true);
    let newAttributes = attributeJSTree.jstree("get_selected",true);

    let locationPKs = newLocations.map(x => x['data']['id']);
    let attributePKs = newAttributes.map(x => x['data']['id']);
    let newDescription = document.getElementById('PlasmidDescription').textContent;

    console.log(locationPKs);
    console.log(attributePKs);
    console.log(newDescription);

    const data = {
        'locationPKs': locationPKs,
        'attributePKs': attributePKs,
        'newDescription': newDescription,
        'plasmidPK': plasmidPK,
    };

    console.log(data);
    $.post('/database/update_plasmid/', data, function(response){
        if(response['Success'] === true){
            // Update Plasmid Locations/Attributes/Description
            let plasmidLocations = document.getElementById('ulLocations');
            plasmidLocations.innerHTML = '';
            response['newLocations'].forEach(function (element) {
                let newLocation = document.createElement('li');
                newLocation.textContent = element;
                newLocation.className = 'PlasmidValue';
                plasmidLocations.appendChild(newLocation);
            });
            plasmidLocations.style.display = 'inline-block';
            let plasmidAttributes = document.getElementById('ulAttributes');
            plasmidAttributes.innerHTML = '';
            response['newAttributes'].forEach(function (element) {
                let newAttribute = document.createElement('li');
                newAttribute.textContent = element;
                newAttribute.className = 'PlasmidValue';
                plasmidAttributes.appendChild(newAttribute);
            });
            plasmidAttributes.style.display = 'inline-block';
            let plasmidDescriptionDiv = document.getElementById('PlasmidDescription');
            plasmidDescriptionDiv.textContent = response['newDescription'];

            // Close Editing
            closeEditing();

        } else {
            let plasmidErrors = document.getElementById('PlasmidEditErrors');
            plasmidErrors.innerHTML = '';
            response['Error'].forEach(function(item){
                let errorItem = document.createElement('li');
                errorItem.textContent = item;
                errorItem.className = 'PlasmidValue';
                plasmidErrors.appendChild(errorItem);
            });
        }
    })
});

// Cancel Edits
$('#CancelEdits').on('click', function(){
    let plasmidDescriptionDiv = document.getElementById('PlasmidDescription');
    document.getElementById('ulLocations').style.display = 'inline-block';
    document.getElementById('ulAttributes').style.display = 'inline-block';

    plasmidDescriptionDiv.textContent = plasmidDescription;
    closeEditing();
});

function closeEditing(){
    document.getElementById('SavePlasmid').style.display = 'none';
    document.getElementById('CancelEdits').style.display = 'none';
    document.getElementById('EditPlasmid').style.display = 'inline-block';
    document.getElementById('PlasmidDescription').contentEditable = "false";
    document.getElementById('PlasmidDescription').style.backgroundColor = null;
    document.getElementById('PlasmidDescription').style.borderBottom = null;
    document.getElementById('DragnDropAttr-TreeJS').style.display = 'none';
    document.getElementById('DragnDropLoc-TreeJS').style.display = 'none';
}