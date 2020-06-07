const MAP_SEQ_INTERACTIVITY_CLIENT_VERSION = "2.1.2"

// uncomment to show blue clicking behavior
var handleClicks = false;

var startup = function()
{
}

var find_nearest_relative_position_parent = function(element)
{
    // check if we have relative position
    if (get_style(element, "position")=="relative") {
        // found relative position
        return element;
    } else {
        // try parent
        if (element.parentNode == null) {
            return element;
        } else if (element.parentNode.style != null) {
            return find_nearest_relative_position_parent(element.parentNode);
        } else {
            return element;
        }
    }
}

// Gets the computed style is a browser cross platform way
// call as follows:
// get_style(document.getElementById("container"), "border-radius");
function get_style(element, css3Prop) {
    var strValue = "";
    if (window.getComputedStyle) {
        strValue = getComputedStyle(element).getPropertyValue(css3Prop);
    }
    //IE
    else if (element.currentStyle) {
        try {
            strValue = element.currentStyle[css3Prop];
        } catch (e) { }
    }
    return strValue;
}

 // code to get offset {top,left} in document coordinates of any element.
 // see http://javascript.info/tutorial/coordinates
 function getOffsetRect(elem) {
    var box = elem.getBoundingClientRect()
    var body = document.body
    var docElem = document.documentElement
    var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop
    var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft
    var clientTop = docElem.clientTop || body.clientTop || 0
    var clientLeft = docElem.clientLeft || body.clientLeft || 0
    var top  = box.top +  scrollTop - clientTop
    var left = box.left + scrollLeft - clientLeft
    return { top: Math.round(top), left: Math.round(left) }
}


var show_tooltip = function(svgParentElement, tooltip_id, bounding_box_id, showAbove)
{
    var tipElement = document.getElementById(tooltip_id);
    if (tipElement == null) {
        return;
    }

    var over = document.getElementById(bounding_box_id);
    if (over == null) {
        return;
    }

    show_tooltip_by_element(svgParentElement, tipElement, [ over ], showAbove);
}


