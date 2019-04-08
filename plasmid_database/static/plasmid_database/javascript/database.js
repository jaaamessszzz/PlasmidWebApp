const datatable = $('#plasmid_datatable').DataTable({
    "dom": "liprt",
    "ajax": '/database/update_table/',
    "processing": true,
    "serverSide": true,
    "deferRender": true,
    "orderCellsTop": true,
    "search": { "regex": true },
    "order": [[ 1, "asc" ]],
    // "fixedColumns": true,
    "columnDefs": [
        { name: 'id', width: 0, targets: 0, visible: false },
        { name: 'project',width: 100, targets: 1 },
        { name: 'projectindex',width: 100, targets: 2 },
        { name: 'features',width: 200, targets: 3,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;width:100%;height:2.75em;'>" + row[3] + "</div>";
                    },
        },
        { name: 'attributes',
            width: 200, targets: 4,
            orderable: false,
            render: function (data, type, row, meta) {
                return "<div style='overflow:scroll;width:100%;height:2.75em;'>" + row[4] + "</div>";
            },
        },
        { name: 'description', width: 200, targets: 5,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;width:100%;height:2.75em;'>" + row[5] + "</div>";
                    },
        },
        { name: 'location', width: 100, targets: 6,
            orderable: false},
        { name: 'creator', width: 100, targets: 7 },
        { name: 'date', width: 100, targets: 8 },
    ],
    "drawCallback": function( settings ) {
        this.api().columns.adjust();
    },
    "initComplete": function() {

        const table = this;
        $('.filterInputsRow').on( "input paste ValueChange", 'input, select', function () {
            const CurrentColumnName = this.name;
            const currentColumn = table.api().column(this.name + ':name');

            let searchJQO;
            if ($(this).nodeName === 'SELECT'){

                if (CurrentColumnName === 'project'){
                    searchJQO = $('#id_project option:selected')
                }else{
                    if(CurrentColumnName === 'creator'){
                        searchJQO = $('#id_creator option:selected');
                    } else{
                        searchJQO = $(this);
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
            if(CurrentColumn['style']['width'] !== '0px'){
                // If column is not hidden initially, add to #ToggleDatatableColumns
                const ToggleRow = document.createElement('li');
                const RowCheckbox = document.createElement('input');
                RowCheckbox.type = 'checkbox';
                RowCheckbox.class = 'ColumnToggleRow';
                RowCheckbox.name = ColumnHeader;
                RowCheckbox.value = CurrentIndex;
                RowCheckbox.checked = true;
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

// Disable Download button if no rows are selected
const DownloadPlasmidsSubmitButton = $('#DownloadPlasmidsSubmitButton');
DownloadPlasmidsSubmitButton.prop("disabled", true);

// Enable row selection on datatable
datatable.on( 'click', 'tr', function () {
    $(this).toggleClass('selected');
    // Disable download button if no rows are selected
    const SelectedPlasmids = datatable.rows('.selected').data();
    if(SelectedPlasmids.length === 0){
        DownloadPlasmidsSubmitButton.prop("disabled", true);
    } else {
        DownloadPlasmidsSubmitButton.prop("disabled", false);
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
});

//=============================//
// Show/hide Datatable columns //
//=============================//

// Playing with hovering dialog
$('#HideDatatableColumnsButton').on('click', function(){
    $('#ToggleDatatableColumns').slideToggle(400);
});

$('#ToggleDatatableColumns').on('click', 'input', function(){
    datatable.column($(this).val()).visible(this.checked);
});

// Allow label clicks to toggle checkboxes
$('#ToggleDatatableColumns').on('click', 'label', function(){
    const ColumnCheckbox = $(this.previousSibling);
    this.previousSibling.checked = !this.previousSibling.checked;
    datatable.column(ColumnCheckbox.val()).visible(this.previousSibling.checked);
});