const LocationJSTree = $('#Locations-TreeJS');
const ContainerJSTree = $('#Containers-TreeJS');

let LocationID;
let LocationName;
let LocationDescription;
let containerID;
let selectedWells;

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

// Load Containers for a selected location
LocationJSTree.on('select_node.jstree', function(event, data){
    console.log(data);
    LocationID = data['node']['data']['id'];
    $.post('/locations/get_location_containers/', {'loc_id': LocationID}, function(response){
        console.log(response);
        ContainerJSTree.jstree(true).settings.core.data = response['data'];
        ContainerJSTree.jstree(true).refresh();
    });
});

// Load Container Contents on Container select
ContainerJSTree.on('select_node.jstree', function(event, data){
    containerID = data['node']['data']['id'];
    loadContainerContents();
});

// Load Container Contents
function loadContainerContents(){
    $.post('/locations/get_container_contents/', {'container_id': containerID}, function(response){

        let contents = response['contents'];
        let containerRows = response['rows'];
        let containerColumns = response['columns'];
        let containerLocation = response['location'];
        let containerName = response['container'];

        // Update location header
        let currentlyViewing = document.getElementById('currentlyViewing');
        currentlyViewing.innerText = 'Currently viewing container ' + containerName + ' located at ' + containerLocation;

        // Build table with JQuery Selectable
        let containerTable = document.getElementById('containerTable');
        containerTable.innerHTML = '';

        // Builder header
        let tableHeader = containerTable.createTHead();
        for (let i=0; i<containerColumns + 1; i++) {
            let newHeader = document.createElement('th');
            if (i === 0) {
                newHeader.innerText = '';
            } else {
                newHeader.innerText = i.toString();
            }
            tableHeader.appendChild(newHeader);
        }

        // Populate rows
        const rowIndexGenerator = rowGenerator();
        for (let i=1; i<containerRows + 1; i++){
            let newRow = document.createElement('tr');
            for (let j=0; j<containerColumns + 1; j++){
                let newCell = document.createElement('td');
                newCell.dataset.row = i;
                newCell.dataset.column = j;
                // Populate first column of row with row index (e.g. A, B, C)
                if (j === 0){
                    let rowIndex = rowIndexGenerator.next().value;
                    newCell.textContent = rowIndex;
                    newCell.style.fontSize = '12pt';
                    newCell.className = 'rowIndex';
                } else {
                    newCell.className = 'content selectable';
                    // Add content information to cell
                    if ( i in contents && j in contents[i]){
                        newCell.className += ' occupied';
                        newCell.innerText = contents[i][j]['name'] + '\n' + contents[i][j]['type'];
                        newCell.dataset.table = contents[i][j]['type'];
                        newCell.dataset.id = contents[i][j]['id'];
                    } else {  // Add empty cell if content does not exist
                        newCell.className += ' empty';
                    }
                }
                newRow.appendChild(newCell);
            }
            containerTable.appendChild(newRow);
        }
    });
}

// Selectable table
$('#containerTable').selectable({
    classes: {
        "ui-selectable": "highlight",
    },
    filter: ".selectable",
});

$("#containerTable").on("selectableselected", function( event, ui ) {});

// Generates row letters forever and ever
//
// Usage Example:
// const plateGenerator = rowGenerator();
// for (let i=0; i < 1200; i++){
//     console.log(plateGenerator.next().value);
// }
function* rowGenerator(){
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let prefix = '';
    const lmao = rowGenerator();

    while(true){
        for(let i=0; i<alphabet.length; i++) {
            let rowLetters = prefix + alphabet[i];
            yield rowLetters;
        }
        prefix = lmao.next().value;
    }
}

// Add contents to the selected wells
$('#addContents').on('click', function(){
    selectedWells = document.getElementsByClassName('empty ui-selected');
    $('#overlayContainer').dialog(ReagentDatatableDialogInit(event['target']['id'])).dialog("open");
});