// Shows a tooltip in the correct position on an html page based on an SVG element.
//
// svgParentElement: svg element to base the position
// tipElement: tooltip to show
// over: an array of SVG elements to base the position.  The position will be the
//    outer extent of all the rectangles combined.
// showAbove: hint (true or false) to help with placement
// forEnzyme: rules for placement are slightly different for enzymes compared with 
//    other elements.
//
var show_tooltip_by_element = function(svgParentElement, tipElement, over, showAbove, forEnzyme)
{
    if (tipElement == null) return;

    var svgElements = tipElement.getElementsByTagName("svg");
    if (svgElements != null && svgElements.length != 0) {

        var svgElement = svgElements[0];

        // The svg element <svg> needs a width and height of the actual calculated bounding
        // box which is hard to determine with the current code.  We will compute it here in
        // javascript and use it.
        if (svgElement.hasChildNodes()) {
            var firstG = svgElement.childNodes[0];
            var newElement = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
            var svgElementSize = svgElement.getBBox();

            // set svg size slightly larger to avoid the content getting clipped
            var w = (svgElementSize.width + 10) + "px";
            var h = (svgElementSize.height + 3) + "px";
            svgElement.style.width = w;
            svgElement.style.height = h;
        }
    }

    // evil hack to force chrome to relayout the tooltip window.  Otherwise it "over-optimizes" the need
    // to do the layout.
    tipElement.style.display = 'none';
    tipElement.style.display = 'block';

    var viewport = jQuery(svgParentElement).closest(".viewport").get(0);
    mapWidth = viewport.clientWidth;
    mapHeight = viewport.clientHeight;
//    console.log("viewport="+mapWidth + " " + mapHeight);

    // figure out the offset in document coordinates of the svg element.  I can
    // compute the offset by computing the position in using
    var mapBb = svgParentElement.getBBox();
    mapBb.x = 0;
    mapBb.y = 0;

    var svgMapCTM = svgParentElement.getScreenCTM();
    var mapLeftPt = svgParentElement.createSVGPoint();
    var mapRightPt = svgParentElement.createSVGPoint();
    mapLeftPt.x = mapBb.x;
    mapLeftPt.y = mapBb.y;
    mapRightPt.x = mapBb.x + mapBb.width;
    mapRightPt.y = mapBb.y + mapBb.height;
    var mapLeftTransPt = mapLeftPt.matrixTransform(svgMapCTM);
    var mapRightTransPt = mapRightPt.matrixTransform(svgMapCTM);

    // transform the bounding box from the bottom left and bottom right
    var x1 = 0;
    var y1 = 0;
    var x2 = 0;
    var y2 = 0;
    for (var i=0; i<over.length; i++) {
        var bb = over[i].getBBox();
        var overCTM = over[i].getScreenCTM(over[i]);
        var ptLeft  = svgParentElement.createSVGPoint();
        var ptRight  = svgParentElement.createSVGPoint();
        ptLeft.x = bb.x;
        ptLeft.y = bb.y;
        ptRight.x = bb.x + bb.width;
        ptRight.y = bb.y + bb.height;
        var toolLeftTransPt = ptLeft.matrixTransform(overCTM);
        var toolRightTransPt = ptRight.matrixTransform(overCTM);

        // add to results
        if (i==0) {
            x1 = toolLeftTransPt.x - mapLeftTransPt.x;
            y1 = toolLeftTransPt.y - mapLeftTransPt.y;
            x2 = toolRightTransPt.x - mapLeftTransPt.x;
            y2 = toolRightTransPt.y - mapLeftTransPt.y;
        } else {
            x1 = Math.min(x1, toolLeftTransPt.x - mapLeftTransPt.x);
            y1 = Math.min(y1, toolLeftTransPt.y - mapLeftTransPt.y);
            x2 = Math.max(x2, toolRightTransPt.x - mapLeftTransPt.x);
            y2 = Math.max(y2, toolRightTransPt.y - mapLeftTransPt.y);
        }
    }

    var base = find_nearest_relative_position_parent(svgParentElement);
    var baseRect = { left: 0, top: 0, width: base.clientWidth, height: base.clientHeight };
    if (base != null) {
        var baseOffsetRect = getOffsetRect(base);
        baseRect.left += baseOffsetRect.left;
        baseRect.top += baseOffsetRect.top;
    }

    var viewportRect = { left: 0, top: 0, width: viewport.clientWidth, height: viewport.clientHeight };
    {
        var viewportOffsetRect = getOffsetRect(viewport);
        viewportRect.left += viewportOffsetRect.left;
        viewportRect.top += viewportOffsetRect.top;
    }

    // transform hittest rectangle to base coordinates
    var hitRect = { left: x1, top: y1, width: x2-x1, height: y2-y1 };
    {
       var svgOffsetRect = getOffsetRect(svgParentElement);
       hitRect.left += svgOffsetRect.left;
       hitRect.top += svgOffsetRect.top;
    }

    //
    // Placement logic begin
    // Now, everything is in base coordinates: hitRect, viewportRect.  We also have tipWidth and tipHeight.
    // The placement logic determines were to put the tooltip by setting tipRect.
    //
    var tipRect = { left: 0, top: 0, width: tipElement.getBoundingClientRect().width, height: tipElement.getBoundingClientRect().height };

    if (forEnzyme != undefined && forEnzyme == true)
    {
        // try to place in the upper right first --- if no room, go to upper left and shift down as necessary
        tipRect.left = (hitRect.left + hitRect.width + 6);
        tipRect.top = (hitRect.top - tipRect.height - 6);
        var roomRight = (viewportRect.left + viewportRect.width) > (tipRect.left + tipRect.width);
        var roomUp = viewportRect.top < tipRect.top;

        if (roomUp && roomRight) {
            // it fits.  All done with placement.
        }
        else if (roomUp && !roomRight)
        {
            // no room to the right?  Slide left.
            tipRect.left = viewportRect.left + viewportRect.width - tipRect.width;
        }
        else if (!roomUp && roomRight)
        {
            // no room up, slide down
            tipRect.top = viewportRect.top;
        }
        else
        {
            // no room for either, place to the left and slide down
            tipRect.left = hitRect.left - tipRect.width - 6;
            tipRect.top = viewportRect.top;
        }

    } else {

        if (showAbove != undefined && showAbove == true) {
            // try to place above
            tipRect.top = hitRect.top - tipRect.height - 6;
            if (tipRect.top < viewportRect.top) {
                // nevermind, too high.  Place below.
                tipRect.top = hitRect.top + hitRect.height + 6;
            }
        } else {
            // try to place below
            tipRect.top = hitRect.top + hitRect.height + 6;
            if (tipRect.top + tipRect.height > viewportRect.top + viewportRect.height) {
                // ok, do above then.
                tipRect.top = hitRect.top - tipRect.height - 6;
            }
        }

        // center horizontally
        tipRect.left = hitRect.left + hitRect.width / 2 - tipRect.width / 2;
        tipRect.left = Math.max(tipRect.left, viewportRect.left + 15);
        tipRect.left = Math.min(tipRect.left, viewportRect.left+viewportRect.width-tipRect.width-15);
    }


    //
    // Placement logic end
    //

    // the final coordinates need to be base coordinates (closest relative parent).
    tipRect.left -= baseRect.left;
    tipRect.top -= baseRect.top;

    tipElement.style.left = tipRect.left + "px";
    tipElement.style.top = tipRect.top + "px";
    tipElement.style.visibility = "visible";
}


