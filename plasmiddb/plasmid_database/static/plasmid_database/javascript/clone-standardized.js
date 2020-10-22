// Global Datatables variables...
let pageLoaded = false;
let selectedRowData = null;  // Datatables row data for a selected row
let currentPart = null;  // Selected row cell in assembly table

// ########################
// plasmid part definitions
// ########################

// https://www.geeksforgeeks.org/implementation-linkedlist-javascript/
class Node {
    constructor(part){
        this.part = part;
        this.next = null;
        this.previous = null;
    }
}

// todo: figure out how to export/import in javascript...
// https://www.geeksforgeeks.org/implementation-linkedlist-javascript/
class PlasmidMap {
    // Cirular double linked list for plasmid part definitions 5'->3'

    constructor(){
        this.head = null;
        this.size = 0;
        this.tk_parts = ['1', '2', '3a', '3b', '4a', '4b', '5', '6', '7', '8a', '8b'];
    }

    add(part){
        var newNode = new Node(part);

        if (this.head == null){
            this.head = newNode;
            newNode.next = newNode;
            newNode.previous = newNode;
        }

        else {
            const tail = this.head.previous;
            tail.next = newNode;
            newNode.previous = tail;
            newNode.next = this.head;
            this.head.previous = newNode;
        }
        this.size++;
    }
}

// Toolkit parts generalized

function get_all_parts(start, end){
    let tk_definition = PlasmidMap();
    tk_definition.tk_parts.forEach(function(element){
        this.add(element)
    });

    if(!tk_definition.tk_parts.includes(start))
        return false;

    if(!tk_definition.tk_parts.includes(end))
        return false;

    let current_part = tk_definition.head;
    let part_end = false;
    let add_parts = false;
    let part_list = [];

    while(part_end === false){
        if (current_part.part === start)
            add_parts = true;

        if (current_part.part === end)
            part_end = true;

        if (add_parts)
            part_list.push(current_part.part);

        current_part = current_part.next;
    }

    return part_list;
}

// ###############
// Table functions
// ###############

const assemblyTable = $('#AssemblyTable');
let cloneTableRow = null;

// Select assembly type
let assemblyType = $('#reactionTypeSelector');
assemblyType.change(function(){
    initializeTable($(this).val())
});

// Create new table
function initializeTable(assemblyType){

    const tableTypes = {'Cassette': ['1', '2', '3a', '3b', '4a', '4b', '5', '6', '7', '8a', '8b'],
                        'MultiCassette': ['LS-1', '1-2', '2-3', '3-4', '4-5', '5-RE', 'RE-LS']};

    // Select and empty existing table
    let newTableJQO = assemblyTable;
    newTableJQO.empty();
    let newTable = newTableJQO[0];

    // New header row
    let newHeader = document.createElement('tr');
    for (let part of tableTypes[assemblyType]){
        let newCell = document.createElement('th');
        newCell.innerText = part;
        newHeader.appendChild(newCell);
    }

    let aliasCellHeader = document.createElement('th');
    aliasCellHeader.innerText = 'Alias';
    newHeader.appendChild(aliasCellHeader);

    let optionCellHeader = document.createElement('th');
    optionCellHeader.innerText = 'Options';
    newHeader.appendChild(optionCellHeader);

    // New default row
    let newDefault = document.createElement('tr');
    for (let part of tableTypes[assemblyType]){
        let newCell = document.createElement('th');
        if (assemblyType === 'Cassette') {
            newCell.className = 'Part_' + part + ' Part';
        } else{
            newCell.className = part + ' Part';
        }
        newCell.innerText = 'Add Part';
        newDefault.appendChild(newCell);
    }

    let optionsCell = document.createElement('tr');
    optionsCell.innerHTML = '<button class="cloneRow" type="button"><i class="fas fa-clone"></i></button>\n' +
        '<button class="deleteRow" type="button"><i class="fas fa-minus-circle"></i></button>';
    optionsCell.className = 'Options';
    newDefault.appendChild(optionsCell);

    let aliasCell = document.createElement('tr');
    aliasCell.innerHTML = '<input class="aliasInput" type="text">';
    aliasCell.className = 'Alias';
    newDefault.appendChild(optionsCell);

    newDefault.className = 'assemblyRow';

    // Add header and default row to new table
    newTable.appendChild(newHeader);
    newTable.appendChild(newDefault);

    // Assign default row to selectedRowData
    cloneTableRow = newDefault;
    // currentPart = null;
    currentPart = null;
}

