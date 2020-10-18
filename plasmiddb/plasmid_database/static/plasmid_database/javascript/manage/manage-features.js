// #######################
// #   Feature Tables    #
// #######################

let featureDatatable = $('#FeatureDataTable').DataTable({
    "dom": "irpt",
    "ajax": '/database/update_feature_table/',
    "processing": true,
    "serverSide": true,
    "deferRender": true,
    "orderCellsTop": true,
    "order": [[ 1, "asc" ]],
    "autoWidth": false,
    "columns": [
        null,
        { "width": "15%" },
        { "width": "30%" },
        { "width": "35%" },
        { "width": "10%" },
        { "width": "10%" },
    ],
    "columnDefs": [
        { name: 'id', targets: 0, visible: false },
        { name: 'name', targets: 1 },
        { name: 'description', targets: 2,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + row[2] + "</div>";
                    },
        },
        { name: 'sequence', targets: 3,
            orderable: false,
            searchable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: break-all;'>" + row[3] + "</div>";
                    },
        },
        { name: 'type', targets: 4,},
        { name: 'creator', targets: 5,},
    ],
    "drawCallback": function( settings ) {
        this.api().columns.adjust();
    },
    "initComplete": function () {
        const table = this;
        $('.filterFeaturesRow').on( "input paste ValueChange", 'input, select', function () {
            const CurrentColumnName = this.name;
            const currentColumn = table.api().column(this.name + ':name');
            console.log(CurrentColumnName);

            let searchJQO;
            if ($(this).nodeName === 'SELECT'){

                if (CurrentColumnName === 'type'){
                    searchJQO = $('#id_FeatureType option:selected')
                }else{
                    if(CurrentColumnName === 'creator'){
                        searchJQO = $('#id_FeatureCreator option:selected');
                    } else{
                        searchJQO = $(this);
                    }
                }
            } else{
                searchJQO = $(this);
            }
            // const inputValue = $.fn.dataTable.util.escapeRegex(searchJQO.val());
            const inputValue = searchJQO.val();
            console.log(currentColumn);
            console.log(inputValue);
            currentColumn.search( inputValue, false, false ).draw();
        });
    }
});

// --- Edit existing Features --- //

// Select existing features and populate form
featureDatatable.on( 'click', 'tr', function () {
    // Highlight a single row
    Array.from(this.parentNode.children).forEach(function(row){
        row.classList.remove('selected');
    });
    $(this).toggleClass('selected');
    // Populate feature form
    const selectedRowData = featureDatatable.row(this).data();
    selectedFeatureID = selectedRowData[0];
    selectedFeatureType = selectedRowData[4];
    selectedFeatureName = selectedRowData[1];
    selectedFeatureDescription = selectedRowData[2];
    selectedFeatureSequence = selectedRowData[3];
    document.getElementById('selectedID').innerText = selectedFeatureID;
    document.getElementById('selectedType').innerText = selectedFeatureType;
    document.getElementById('selectedName').innerText = selectedFeatureName;
    document.getElementById('selectedDescription').innerText = selectedFeatureDescription;
    document.getElementById('selectedSequence').innerText = selectedFeatureSequence;
    // Show or hide buttons depending on feature creator
    // Using username here because it's easier to get, validate for real serverside
    if (selectedRowData[5] === CurrentUsername){
        $('#editForm').show();
        $('#deleteForm').show();
        $('#saveForm').hide();
        $('#cancelForm').hide();
    } else{
        $('#editForm').hide();
        $('#deleteForm').hide();
        $('#saveForm').hide();
        $('#cancelForm').hide();
    }
});

function editFeature(){
    // Set feature type to dropdown, have to loop through since I don't have the featuretype ID...
    let featureTypeDropdown = document.getElementById('featureTypeDD');
    for (let i = 0; i < featureTypeDropdown.options.length; i++) {
        if (featureTypeDropdown.options[i].text === selectedFeatureType) {
            featureTypeDropdown.options[i].selected = true;
            break;
        }
    }
    document.getElementById('featureTypeDropdown').style.display = 'inline-block';
    document.getElementById('selectedType').style.display = 'none';

    // Set Name, Description, Sequence to Editable blocks
    ['selectedName', 'selectedDescription', 'selectedSequence'].forEach(function(selected){
        document.getElementById(selected).contentEditable = "true";
        document.getElementById(selected).style.backgroundColor = 'rgba(0, 124, 190, 0.4)';
        document.getElementById(selected).style.borderBottom = 'solid 2px #052049';
    });

    // Show cancel and save buttons, remove edit button
    $('#editForm').hide();
    $('#saveForm').show();
    $('#cancelForm').show();
}

