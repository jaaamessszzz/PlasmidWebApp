// Django Documentation - Get csrftoken from cookie
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Django Documentation - Set csrftoken in AJAX requests
function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
    }
});

// ############################
// #    Load Add Page Tabs    #
// ############################

$('ul.pageTabs').each(function(){
    var $active, $content, $links = $(this).find('a');
    $active = $($links.filter('[href="'+location.hash+'"]')[0] || $links[0]);
    $active.addClass('active');
    $content = $($active[0].hash);
    $links.not($active).each(function () {
        $(this.hash).hide();
    });

    $(this).on('click', 'a', function(e){
    $active.removeClass('active');
    $content.hide();

    $active = $(this);
    $content = $(this.hash);

    $active.addClass('active');
    $content.show();

    e.preventDefault();
  });
});


// ####################
// #    Tree Menus    #
// ####################

// $('.DropdownTreeMenu').on('click', 'li', function(){
//     // Add nested list
//
//     // Open nested list
//     this.parentElement.querySelector(".nested").classList.toggle("active");
//     this.classList.toggle("caret-down");
// });