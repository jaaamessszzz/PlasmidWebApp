// #######################
// #   Feature Tables    #
// #######################

$('#FeatureDataTable').DataTable({
    "dom": "liprt",
    "ajax": '/database/update_features/',
    "processing": true,
    "serverSide": true,
    "deferRender": true,
    "orderCellsTop": true,
    "columnDefs": [],
    "drawCallback": function( settings ) {
        this.api().columns.adjust();
    },
    "initComplete": function() {
        // I can't figure out how to get column inputs from datatable.api()... so here's a map
        const columnMapping = {
            'id_FeatureName': 4,
            'id_FeatureSequence': 3,
            'id_FeatureDescription': 2,
            'id_FeatureType': 1,
            'id_FeatureCreator': 0,
        };

        const table = this;

        $('.filterInputsRow').on( "input paste ValueChange", 'input, select', function () {
            const inputFieldID = this.id;
            const currentColumn = table.api().column(columnMapping[inputFieldID]);

            let searchJQO;
            if ($(this).nodeName === 'SELECT'){

                if (currentColumn === 'id_FeatureType'){
                    searchJQO = $('#id_FeatureType option:selected')
                }else{
                    if(currentColumn === 'id_FeatureCreator'){
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
            currentColumn.search( inputValue, false, false ).draw();
        });
    },
});