var hide_tooltip = function(tooltip_id)
{
    var tool = document.getElementById(tooltip_id);
    if (tool != null) {
        hide_tooltip_by_element(tool);
    }
}

var hide_tooltip_by_element = function(tool)
{
    if (tool != null) {
      tool.style.visibility="hidden";
    }
}

var branding_over = function(event)
{
    var svgParentElement = jQuery(event.target).closest("svg").get(0);
    show_tooltip(svgParentElement, "branding_tooltip","branding_svg");
    document.getElementById("branding_svg_underline").style.opacity = 1.0;

    // set it as pointer and left it for the lifetime of the page
    document.getElementById("branding_svg").style.cursor = "pointer";
}

var branding_out = function()
{
    var svgParentElement = jQuery(event.target).closest("svg").get(0);
    hide_tooltip("branding_tooltip");
    document.getElementById("branding_svg_underline").style.opacity = 0.0;
}

var branding_up = function()
{
    var win = window.open("http://snapgene.com", '_blank');
    win.focus();
}

// shows, hides or toggles visibility for all elements of a specific class.
// Pass in the class name and either "visible", "hidden" or "toggle"
var set_visibility = function(elements, command)
{
    for (j = 0; j < elements.length; j++)
    {
        if (command == "visible") elements[j].style.visibility = "visible";
        else if (command == "hidden") elements[j].style.visibility = "hidden";
        else if (command == "toggle") elements[j].style.visibility = (elements[j].style.visibility == "hidden") ? "visible" : "hidden";
    }
}

// select all DOM elements with the same class name, enzyme id and cut location
var query_enzyme_elements = function(parent_element,class_names, enzyme_id, cut_location)
{
    // break class names by spaces
    var class_name_array = class_names.split(" ");

    // filter by first class name
    var ret = [];
    var elements = document.getElementsByClassName(class_name_array[0]);
    for (var j = 0; j < elements.length; j++) {
        var e = elements[j];

        // the element must be a child of the parent sg-visualization
        if (!parent_element.contains(e)) {
            continue;
        }

        // get the classes for this element and make sure we can find each of the classes
        // in the parameters in this.
        var skip = false;
        var c1 = e.getAttribute("class");
        for (var k=1; k<class_name_array.length; k++) {
            if (c1.includes(class_name_array[k])==false) {
                skip = true;
                break;
            }
        }

        if (!skip) {
            var id = e.getAttribute("data-id");
            var cut = e.getAttribute("data-cut-location");
            if (id == enzyme_id && cut == cut_location) {
                ret.push(e);
            }
        }
    }
    return ret;
}