// Prepare default new row
$(document).ready(function () {
    let defaultTableRow = document.getElementById("defaultRow");
    cloneTableRow = $(defaultTableRow).clone().removeAttr("id");
    defaultTableRow.removeAttribute("id");
});

$('#addNewRow').on('click', function () {
    let newRow = $(cloneTableRow).clone(true);
    assemblyTable.append(newRow);
});

// Clone existing row
assemblyTable.on('click', '.cloneRow', function () {
    let currentRow = this.parentNode.parentNode;
    let cloneRow = $(currentRow).clone(true);
    $(currentRow).after(cloneRow);
});

// Delete existing row
assemblyTable.on('click', '.deleteRow', function () {
    let currentRow = this.parentNode.parentNode;
    currentRow.remove();
});

// Add Plasmid to Row
assemblyTable.on('click', '.Part', function () {
    currentPart = this; // .classList[0].split('_')[1];
    let currentRow = currentPart.parentNode;
    let partCellArray = [...currentRow.childNodes];

    // Include part (user click input)
    var includePart = currentPart.classList[0].replace('_', ' ');

    // Exclude parts (already filled in row)
    var excludePart = [];
    partCellArray.forEach(function (element) {
        if (element.className === undefined) return;
        let classSplit = element.className.split(' ');
        if(classSplit.includes('Filled')){
            let partName = classSplit[0].replace('_', ' ');
            excludePart.push(partName);
        }
    });

    // const regex_search = '^(?!.*\\b(Part 4a)\\b.*).*(Part 3a).*$';
    // const regex_search = '^(?!.*\\b(' + excludePart.join('|') + ')\\b.*).*(' + includePart + ').*$';
    const regex_search = '_AssemblyRegex`' + excludePart.join('|') + '`' + includePart;
    console.log(regex_search);
    // Set attribute filter to part value
    MoCloDatatable.column(6).search(regex_search,true,false).draw();
});

// Remove Plasmid from Row
assemblyTable.on('click', '.Filled', function () {
    currentPart = this; // .classList[0].split('_')[1];
    let currentPartName = currentPart.innerText;
    let currentRow = currentPart.parentNode;
    let partCellArray = [...currentRow.childNodes];

    // Remove parts for currentPartName
    partCellArray.forEach(function (element) {
        if (element.className === undefined) return;
        if (element.innerText !== currentPartName) return;

        let classSplit = element.className.split(' ');
        // Revert Filled cell to empty state
        if(classSplit.includes('Filled')){
            let partName = classSplit[0];
            element.className = partName + ' Part';
            element.innerHTML = 'Add Part';
            element.style.backgroundColor = '';
            $(element).removeData();
        }
    });
});

// ##################
// Perform Assemblies
// ##################

$('#assemblyForm').submit(function(e){
    e.preventDefault();
    performPlasmidAssembly(this)
});

