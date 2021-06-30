const datatable = $('#plasmid_datatable').DataTable({
    "dom": "lirpt",
    "ajax": '/database/update_table/',
    "processing": true,
    "serverSide": true,
    "deferRender": true,
    "orderCellsTop": true,
    "paging": true,
    "pagingType": "full_numbers",
    "lengthMenu": [10, 25, 50, 100, 250, 500],
    "search": { "regex": true },
    "order": [[ 12, "desc" ]],
    "autoWidth": false,
    "columns": [
        null,  // PKs
        { "width": "5%" },  // Project
        { "width": "5%" },  // ProjectIndex
        { "width": "5%" },  // Alias
        { "width": "25%" },  // Description
        { "width": "15%" },  // Attribute
        { "width": "10%" },  // Resistance
        { "width": "15%" },  // Feature
        { "width": "5%" },  // Location
        { "width": "5%" },  // Status
        { "width": "5%" },  // Assembly
        { "width": "5%" },  // Creator
        { "width": "5%" },  // Created
    ],
    "columnDefs": [
        { name: 'id', targets: 0, visible: false },
        { name: 'project', targets: 1 },
        { name: 'projectindex', targets: 2,
            render : function (data, type, row, meta) {
                    return "<a href=" + row[1] + "/" + row[2] +">" + row[2] + "</a>";
                    },
        },
        { name: 'alias', targets: 3,
            orderable: false,  // I can't figure out how to order aliases, issue with how DatatableView evaluates querysets for related name FKs
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                    },
        },
        { name: 'description', targets: 4,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                    },
        },
        { name: 'attribute', targets: 5,
            orderable: false,
            render: function (data, type, row, meta) {
                return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
            },
        },
        { name: 'resistance', targets: 6,
            orderable: false,
            render: function (data, type, row, meta) {
                return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
            },
        },
        { name: 'feature', targets: 7,
            orderable: false,
            visible: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                    },
        },
        { name: 'location', targets: 8,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                    },
        },
        { name: 'status', targets: 9,
            render : function (data, type, row, meta) {
                        if (row[11] === currentUser){
                            // Create dropdown
                            let wrap = document.createElement("div");
                            let statusDropdown = document.createElement("select");
                            statusDropdown.className = 'statusDropdown';
                            ["Designed", "Abandoned", "Verified"].forEach(function(plasmidStatus){
                                const dropdownOption = document.createElement("option");
                                dropdownOption.text = plasmidStatus;
                                dropdownOption.value = plasmidStatus;
                                if (plasmidStatus === data){
                                    dropdownOption.setAttribute("selected", "selected");
                                }
                                statusDropdown.add(dropdownOption);
                            });
                            wrap.appendChild(statusDropdown);
                            return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + wrap.innerHTML + "</div>";
                        }
                        else{
                            return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                        }
                    },
        },
        { name: 'assembly', targets: 10,
            orderable: false,
            visible: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                    },
        },
        { name: 'creator', targets: 11 },
        { name: 'date', targets: 12 },
    ],
    // "drawCallback": function( settings ) {
    //     this.api().columns.adjust();
    // },
    "initComplete": function() {

        const table = this;
        $('.filterInputsRow').on( "input paste ValueChange", 'input, select', function () {
            const CurrentColumnName = this.name;
            const currentColumn = table.api().column(this.name + ':name');

            let searchJQO;
            if ($(this).nodeName === 'SELECT'){
                // todo: optimize this...
                if (CurrentColumnName === 'project'){
                    searchJQO = $('#id_project option:selected')
                }else{
                    if(CurrentColumnName === 'creator'){
                        searchJQO = $('#id_creator option:selected');
                    } else{
                        if(CurrentColumnName === 'status'){
                        searchJQO = $('#id_status option:selected');
                    } else {
                            searchJQO = $(this);
                        }
                    }
                }
            } else{
                searchJQO = $(this);
            }
            // const inputValue = $.fn.dataTable.util.escapeRegex(searchJQO.val());
            const inputValue = searchJQO.val();
            currentColumn.search( inputValue, false, false ).draw();
        });

        // Populate show/hide column dialog
        const ToggleDatatableColumns = $('#ToggleDatatableColumns ul');
        const DatatableColumnZip = _.zip(datatable.columns().indexes(), datatable.columns().header());

        DatatableColumnZip.forEach(function(element){
            const CurrentIndex = element[0];
            const CurrentColumn = element[1];
            const ColumnHeader = CurrentColumn['textContent'];
            if(ColumnHeader !== 'ProjectID'){
                // If column is not hidden initially, add to #ToggleDatatableColumns
                const ToggleRow = document.createElement('li');
                const RowCheckbox = document.createElement('input');
                RowCheckbox.type = 'checkbox';
                RowCheckbox.class = 'ColumnToggleRow';
                RowCheckbox.name = ColumnHeader;
                RowCheckbox.value = CurrentIndex;
                RowCheckbox.checked = !['Features', 'Assembly'].includes(ColumnHeader);
                const RowLabel = document.createElement('label');
                RowLabel.for = ColumnHeader;
                RowLabel.textContent = ColumnHeader;

                ToggleRow.appendChild(RowCheckbox);
                ToggleRow.appendChild(RowLabel);
                ToggleDatatableColumns.append(ToggleRow);
            }
        });

        // document.getElementById("HideDatatableColumnsButton").getBoundingClientRect()

    },
});