// select all DOM elements with the same class name and enzyme id, but NOT
// the same cut location.
var query_similar_enzyme_elements = function(parent_element, class_names, enzyme_id, cut_location)
{
    // break class names by spaces
    var class_name_array = class_names.split(" ");

    var ret = [];
    var elements = document.getElementsByClassName(class_name_array[0]);
    for (j = 0; j < elements.length; j++) {
        var e = elements[j];

        // the element must be a child of the parent sg-visualization
        if (!parent_element.contains(e)) {
            continue;
        }

        // get the classes for this element and make sure we can find each of the classes
        // in the parameters in this.
        var skip = false;
        var c1 = e.getAttribute("class");
        for (var k=1; k<class_name_array.length; k++) {
            if (c1.includes(class_name_array[k])==false) {
                skip = true;
                break;
            }
        }

        if (!skip) {
            var id = e.getAttribute("data-id");
            var cut = e.getAttribute("data-cut-location");
            if (id == enzyme_id && cut != cut_location) {
                ret.push(e);
            }
        }
    }
    return ret;
}

var enzyme_over = function(event,enzyme_id,cut_location)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);
    var svgParentElement = jQuery(event.target).closest("svg").get(0);

    // need to get the placement hint for the tooltip
    var sideHint = jQuery(event.target).closest(".sg-hittest").attr("data-side");
    var showAbove = (sideHint == "top");

    // show the enzyme over elements, plus recognition sequence and cut indicator.  Show similar elements for
    // other enzymes related to this id/cut location.

    // the recogintion and cut indicator class names have changed over time  they have been
    // sg-enzyme-recognition-sequence
    // or
    // sg-enzyme sg-recognition-sequence

    set_visibility(query_enzyme_elements( parent_element, "sg-enzyme sg-over", enzyme_id, cut_location ), "visible");
    set_visibility(query_enzyme_elements( parent_element, "sg-enzyme-recognition-sequence", enzyme_id, cut_location ), "visible");
    set_visibility(query_enzyme_elements( parent_element, "sg-enzyme-cut-indicator", enzyme_id, cut_location ), "visible");
    set_visibility(query_similar_enzyme_elements( parent_element, "sg-enzyme sg-similar", enzyme_id, cut_location ), "visible");
    show_tooltip_by_element(
        svgParentElement,
        query_enzyme_elements( parent_element, "sg-enzyme sg-tooltip", enzyme_id, cut_location )[0],
        query_enzyme_elements( parent_element, "sg-enzyme sg-hittest", enzyme_id, cut_location ),
        showAbove, true);
}

var enzyme_out = function(event,enzyme_id,cut_location)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // hide everything related to this enzyme.
    set_visibility(query_enzyme_elements( parent_element, "sg-enzyme sg-over", enzyme_id, cut_location ), "hidden");
    set_visibility(query_enzyme_elements( parent_element, "sg-enzyme-recognition-sequence", enzyme_id, cut_location ), "hidden");
    set_visibility(query_enzyme_elements( parent_element, "sg-enzyme-cut-indicator", enzyme_id, cut_location ), "hidden");
    set_visibility(query_similar_enzyme_elements( parent_element, "sg-enzyme sg-similar", enzyme_id, cut_location ), "hidden");
    hide_tooltip_by_element(
        query_enzyme_elements( parent_element, "sg-enzyme sg-tooltip", enzyme_id, cut_location )[0]);
}

var enzyme_click = function(event,enzyme_id,cut_location)
{
    if (!handleClicks) return;

    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // for testing we are allowing you to toggle the selected DOMs visibility this needs real logic for
    // this to be useful.
    set_visibility(
        query_enzyme_elements( parent_element, "sg-enzyme sg-selected", enzyme_id, cut_location ), "toggle");
}


