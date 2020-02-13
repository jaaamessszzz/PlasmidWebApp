// Part instructions collapsible
$('#partInstructionsButton').on('click', function(){
    let collapsibleDiv = document.getElementById('partInstructionsDiv');
    if (collapsibleDiv.style.display === "block"){
        collapsibleDiv.style.display = "none";
    } else {
        collapsibleDiv.style.display = "block";
    }
});

// Submit Parts for Assembly
$('#submitParts').on('click', function () {
    let partPostData = {};
    let partTextAreaLines = $('#partEntry').val().split('\n');

    // Validate Rows

});