// Plasmid status update
$('tbody').on('ValueChange', '.statusDropdown', function(a){
    const rowData = datatable.row(this.parentNode.parentNode).data();
    const statusUpdate = a.currentTarget.value;
    let postData = {'statusUpdate': statusUpdate,
                    'plasmid_id': rowData[0]
    }
    console.log(rowData);
    console.log(postData);
    $.post('/database/update_status/', postData, function () {
        datatable.draw();
    });
});


// Disable Download button if no rows are selected
const DownloadPlasmidsSubmitButton = $('#DownloadPlasmidsSubmitButton');
DownloadPlasmidsSubmitButton.prop("disabled", true);

// Disable Assembly Instructions button if no rows are selected
const PlasmidAssemblyInstructionsButton = $('#PlasmidAssemblyInstructionsButton');
PlasmidAssemblyInstructionsButton.prop("disabled", true);

// Show/Hide delete button with "ARE YOU SUPER SURE" prompt
// Implement this...
const deletePlasmidsSubmitButton = $('#DeleteSelectedDatabasePlasmids');
deletePlasmidsSubmitButton.prop("disabled", true);


// Enable row selection on datatable
datatable.on( 'click', 'tr', function () {
    $(this).toggleClass('selected');

    // Disable download button if no rows are selected
    // Toggle delete plasmid button
    const SelectedPlasmids = datatable.rows('.selected').data();
    if(SelectedPlasmids.length === 0){
        PlasmidAssemblyInstructionsButton.prop("disabled", true);
        DownloadPlasmidsSubmitButton.prop("disabled", true);
        deletePlasmidsSubmitButton.prop("disabled", true);
        deletePlasmidsSubmitButton.hide();
    } else {
        PlasmidAssemblyInstructionsButton.prop("disabled", false);
        DownloadPlasmidsSubmitButton.prop("disabled", false);
        deletePlasmidsSubmitButton.prop("disabled", false);
        deletePlasmidsSubmitButton.show();
    }
});

// Attach plasmids to form when selected
datatable.on('click', function(){
    const SelectedPlasmids = datatable.rows('.selected').data();
    let PlasmidIDs = [];
    for(let i=0;i<SelectedPlasmids.length;i++){
        const SelectedPlasmid = SelectedPlasmids[i][0];
        PlasmidIDs.push(SelectedPlasmid);
    }
    $('#DownloadSelectedDatabasePlasmids').val(JSON.stringify(PlasmidIDs));
    $('#PlasmidAssemblyInstructions').val(JSON.stringify(PlasmidIDs));
});

//===========================//
// Delete Selected Plasmids //
//=========================//

