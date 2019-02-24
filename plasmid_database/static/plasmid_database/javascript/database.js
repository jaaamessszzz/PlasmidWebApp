const datatable = $('#plasmid_datatable').DataTable({
    "dom": "liprt",
    "ajax": '/database/update_table/',
    "processing": true,
    "serverSide": true,
    "deferRender": true,
    "orderCellsTop": true,
    "search": { "regex": true },
    "order": [[ 1, "asc" ]],
    "fixedColumns": true,
    "columnDefs": [
        { width: 100, targets: 0 },
        { width: 100, targets: 1 },
        { width: 200, targets: 2,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;width:100%;height:2.75em;'>" + row[2] + "</div>";
                    },
        },
        {
            width: 200, targets: 3,
            orderable: false,
            render: function (data, type, row, meta) {
                return "<div style='overflow:scroll;width:100%;height:2.75em;'>" + row[3] + "</div>";
            },
        },
        { width: 200, targets: 4,
            orderable: false,
            render : function (data, type, row, meta) {
                    return "<div style='overflow:scroll;width:100%;height:2.75em;'>" + row[4] + "</div>";
                    },
        },
        { width: 100, targets: 5,
            orderable: false},
        { width: 100, targets: 6 },
        { width: 100, targets: 7 },
    ],
    "drawCallback": function( settings ) {
        this.api().columns.adjust();
    },
    "initComplete": function() {
        // I can't figure out how to get column inputs from datatable.api()... so here's a map
        const columnMapping = {
            'id_project': 7,
            'id_projectindex': 6,
            'id_features': 5,
            'id_attributes': 4,
            'id_description': 3,
            'id_location': 2,
            'id_creator': 1,
            'id_date': 0,
        };

        const table = this;

        $('.filterInputsRow').on( "input paste ValueChange", 'input, select', function () {
            const inputFieldID = this.id;
            const currentColumn = table.api().column(columnMapping[inputFieldID]);

            let searchJQO;
            if ($(this).nodeName === 'SELECT'){

                if (currentColumn === 'id_project'){
                    searchJQO = $('#id_project option:selected')
                }else{
                    if(currentColumn === 'id_creator'){
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
    },
});

// Enable row selection on datatable
datatable.on( 'click', 'tr', function () {
    $(this).toggleClass('selected');
});

// Download selected plasmids as zip
$('#DownloadSelectedDatatablePlasmids').on('click', function(){
    console.log('HI.');

    const SelectedPlasmids = datatable.rows('.selected').data();
    let PlasmidIDs = [];
    for(let i=0;i<SelectedPlasmids.length;i++){
        console.log(SelectedPlasmids[i]);
        // PlasmidIDs.push();
    }
});