function cancelFeature(){
    // Reset Type
    document.getElementById('featureTypeDropdown').style.display = 'none';
    document.getElementById('selectedType').style.display = 'inline-block';

    // Set Name, Description, Sequence to Defaults
    ['selectedName', 'selectedDescription', 'selectedSequence'].forEach(function(selected){
        document.getElementById(selected).contentEditable = "false";
        document.getElementById(selected).style.backgroundColor = null;
        document.getElementById(selected).style.borderBottom = null;
    });
    // Show Editable, hide save and cancel
    $('#editForm').show();
    $('#saveForm').hide();
    $('#cancelForm').hide();
    // Reset display values to original
    document.getElementById('selectedID').innerText = selectedFeatureID;
    document.getElementById('selectedType').innerText = selectedFeatureType;
    document.getElementById('selectedName').innerText = selectedFeatureName;
    document.getElementById('selectedDescription').innerText = selectedFeatureDescription;
    document.getElementById('selectedSequence').innerText = selectedFeatureSequence;
}

function validateFeature(data){
    let validation = {'passed': false, 'errors': []};
    if (data['newName'].trim() === ''){validation['errors'].push('Feature name required!');}
    const SequenceRegex = new RegExp('^[ATCGatcg\.]+$')
    if (!SequenceRegex.test(data['newSequence'])){validation['errors'].push('Only ATCG and "." allowed in sequence!');}
    if (validation['errors'].length === 0){validation['passed'] = true;}
    return validation;
}

function saveFeature(){
    // Post
    const data = {
        'action': 'update',
        'featureID': selectedFeatureID,
        'newType': document.getElementById('featureTypeDD').value,
        'newName': document.getElementById('selectedName').innerText,
        'newDescription': document.getElementById('selectedDescription').innerText,
        'newSequence': document.getElementById('selectedSequence').innerText,
    };
    console.log(data);
    const validation = validateFeature(data);

    if (validation['passed']){
        $.post('/database/update_feature/', data, function(response){
            if(response['Success'] === true){
                // Update Feature Specs
                selectedFeatureType = response['newType'];
                selectedFeatureName = response['newName'];
                selectedFeatureDescription = response['newDescription'];
                selectedFeatureSequence = response['newSequence'];
                // Notify User
                document.getElementById('selectedFeatureAlerts').innerHTML = '<p>Feature Updated!</p>';
                // Redraw table
                featureDatatable.draw();
                // Close Editing
                cancelFeature();
            } else {
                let featureErrorsList = document.createElement('ul');
                response['Errors'].forEach(function(item){
                    let errorItem = document.createElement('li');
                    errorItem.textContent = item;
                    featureErrorsList.appendChild(errorItem);
                });
                document.getElementById('selectedFeatureAlerts').innerHTML = '';
                document.getElementById('selectedFeatureAlerts').appendChild(featureErrorsList);
            }
        });
    } else{
        let featureErrorsList = document.createElement('ul');
        validation['errors'].forEach(function(item){
            let errorItem = document.createElement('li');
            errorItem.textContent = item;
            featureErrorsList.appendChild(errorItem);
        });
        document.getElementById('selectedFeatureAlerts').innerHTML = '';
        document.getElementById('selectedFeatureAlerts').appendChild(featureErrorsList);
    }

}