// Show Confirmation Prompt
const deleteButton = $('#DeleteSelectedDatabasePlasmids');
deleteButton.on('click', function(){

    let deletePlasmidInfo = document.getElementById('deletePlasmidInfo');
    let errorPlasmidInfo = document.getElementById('errorPlasmidInfo');

    // Clear Confirmation Prompt
    deletePlasmidInfo.innerHTML = '';
    errorPlasmidInfo.innerHTML = '';

    document.getElementById('errorPlasmidInfoContainer').style.display = "none";

    const SelectedPlasmids = datatable.rows('.selected').data();
    console.log(SelectedPlasmids);

    // List plasmids selected for deletion
    for(let i=0;i<SelectedPlasmids.length;i++){
        let currentPlasmid = SelectedPlasmids[i];
        let plasmidRow = document.createElement('tr');
        // Add plasmid Project (1), Index (2), and Description (4)
        [1, 2, 4].forEach(function(index){
            let plasmidCell = document.createElement('td');
            plasmidCell.textContent = currentPlasmid[index];
            plasmidRow.appendChild(plasmidCell);
        });
        if(currentPlasmid[11] === currentUser){
            deletePlasmidInfo.appendChild(plasmidRow);
        } else{
            errorPlasmidInfo.appendChild(plasmidRow);
        }

        if (errorPlasmidInfo.innerHTML !== ''){
            document.getElementById('errorPlasmidInfoContainer').style.display = "block";
        }
    }

    // document.getElementById("deletePlasmidsOverlay").style.display = "block";

    $('#deletePlasmidsOverlay').dialog({
        autoOpen: false,
        dialogClass: "no-close",
        buttons: [{
            text: "Delete Plasmids",
            id: "confirmDeletePlasmidsButton",
            click: function(){
                let deletedPKs = [];
                const SelectedPlasmids = datatable.rows('.selected').data();
                for(let i=0;i<SelectedPlasmids.length;i++) {
                    if(SelectedPlasmids[i][11] === currentUser){
                        deletedPKs.push(SelectedPlasmids[i][0]);
                    }
                }
                let postData =  {'deletedPKs': deletedPKs};

                // NOTE: Logged-in User is validated server-side as well!
                $.post('/database/delete_user_plasmids/', postData, function () {
                    datatable.draw();
                    document.getElementById('deletePlasmidInfo').innerHTML = '';
                    document.getElementById('errorPlasmidInfo').innerHTML = '';
                    document.getElementById("deletePlasmidsOverlay").style.display = "none";
                });
               $(".ui-dialog-content").dialog("close");
            },
        },
        {
           text: "Oops, Nevermind...",
           click: function(){
               $(".ui-dialog-content").dialog("close");
           }
        }],
        title: "Delete Plasmids",
        minWidth: 800,
        modal: true,
        beforeClose: function (event, ui) {},
   }).dialog("open");

});

// Hide confirmation prompt
// $('#cancelDeleteButton').on('click', function(){
//     document.getElementById("deletePlasmidsOverlay").style.display = "none";
// });

// Delete Plasmids and rerender table
// $('#confirmDeletePlasmidsButton').on('click', function () {
//     let deletedPKs = [];
//     const SelectedPlasmids = datatable.rows('.selected').data();
//     for(let i=0;i<SelectedPlasmids.length;i++) {
//         if(SelectedPlasmids[i][11] === currentUser){
//             deletedPKs.push(SelectedPlasmids[i][0]);
//         }
//     }
//     let postData =  {'deletedPKs': deletedPKs};
//
//     // NOTE: Logged-in User is validated server-side as well!
//     $.post('/database/delete_user_plasmids/', postData, function () {
//         datatable.draw();
//         document.getElementById('deletePlasmidInfo').innerHTML = '';
//         document.getElementById('errorPlasmidInfo').innerHTML = '';
//         document.getElementById("deletePlasmidsOverlay").style.display = "none";
//     });
// });

// Datatable instructions collapsible
$('#databaseInstructionsButton').on('click', function(){
    let collapsibleDiv = document.getElementById('databaseInstructionsDiv');
    if (collapsibleDiv.style.display === "block"){
        collapsibleDiv.style.display = "none";
    } else {
        collapsibleDiv.style.display = "block";
    }
});

// Generate a picklist
$('#PickDatabasePlasmids').on('click', function(){

});

//=============================//
// Show/hide Datatable columns //
//=============================//

const columnToggle = $('#ToggleDatatableColumns');

// Playing with hovering dialog
$('#HideDatatableColumnsButton').on('click', function(){
    columnToggle.slideToggle(400);
});

columnToggle.on('click', 'input', function(){
    datatable.column($(this).val()).visible(this.checked);
});

// Allow label clicks to toggle checkboxes
columnToggle.on('click', 'label', function(){
    const ColumnCheckbox = $(this.previousSibling);
    this.previousSibling.checked = !this.previousSibling.checked;
    datatable.column(ColumnCheckbox.val()).visible(this.previousSibling.checked);
});