// Remove contents from the selected wells
$('#removeContents').on('click', function(){
    selectedWells = document.getElementsByClassName('occupied ui-selected');
    $('#RemoveReagentForm').dialog({
        autoOpen: false,
        buttons: [{
            text: "Remove Reagents",
            id: "RemoveReagentWarning",
            click: function(){
                let rowColumnList = [];
                Array.from(selectedWells).forEach(function (item){
                    rowColumnList.push([item.dataset.row, item.dataset.column]);
                });

                let data = {
                    'container_id': containerID,
                    'positions': JSON.stringify(rowColumnList),
                }

                $.post('/locations/remove_reagents/', data, function(response){
                    if(response['success']){
                        loadContainerContents();
                        $(".ui-dialog-content").dialog("close");
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
        title: "Remove Reagents",
        minWidth: 500,
        modal: true,
        beforeClose: function (event, ui) {
            loadContainerContents();
        },
   }).dialog("open");
});


// Reagent Dialog initialization
function ReagentDatatableDialogInit(source) {
    return {
        autoOpen: false,
        buttons: [{
            text: "Add Selected Reagents",
            click: function () {
                let rowColumnList = [];
                Array.from(selectedWells).forEach(function (item){
                    rowColumnList.push([item.dataset.row, item.dataset.column]);
                });
                selectedRowData = MoCloDatatable.rows({'selected': true}).data()[0];

                let data = {
                    'reagent_id': selectedRowData[0],
                    'container_id': containerID,
                    'positions': JSON.stringify(rowColumnList),
                }

                // POST to Database
                $.post('/locations/add_reagents_to_container/', data, function (response) {
                    const database_success = response['success'];
                    if (database_success) {
                        loadContainerContents();
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
            id: 'SubmitNewReagentLocations',
        }],
        title: "Select Reagent to Add",
        minWidth: 800,
        modal: true,
        beforeClose: function (event, ui) {
            currentPart = null;
            document.getElementById("tableOverlay").style.display = "none";
            // Clear filters
            document.getElementById('id_project').value = '';
            document.getElementById('id_projectindex').value = '';
            document.getElementById('id_features').value = '';
            document.getElementById('id_description').value = '';
            document.getElementById('id_alias').value = '';
            // Clear search
            MoCloDatatable.columns().every(function(){
                this.search('');
            });
        },
    };
}

// ###############################
// #    Plasmid Table Overlay    #
// ###############################

let selectedRowData = null;  // Datatables row data for a selected row
let currentPart = null;  // Selected row cell in assembly table

// Initialize DataTable
let MoCloDatatable = $('#MoCloPlasmidsTable').DataTable({
    "dom": "iprt",
    "ajax": '/database/update_filter_table/',
    "processing": true,
    "serverSide": true,
    "deferRender": true,
    "paging": true,
    "orderCellsTop": true,
    "order": [[ 1, "asc" ]],
    "autoWidth": false,
    "columnDefs": [
        { name: 'id', width: 0, targets: 0, visible: false},
        { name: 'project', width: 50, targets: 1 },
        { name: 'projectindex', width: 50, targets: 2},
        { name: 'alias', width: 200, targets: 3,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;height:3.5em;word-break: normal;'>" + data + "</div>";
                    },
        },
        { name: 'description', width: 200, targets: 4,
            orderable: false,
            render : function (data, type, row, meta) {
                return '<div style="overflow:scroll;width:100%;height:4em;">' + data + '</div>';
            }
        },
        { name: 'features', width: 200, targets: 5,
            orderable: false,
            render : function (data, type, row, meta) {
                return '<div style="overflow:scroll;width:100%;height:4em;">' + data + '</div>';
            }
        },
        { name: 'attributes', width: 200, targets: 6,
            orderable: false,
            render : function (data, type, row, meta) {
                return '<div style="overflow:scroll;width:100%;height:4em;">' + data + '</div>';
            }
        },
    ],
    "drawCallback": function( settings ) {
        // Show overlay
        if (currentPart !== null){
            document.getElementById("tableOverlay").style.display = "block";
        }
        this.api().columns.adjust();
    },
    "initComplete": function() {
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
            currentColumn.search(inputValue, true, false).draw();
            });
    },
    "select": {style: "single"},
});