function deleteFeature(feature){
    const data = {
        'action': 'delete',
        'featureID': selectedFeatureID,
        'newType': document.getElementById('featureTypeDD').value,
        'newName': document.getElementById('selectedName').innerText,
        'newDescription': document.getElementById('selectedDescription').innerText,
        'newSequence': document.getElementById('selectedSequence').innerText,
    };
    console.log(data);
    // Populate dialog box
    document.getElementById('deleteFeatureName').innerText = data['newName'];
    document.getElementById('deleteFeatureDescription').innerText = data['newDescription'];
    // Show dialog
    deleteDialog.dialog({
        draggable: false,
        modal: true,
        buttons: [
            {
                text: "Cancel",
                click: function(){
                    $(this).dialog('close');
                }
            },
            {
                text: "DELETE!",
                class : 'dialogDeleteButton',
                click: function(){
                    $.post('/database/update_feature/', data, function(response){
                        if(response['Success'] === true){
                            // Update Feature Specs
                            selectedFeatureType = null;
                            selectedFeatureName = null;
                            selectedFeatureDescription = null;
                            selectedFeatureSequence = null;
                            // Notify User
                            document.getElementById('selectedFeatureAlerts').innerHTML = '<p>Feature Deleted!</p>';
                            // Redraw table
                            featureDatatable.draw();
                            // Close Dialog
                            deleteDialog.dialog('close');
                            // Close Editing
                            cancelFeature();
                        } else {
                            let featureErrorsList = document.createElement('ul');
                            response['Errors'].forEach(function(item){
                                let errorItem = document.createElement('li');
                                errorItem.textContent = item;
                                featureErrorsList.appendChild(errorItem);
                            });
                            document.getElementById('selectedFeatureAlerts').innerHTML = '';
                            document.getElementById('selectedFeatureAlerts').appendChild(featureErrorsList);
                            // Close Dialog
                            deleteDialog.dialog('close');
                        }
                    });
                }
            }
        ]
        }
    );
}

// --- Add new Features --- //

// Create Feature Form
$('#AddFeatureFormButton').on('click', function () {
    let newFeatureForm = FeatureFormTemplate.clone();
    newFeatureForm[0].style.display = 'inline-block';
    document.getElementById('FeatureFormContainer').appendChild(newFeatureForm[0]);
});

// Upload Form
function upload_feature(thisButton){
    let currentForm = thisButton.parentNode;
    let featureType = currentForm.getElementsByClassName('feature_type')[0].value;
    let featureName = currentForm.getElementsByClassName('feature_name')[0].value;
    let featureDescription = currentForm.getElementsByClassName('feature_description')[0].value;
    let featureSequence = currentForm.getElementsByClassName('feature_sequence')[0].value;

    const data = {
        'action': 'new',
        'featureID': null,
        'newType': featureType,
        'newName': featureName,
        'newDescription': featureDescription,
        'newSequence': featureSequence,
    };
    // Front-end validation
    console.log(data);
    const validation = validateFeature(data);

    if (validation['passed']){
        $.post('/database/update_feature/', data, function(response){
            if(response['Success'] === true){
                // Replace form with success notification
                let featureSuccess = document.createElement('div');
                featureSuccess.innerHTML = '<p><b>Feature Added!</b></p>';
                ['Name', 'Type', 'Description'].forEach(function(spec){
                    let featureRow = document.createElement('ul');
                    featureRow.className = 'FeatureFormRow';
                    let featureValue = document.createElement('li');
                    featureValue.innerText = spec;
                    featureValue.className = 'FeatureFormValue';
                    let featureForm = document.createElement('li');
                    featureForm.innerText = response['new'+spec];
                    featureForm.className = 'FeatureFormForm';
                    featureRow.appendChild(featureValue);
                    featureRow.appendChild(featureForm);
                    featureSuccess.appendChild(featureRow);
                });
                currentForm.innerHTML = '';
                currentForm.appendChild(featureSuccess);
            } else {
                let featureAlerts = currentForm.getElementsByClassName('NewFeatureAlerts')[0];
                let featureErrorsList = document.createElement('ul');
                validation['Errors'].forEach(function(item){
                    let errorItem = document.createElement('li');
                    errorItem.textContent = item;
                    featureErrorsList.appendChild(errorItem);
                });
                featureAlerts.innerHTML = '';
                featureAlerts.appendChild(featureErrorsList);
            }
        });
    } else{
        let featureAlerts = currentForm.getElementsByClassName('NewFeatureAlerts')[0];
        let featureErrorsList = document.createElement('ul');
        validation['errors'].forEach(function(item){
            let errorItem = document.createElement('li');
            errorItem.textContent = item;
            featureErrorsList.appendChild(errorItem);
        });
        featureAlerts.innerHTML = '';
        featureAlerts.appendChild(featureErrorsList);
    }
}

// --- Page Loaded --- //

// Hold selected feature specs in global
let selectedFeatureID;
let selectedFeatureType;
let selectedFeatureName;
let selectedFeatureDescription;
let selectedFeatureSequence;

let deleteDialog = $('#deleteDialog');

let FeatureFormTemplate;
let backupSelectedFeatureForm;
document.addEventListener('DOMContentLoaded', function(event) {
    FeatureFormTemplate = $('.addFeatureForm').clone();
    backupSelectedFeatureForm = $('#selectedFeatureForm').clone();
})