// select all DOM elements with the same class name, primer id and cut location
var query_primer_elements = function(parent_element, class_names, primer_id, cut_location)
{
    // break class names by spaces
    var class_name_array = class_names.split(" ");

    var ret = [];
    var elements = document.getElementsByClassName(class_name_array[0]);
    for (j = 0; j < elements.length; j++) {
        var e = elements[j];

        // the element must be a child of the parent sg-visualization
        if (!parent_element.contains(e)) {
            continue;
        }

        // get the classes for this element and make sure we can find each of the classes
        // in the parameters in this.
        var skip = false;
        var c1 = e.getAttribute("class");
        for (var k=1; k<class_name_array.length; k++) {
            if (c1.includes(class_name_array[k])==false) {
                skip = true;
                break;
            }
        }

        if (!skip) {

            var id = e.getAttribute("data-id");
            var cut = e.getAttribute("data-cut-location");
            if (id == primer_id && cut == cut_location) {
                ret.push(e);
            }

        }
    }
    return ret;
}

// select all DOM elements with the same class name and primer id, but NOT
// the same cut location.
var query_similar_primer_elements = function(parent_element, class_names, primer_id, cut_location)
{
    // break class names by spaces
    var class_name_array = class_names.split(" ");

    var ret = [];
    var elements = document.getElementsByClassName(class_name_array[0]);
    for (j = 0; j < elements.length; j++) {
        var e = elements[j];

        // the element must be a child of the parent sg-visualization
        if (!parent_element.contains(e)) {
            continue;
        }

        // get the classes for this element and make sure we can find each of the classes
        // in the parameters in this.
        var skip = false;
        var c1 = e.getAttribute("class");
        for (var k=1; k<class_name_array.length; k++) {
            if (c1.includes(class_name_array[k])==false) {
                skip = true;
                break;
            }
        }

        if (!skip) {

            var id = e.getAttribute("data-id");
            var cut = e.getAttribute("data-cut-location");
            if (id == primer_id && cut != cut_location) {
                ret.push(e);
            }

        }
    }
    return ret;
}

var primer_over = function(event, primer_id,cut_location)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);
    var svgParentElement = jQuery(event.target).closest("svg").get(0);

    // need to get the placement hint for the tooltip
    var sideHint = jQuery(event.target).closest(".sg-hittest").attr("data-side");
    var showAbove = (sideHint == "top");

    // show the primer over elements, plus recognition sequence and cut indicator.  Show similar elements for
    // other primers related to this id/cut location.
    set_visibility(query_primer_elements( parent_element, "sg-primer sg-over", primer_id, cut_location ), "visible");
    set_visibility(query_similar_primer_elements( parent_element, "sg-primer sg-similar", primer_id, cut_location ), "visible");
    show_tooltip_by_element(
        svgParentElement,
        query_primer_elements( parent_element, "sg-primer sg-tooltip", primer_id, cut_location )[0],
        query_primer_elements( parent_element, "sg-primer sg-hittest", primer_id, cut_location ),
        showAbove);
}

var primer_out = function(event, primer_id,cut_location)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // hide everything related to this primer.
    set_visibility(query_primer_elements( parent_element, "sg-primer sg-over", primer_id, cut_location ), "hidden");
    set_visibility(query_similar_primer_elements( parent_element, "sg-primer sg-similar", primer_id, cut_location ), "hidden");
    hide_tooltip_by_element(query_primer_elements( parent_element, "sg-primer sg-tooltip", primer_id, cut_location )[0]);
}

var primer_click = function(event, primer_id,cut_location)
{
    if (!handleClicks) return;

    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // for testing we are allowing you to toggle the selected DOMs visibility this needs real logic for
    // this to be useful.
    set_visibility(
        query_primer_elements( parent_element, "sg-primer sg-selected", primer_id, cut_location ), "toggle");
}


var FEATURE_SEGMENT_ANY = 9999;

var find_sequence_line_number = function(e)
{
    // check if we have relative position
    var line = e.getAttribute("data-line");
    if (line != null) return line;
    if (e.parentNode.style != null) return find_sequence_line_number(e.parentNode);
    return null;
}

