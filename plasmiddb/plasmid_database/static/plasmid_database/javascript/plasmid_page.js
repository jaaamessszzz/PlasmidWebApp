$(document).ready(function(){
    if (plasmidCreator === CurrentUserID){
        console.log(CurrentUserID);
        document.getElementById('EditPlasmid').style.display = 'inline-block';
    }

    const postData = {'plasmidPK': plasmidPK};

    $.post('/database/get_snapgene_stuff/', postData, function(response){
        document.getElementById('snapgene').innerHTML = response['svg_html'];
        $('.sg-tooltips-collection').remove()
        document.getElementById('snapgene_seqJSstatic').innerHTML = response['seqJSstatic'];
        document.getElementById('snapgene_seqJSdynamic').innerHTML = response['seqJSdynamic'];
        document.getElementById('snapgene_seqCSS').innerHTML = response['seqCSS'];
        document.getElementById('snapgene_seq').innerHTML = response['seq_html'];

        document.getElementById('sgPlasmidMap').style.display = 'inline-block';
        document.getElementById('sgPlasmidSequence').style.display = 'inline-block';
    });
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

    // [X] for each listed alias, input for new aliases
    const aliasListItems = document.querySelectorAll('.PlasmidAlias');
    aliasListItems.forEach(function(item){
       item.innerHTML = "<button class=\"deleteAlias\" type=\"button\" style=\"background-color: #eb093c;\">" +
           "<i class=\"fas fa-minus-circle\"></i></button>" + item.innerHTML;
    });
    document.getElementById('addAliasInput').style.display = 'inline-block';

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

    const data = {
        'locationPKs': locationPKs,
        'attributePKs': attributePKs,
        'newDescription': newDescription,
        'plasmidPK': plasmidPK,
    };

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
    });
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
    // Remove deleteAlias buttons and hide newAlias input
    document.getElementById('addAliasInput').style.display = 'none';
    document.getElementById('newAliasInput').value = '';
    const aliasListItems = document.querySelectorAll('.deleteAlias');
    aliasListItems.forEach(function(item){
        item.remove();
    });
}

// Listen for addAlias
$('#newAliasAdd').on('click', function(){
    const newAliasInput = document.getElementById('newAliasInput');
    const newAliasInputValue = newAliasInput.value;
    if (newAliasInputValue.replace(/\s/g, '').length){
        let data = {'plasmid': plasmidPK, 'alias': newAliasInputValue, 'action': 'add'}
        $.post('/database/update_alias/', data, function(response){
            if(response['Success'] === true) {
                // Clear input box
                newAliasInput.value = '';
                // Add list item row with [X]
                const newAliasItem = document.createElement('li');
                newAliasItem.className = 'PlasmidValue PlasmidAlias';
                newAliasItem.innerText = newAliasInputValue;
                newAliasItem.innerHTML = "<button class=\"deleteAlias\" type=\"button\" style=\"background-color: #eb093c;\">" +
                    "<i class=\"fas fa-minus-circle\"></i></button>" + newAliasItem.innerHTML;
                const innerAliasDump = document.getElementById('innerAliasDump');
                innerAliasDump.prepend(newAliasItem)
            }
        });
    }
});

// Listen for deleteAlias
$('#innerAliasDump').on('click', '.deleteAlias', function(element){
    console.log(element);
    const aliasListItem = element.currentTarget.parentNode;
    console.log(aliasListItem);
    const aliasToDelete = aliasListItem.innerText;
    let data = {'plasmid': plasmidPK, 'alias': aliasToDelete, 'action': 'delete'}
    $.post('/database/update_alias/', data, function(response){
        if(response['Success'] === true) {
            console.log('asdfd');
            aliasListItem.remove();
        } else {
            console.log(response['Error']);
        }
    });
});