function performPlasmidAssembly(assemblyForm){

    // Get plasmid values from tables
    let AssemblyTable = document.getElementById("AssemblyTable");
    console.log(AssemblyTable);
    let plasmidPostData = {};  // Fully filled rows
    let incompleteRows = [];   // Incomplete rows

    // Get reaction definition options
    const reactionProject = $('#AssemblyProjectSelector option:selected').val();
    const reactionType = $('#reactionTypeSelector option:selected').val();  // Cassette or Multicassette

    let reactionEnzyme;
    if(reactionType === 'Cassette'){
        reactionEnzyme = 'BsaI';
    } else if(reactionType === 'MultiCassette'){
        reactionEnzyme = 'BsmBI';
    } else {
        reactionEnzyme = null;
    }

    plasmidPostData['ReactionProject'] = reactionProject;
    plasmidPostData['ReactionType'] = 'goldengate';
    plasmidPostData['ReactionEnzyme'] = reactionEnzyme;
    plasmidPostData['AssemblyRows'] = {};

    // for loop sadness...
    for (let row of AssemblyTable.rows){
        if (row.classList.contains('assemblyRow')){
            console.log(row.rowIndex);
            let rowComplete = true;
            let partPKs = [];
            let rowAlias;

            for (let cell of row.cells){
                if(!cell.className.startsWith('Options') && !cell.className.startsWith('Alias') ){
                    console.log(cell);
                    // Skip rows where
                    if(!cell.classList.contains('Filled')){
                        rowComplete = false;
                        break;
                    }
                    let cellPartPK = $(cell).data('partPK');
                    partPKs.push(cellPartPK);
                }

                if(cell.className.startsWith('Alias')){
                    rowAlias = cell.getElementsByClassName('aliasInput')[0].value;
                }
            }

            if(rowComplete){
                plasmidPostData['AssemblyRows'][row.rowIndex] = {};
                plasmidPostData['AssemblyRows'][row.rowIndex]['parts'] = partPKs;
                plasmidPostData['AssemblyRows'][row.rowIndex]['alias'] = rowAlias;
            } else{
                incompleteRows.push(row.rowIndex);
            }
        }
    }

    console.log(plasmidPostData);
    console.log(incompleteRows);

    if (incompleteRows.length !== 0){
        console.log('Assembly incomplete! Fix row {whatever}');
        // Add pop-up
        // Highlight incomplete rows
    } else{
        // Send form, report assembly results
        $.ajax({
            url: '/database/standard_assembly/',
            data: {'data': JSON.stringify(plasmidPostData)},
            method: "POST",
            success: function () {
                window.location.href = '/database/assembly_results/';
            }
        });
    }
}


// ###############################
// #    Plasmid Table Overlay    #
// ###############################

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
                if (pageLoaded && currentPart !== null){
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
});

// Add selected plasmid to MoCloTable
MoCloDatatable.on('click', 'tr', function () {
    selectedRowData = MoCloDatatable.row(this).data();

    // Get Parts for selected row
    const partPK = selectedRowData[0];
    const partProject = selectedRowData[1];
    const partIndex = selectedRowData[2];
    const partPartString = selectedRowData[6].split(',');

    let partParts = [];

    // todo: validate partParts based on assembly type...
    partPartString.forEach(function(element){
        let elementStripped = element.replace(/(^\s+|\s+$)/g,'');  // How does JavaScript not have a built-in strip???
        if(elementStripped.startsWith('Part') && assemblyType.val() === 'Cassette'){
            partParts.push(elementStripped.replace(' ', '_'));
        } else if (elementStripped.startsWith('Con') && assemblyType.val() === 'MultiCassette'){
            partParts.push(elementStripped.split(' ')[1]);
        }
    });
    console.log(partParts);
    // Add ID/Part names to table cells
    const currentRow = currentPart.parentNode;
    partParts.forEach(function (partClass) {
        let partCell = currentRow.getElementsByClassName(partClass)[0];
        partCell.innerHTML = partProject + ' ' + partIndex;
        partCell.style.backgroundColor = "#007CBE";
        partCell.className = partClass + ' Filled';
        $(partCell).data('partPK', partPK);
    });
    document.getElementById("tableOverlay").style.display = "none";
    // Reset currentPart selection and selectedRowData
    selectedRowData = null;
    currentPart = null;

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
});

// Hide overlay
$('#closeOverlayButton').on('click', function () {
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
});

// Page Loaded
$(document).ready(function(){
    // Set Project to User
    document.getElementById('AssemblyProjectSelector').value = user_index;
    console.log('Page loaded!');
    pageLoaded = true;
});