// select all DOM elements with the same class name, feature id and segment_index.  If
// the segement index or line number is -1, then ignore it.
var query_feature_elements = function(parent_element, class_names, feature_id, segment_index, line_number)
{
    // break class names by spaces
    var class_name_array = class_names.split(" ");

    var ret = [];
    var elements = document.getElementsByClassName(class_name_array[0]);
    for (j = 0; j < elements.length; j++) {
        var e = elements[j];

        // the element must be a child of the parent sg-visualization
        if (!parent_element.contains(e)) {
            continue;
        }

        // get the classes for this element and make sure we can find each of the classes
        // in the parameters in this.
        var missingClass = false;
        var c1 = e.getAttribute("class");
        for (var k=1; k<class_name_array.length; k++) {
            if (c1.includes(class_name_array[k])==false) {
                missingClass = true;
                break;
            }
        }
        if (missingClass) continue;

        // check for feature id match
        if (feature_id != -1) {
            var id = e.getAttribute("data-id");
            if (id != feature_id) continue;
        }

        // check for segment match
        if (segment_index != FEATURE_SEGMENT_ANY) {
            var segment = e.getAttribute("data-segment");
            if (segment != segment_index) continue;
        }

        // check for line match
        if (line_number != -1) {
            var line = find_sequence_line_number(e);
            if (line != line_number) continue;
        }

        ret.push(e);
    }
    return ret;
}

var feature_over = function(event, feature_id,segment_index,line_number)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);
    var svgParentElement = jQuery(event.target).closest("svg").get(0);

    // need to get the placement hint for the tooltip
    var sideHint = jQuery(event.target).closest(".sg-hittest").attr("data-side");
    var showAbove = (sideHint == "top");

    // show the feature over elements, plus recognition sequence and cut indicator.  Show similar elements for
    // other features related to this id/cut location.
    //
    // Note, we set the segment index to FEATURE_SEGMENT_ANY when searching for hittest regions because we want all the segments
    //   to be visible for the feature.
    set_visibility(query_feature_elements( parent_element, "sg-feature sg-over", feature_id, FEATURE_SEGMENT_ANY, -1 ), "visible");
    show_tooltip_by_element(
        svgParentElement,
        query_feature_elements( parent_element, "sg-feature sg-tooltip", feature_id, segment_index, -1 )[0],
        query_feature_elements( parent_element, "sg-feature sg-hittest", feature_id, FEATURE_SEGMENT_ANY, line_number ),
        showAbove);
}

var feature_out = function(event, feature_id,segment_index,line_number)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // hide everything related to this feature.
    set_visibility(query_feature_elements( parent_element, "sg-feature sg-over", feature_id, FEATURE_SEGMENT_ANY, -1 ), "hidden");
    hide_tooltip_by_element( query_feature_elements( parent_element, "sg-feature sg-tooltip", feature_id, segment_index, -1 )[0]);
}

var feature_click = function(event, feature_id,segment_index,line_number)
{
    if (!handleClicks) return;

    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // for testing we are allowing you to toggle the selected DOMs visibility this needs real logic for
    // this to be useful.
    set_visibility(query_feature_elements( parent_element, "sg-feature sg-selected", feature_id, FEATURE_SEGMENT_ANY, -1 ), "toggle");
}

var ftrans_over = function(event, feature_id, center_base, letter_position, letterCode)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);
    var svgParentElement = jQuery(event.target).closest("svg").get(0);

    // find the ftrans tooltip -- there is only one for the visualization.  If is doesn't exist, create it now.
    var tooltip = undefined;
    var tooltip_query = jQuery(parent_element).find(".sg-ftrans.sg-tooltip");
    if (tooltip_query.length != 0) {
        tooltip = tooltip_query.get(0);
    } else {
        var tooltipText = '<table class="sg-ftrans sg-tooltip tooltip_table"><tbody><tr><td>text-goes-here</td></tr></tbody></table>';
        var collection = jQuery(parent_element).find(".tips");
        collection.append(tooltipText);
        tooltip = jQuery(parent_element).find(".sg-ftrans.sg-tooltip").get(0);
    }

    // find the text element
    var t = query_orf_elements(parent_element, "sg-ftrans sg-text", feature_id, center_base)[0];
    t.style.fontWeight = "700";

    var protien = "Stop";
    if (letterCode == "A") protien = "Alanine"
    if (letterCode == "B") protien = "Asparagine"
    if (letterCode == "C") protien = "Cysteine"
    if (letterCode == "D") protien = "Aspartic Acid"
    if (letterCode == "E") protien = "Glutamic Acid"

    if (letterCode == "F") protien = "Phenylalanine"
    if (letterCode == "G") protien = "Glycine"
    if (letterCode == "H") protien = "Histidine"
    if (letterCode == "I") protien = "Isoleucine"
    if (letterCode == "J") protien = "Leucine"

    if (letterCode == "K") protien = "Lysine"
    if (letterCode == "L") protien = "Leucine"
    if (letterCode == "M") protien = "Methionine"
    if (letterCode == "N") protien = "Asparagine"
    if (letterCode == "O") protien = "Pyrrolysine"

    if (letterCode == "P") protien = "Proline"
    if (letterCode == "Q") protien = "Glutamine"
    if (letterCode == "R") protien = "Arginine"
    if (letterCode == "S") protien = "Serine"
    if (letterCode == "T") protien = "Threonine"

    if (letterCode == "U") protien = "Selenocysteine"
    if (letterCode == "V") protien = "Valine"
    if (letterCode == "W") protien = "Tryptophan"
    if (letterCode == "X") protien = "Any"
    if (letterCode == "Y") protien = "Tyrosine"
    if (letterCode == "Z") protien = "Glutamine"

    // find the inner html, rip out everything before ORF and fill in with more parameters
/*       var s = tooltip.children[0].children[0].children[0].innerHTML;
       var pos = s.indexOf("ORF:");
       s = s.substr(pos);
       if (orf_position == -1) {
         s = "Stop<br><br>" + s;
       } else {
         s = protien + " (" + orf_position + ")<br><br>" + s;
       } */

       var text = "";
       if (protien == "Stop" || letter_position == 0) {
        text = protien;
       } else {
        text = protien + " (" + letter_position + ")";
       }

       tooltip.children[0].children[0].children[0].innerHTML = text;

    show_tooltip_by_element(
        svgParentElement,
        tooltip,
//        query_orf_elements( parent_element, "sg-ftrans sg-text", feature_id, center_base )[0],
        [ event.target ],
        true);
}


var ftrans_out = function(event, feature_id, center_base)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    var tooltip = tooltip = jQuery(parent_element).find(".sg-ftrans.sg-tooltip").get(0);

    // hide everything related to this orf.
    hide_tooltip_by_element( tooltip );

    var t = query_orf_elements( parent_element, "sg-ftrans sg-text", feature_id, center_base)[0];
    t.style.fontWeight = "400";


}

var ftrans_click = function(event, orf_id, center_base)
{
    if (!handleClicks) return;
}


// select all DOM elements with the same class name, orf id
var query_orf_elements = function(parent_element, class_names, orf_id, orf_base)
{
//    var parentVisualization = jQuery(event.target).closest(".sg-visualization").get(0);

    // break class names by spaces
    var class_name_array = class_names.split(" ");

    // filter by first class name
    var ret = [];
    var elements = document.getElementsByClassName(class_name_array[0]);
    for (var j = 0; j < elements.length; j++) {
        var e = elements[j];

        // the element must be a child of the parent sg-visualization
        if (!parent_element.contains(e)) {
            continue;
        }

        // get the classes for this element and make sure we can find each of the classes
        // in the parameters in this.
        var missingClass = false;
        var c1 = e.getAttribute("class");
        for (var k=1; k<class_name_array.length; k++) {
            if (c1.includes(class_name_array[k])==false) {
                missingClass = true;
                break;
            }
        }
        if (missingClass) continue;

        if (orf_id != -1) {
            var id = e.getAttribute("data-id");
            if (id != orf_id) continue;
        }

        if (orf_base != -1) {
            var base = e.getAttribute("data-base");
            if (base != orf_base) continue;
        }

        ret.push(e);
    }
    return ret;
}


var orf_over = function(event, orf_id)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);
    var svgParentElement = jQuery(event.target).closest("svg").get(0);

    // show the orf over elements and tooltips
    set_visibility(query_orf_elements( parent_element, "sg-orf sg-over", orf_id, -1 ), "visible");
    show_tooltip_by_element(
        svgParentElement,
        query_orf_elements( parent_element, "sg-orf sg-tooltip", orf_id, -1 )[0],
        query_orf_elements( parent_element, "sg-orf sg-hittest", orf_id, -1 ));
}

var orf_out = function(event, orf_id)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // hide everything related to this orf.
    set_visibility(query_orf_elements( parent_element, "sg-orf sg-over", orf_id, -1 ), "hidden");
    hide_tooltip_by_element(query_orf_elements( parent_element, "sg-orf sg-tooltip", orf_id, -1 )[0]);
}

var orf_click = function(event, orf_id)
{
    if (!handleClicks) return;

    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // for testing we are allowing you to toggle the selected DOMs visibility this needs real logic for
    // this to be useful.
    set_visibility(query_orf_elements( parent_element, "sg-orf sg-selected", orf_id, -1 ), "toggle");
}

var orfb_over = function(event, orf_id, center_base, orf_position, letterCode)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);
    var svgParentElement = jQuery(event.target).closest("svg").get(0);

    // find the text element
    var t = query_orf_elements(parent_element, "sg-orf sg-text", orf_id, center_base)[0];
    t.style.fontWeight = "700";

    // show the orf over elements and tooltips
    var tooltip = query_orf_elements( parent_element, "sg-orf sg-tooltip", orf_id, -1 )[0]

    var protien = "?"
    if (letterCode == "A") protien = "Alanine"
    if (letterCode == "B") protien = "Asparagine"
    if (letterCode == "C") protien = "Cysteine"
    if (letterCode == "D") protien = "Aspartic Acid"
    if (letterCode == "E") protien = "Glutamic Acid"

    if (letterCode == "F") protien = "Phenylalanine"
    if (letterCode == "G") protien = "Glycine"
    if (letterCode == "H") protien = "Histidine"
    if (letterCode == "I") protien = "Isoleucine"
    if (letterCode == "J") protien = "Leucine"

    if (letterCode == "K") protien = "Lysine"
    if (letterCode == "L") protien = "Leucine"
    if (letterCode == "M") protien = "Methionine"
    if (letterCode == "N") protien = "Asparagine"
    if (letterCode == "O") protien = "Pyrrolysine"

    if (letterCode == "P") protien = "Proline"
    if (letterCode == "Q") protien = "Glutamine"
    if (letterCode == "R") protien = "Arginine"
    if (letterCode == "S") protien = "Serine"
    if (letterCode == "T") protien = "Threonine"

    if (letterCode == "U") protien = "Selenocysteine"
    if (letterCode == "V") protien = "Valine"
    if (letterCode == "W") protien = "Tryptophan"
    if (letterCode == "X") protien = "Any"
    if (letterCode == "Y") protien = "Tyrosine"
    if (letterCode == "Z") protien = "Glutamine"

    // find the inner html, rip out everything before ORF and fill in with more parameters
       var s = tooltip.children[0].children[0].children[0].innerHTML;
       var pos = s.indexOf("ORF:");
       s = s.substr(pos);
       if (orf_position == -1) {
         s = "Stop<br><br>" + s;
       } else {
         s = protien + " (" + orf_position + ")<br><br>" + s;
       }
       tooltip.children[0].children[0].children[0].innerHTML = s;

    show_tooltip_by_element(
        svgParentElement,
        tooltip,
        query_orf_elements( parent_element, "sg-orf sg-text", orf_id, center_base ),
        false);
}

var orfb_out = function(event, orf_id, center_base)
{
    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    var tooltip = query_orf_elements( parent_element, "sg-orf sg-tooltip", orf_id, -1 )[0]

    // hide everything related to this orf.
    hide_tooltip_by_element( tooltip );

    var t = query_orf_elements( parent_element, "sg-orf sg-text", orf_id, center_base)[0];
    t.style.fontWeight = "400";


}

var orfb_click = function(event, orf_id, center_base)
{
    if (!handleClicks) return;

    var parent_element = jQuery(event.target).closest(".sg-visualization").get(0);

    // for testing we are allowing you to toggle the selected DOMs visibility this needs real logic for
    // this to be useful.
//    set_visibility(query_orf_elements( "sg-orf sg-selected", orf_id ), "toggle");
}



