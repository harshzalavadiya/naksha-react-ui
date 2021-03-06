'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _indiaBoundaries = require('../common/india-boundaries.js');

var _indiaBoundaries2 = _interopRequireDefault(_indiaBoundaries);

var _config = require('../common/config.js');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mapboxgl = require('mapbox-gl');
var GoogleMapsLoader = require('google-maps');

var baseUrl = null;
var geoserverBaseUrl = null;
var workspace_name = 'biodiv';
var thumbnailsUrl = null;

var current_selected_layer = null;
var current_selected_style = null;

var map_style = null;
var active_layers = [];
var fixed_layers = [];
var layerNameToTitleMap = {};
var layerToStyleOptionsMap = {};

var initial_zoom = null;

var map = null;
var map_props = null;
// var gmap = null;

function initMap(props) {
    map_props = props;
    baseUrl = "https://" + props.contextUrl + "/naksha/";
    geoserverBaseUrl = baseUrl + "geoserver/";
    thumbnailsUrl = geoserverBaseUrl + "thumbnails/";
    var india_center = { lat: 25, lng: 77 };
    var zoom = 3;
    // var gZoom = zoom + 1; // Google zoom levels are one higher than mapboxgl
    initMapboxglMap(india_center, zoom, props);
    // initGoogleMap(india_center, gZoom);
    // SyncGoogleAndMapboxglMaps(map, gmap);
    populateLayerPanel();
}

function initGoogleMap(center, zoom) {
    GoogleMapsLoader.load(function (google) {
        new google.maps.Map(document.getElementById('gmap'), {
            zoom: zoom,
            center: center
        });
    });
}

function initMapboxglMap(center, zoom, props) {
    mapboxgl.accessToken = 'pk.eyJ1IjoicHJpeWFuc2h1LWEiLCJhIjoiY2phMmQ1bTFvNzRjZDMzcGdiNmQ5a3k5YSJ9.cpBkEIu8fQFAgx1cYuTQVg';
    var initialBounds = props.softBounds; //[[92, 10], [102, 29]];
    var hardBounds = props.hardBounds; //[[80,5],[105,40]];
    var groupName = props.groupName;
    map = new mapboxgl.Map({
        container: 'map',
        //center: [center.lng, center.lat],
        //zoom: zoom,
        style: 'mapbox://styles/mapbox/basic-v9', //india_boundary
        hash: true
    });

    if (hardBounds) {
        map.fitBounds(hardBounds, { linear: true, duration: 0 });
        map.setMaxBounds(map.getBounds());
    }

    if (initialBounds) {
        map.fitBounds(initialBounds, { linear: true, duration: 0 });
    }

    if (groupName) {
        addStateBoundaryLayer(map, groupName);
    }

    map.on('load', function () {
        (0, _indiaBoundaries2.default)(map);
    });

    map.addControl(new mapboxgl.NavigationControl());
    addBaseLayerSelector(map);

    map.on('click', function (e) {
        showClickedFeature(e);
    });
}

function addStateBoundaryLayer(map, groupName) {
    var state = null;
    if (groupName === "assambiodiversity") state = "ASSAM";

    if (state) {
        var LAYER_NAME = 'group-state-boundary';
        var source = {
            "type": "vector",
            "scheme": "tms",
            "tiles": [geoserverBaseUrl + "gwc/service/tms/1.0.0/biodiv:lyr_116_india_states/{z}/{x}/{y}"]
        };
        var layer = {
            "id": LAYER_NAME,
            "type": "line",
            "source": LAYER_NAME,
            "source-layer": "lyr_116_india_states",
            "paint": {
                "line-width": 2,
                "line-color": "#000000"
            },
            "filter": ['in', 'state', state]

        };
        map.on('load', function () {
            map.addSource(LAYER_NAME, source);
            map.addLayer(layer);
        });
        fixed_layers.push(LAYER_NAME);
    }
}

function addBaseLayerSelector() {
    var base_layers = [{
        name: 'Mapbox Basic',
        type: 'mapbox',
        id: 'basic'
    }, {
        name: 'Mapbox Streets',
        type: 'mapbox',
        id: 'streets'
    }, {
        name: 'Mapbox Satellite',
        type: 'mapbox',
        id: 'satellite'
    }];

    var html = "<select class='base-layer-selector' onchange='changeBaseLayer(this)'>";
    for (var i = 0; i < base_layers.length; i++) {
        var layer = base_layers[i];
        html += "<option value='" + layer.id + "' type='" + layer.type + "'>" + layer.name + "</option>";
    }
    html += "</select>";
    //document.getElementById('map').innerHTML = html + document.getElementById('map').innerHTML;
    document.getElementById('map').insertAdjacentHTML('afterend', html);
}

function changeBaseLayer(baseLayerSelector) {
    var option = baseLayerSelector.options[baseLayerSelector.selectedIndex];
    var type = option.getAttribute('type');
    var layerId = option.getAttribute('value');

    var addedSources = map.getStyle().sources;
    // remove the mapbox source
    delete addedSources.mapbox;

    // remove the layers added by mapbox. Now we only have layers that were added by user
    var addedLayers = map.getStyle().layers.filter(function (layer) {
        return layer.source !== 'mapbox' && layer.source !== 'world' && layer.id !== 'background';
    });

    if (type === 'mapbox') {
        // user has switched to other mapbox layer
        // change the mapbox style. This will remove all the layers that were added.
        map.setStyle('mapbox://styles/mapbox/' + layerId + '-v9');
    }

    map.on('style.load', function () {
        // add all sources back
        Object.keys(addedSources).forEach(function (source) {
            map.addSource(source, addedSources[source]);
        });

        // add all layers back
        addedLayers.forEach(function (layer) {
            map.addLayer(layer);
        });
    });
}

function SyncGoogleAndMapboxglMaps(map, gmap) {
    map.on('zoomstart', function () {
        set_initial_zoom(map);
    });
    map.on('zoom', function () {
        syncMaps(map, gmap);
    });
    map.on('move', function () {
        sync_map_move(map, gmap);
    });
}

function getWorkspace() {
    return workspace_name;
}

function get_map_style() {
    return map_style;
}

function set_map_style(style) {
    map_style = style;
}

// style_name should be combination of layer name and the attribute
// on which the styling is needed
function getStyle(style_name) {
    var style_file_url = geoserverBaseUrl + "styles/" + style_name + ".json";
    var style = httpGetAsync(style_file_url);
    return JSON.parse(style);
}

// gets all available styles for a layer
function getAvailableStyles(layer) {
    var styleFileUrl = geoserverBaseUrl + "layers/" + layer + "/styles";
    var styles = httpGetAsync(styleFileUrl);
    var stylesJson = JSON.parse(styles);
    return stylesJson;
}

function httpGetAsync(theUrl) {
    var isXML = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    // var xmlHttp = createCORSRequest("GET", theUrl)
    var xmlHttp = new XMLHttpRequest();
    // below code is used in case of async requests,
    // which is the correct way going forward
    /*xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4){
        	callback(xmlHttp.responseText)
            // return xmlHttp.responseText;
        }
    }*/
    xmlHttp.open("GET", theUrl, false); // true for asynchronous
    xmlHttp.send();
    if (isXML) return xmlHttp.responseXML;else return xmlHttp.responseText;
}

function getAvailableLayers() {
    // var url = geoserverBaseUrl + workspace_name + '/ows?SERVICE=WFS&REQUEST=GetCapabilities';
    var url = geoserverBaseUrl + 'layers/' + workspace_name + '/wfs';
    var layers = [];
    var isXML = true;
    var response = httpGetAsync(url, isXML);
    var featureTypeList = response.getElementsByTagName('FeatureTypeList')[0];
    for (var i = 0; i < featureTypeList.childNodes.length; i++) {
        var feature = featureTypeList.childNodes[i];
        var layer_info = getLayerInfo_WMS_3(feature);
        if (layer_info !== undefined) {
            layers.push(layer_info);
        }
    }
    return layers;
    // extract list of all available layers
    // var all_layers = layers_json.featureTypes.featureType.map(feature => feature.name);
    // return all_layers
}

function getLayerInfo_WMS_3(layerElement) {
    var name;
    var title;
    var bbox;
    var abstract;
    var keywords = [];
    var styles = [];

    var childNodes = layerElement.childNodes;

    var occurrence = getWorkspace() + ":occurrence";
    for (var i = 0; i < childNodes.length; i++) {
        if (childNodes[i].nodeName === "Name") {
            if (childNodes[i].childNodes[0] === undefined) return;
            name = childNodes[i].childNodes[0].nodeValue.split(':')[1];
            if (name === occurrence) return;
        } else if (childNodes[i].nodeName === "Title") {
            if (childNodes[i].childNodes[0] === undefined || childNodes[i].childNodes[0] === null) return;
            title = childNodes[i].childNodes[0].nodeValue;
        } else if (childNodes[i].nodeName === "Abstract") {
            var abstract_node = childNodes[i].childNodes[0];
            abstract = abstract_node !== undefined ? abstract_node.nodeValue : '';
        } else if (childNodes[i].nodeName.endsWith("BoundingBox")) {
            bbox = getLatLonBBoxString(childNodes[i]);
        } /*else if (childNodes[i].nodeName.endsWith("Keywords"))
             keywords = getLayerKeywords(childNodes[i]);*/
        // else if (childNodes[i].nodeName.endsWith("Style")) {
        //     styles.push(getStyleInfo(childNodes[i]));
        // }
    }

    return { name: name, title: title, bbox: bbox, abstract: abstract, keywords: keywords, styles: styles };
}

function getLatLonBBoxString(boundingBoxElement) {
    var lowerCorner = boundingBoxElement.childNodes[0].childNodes[0].nodeValue.split(' ');
    var upperCorner = boundingBoxElement.childNodes[1].childNodes[0].nodeValue.split(' ');
    var minx = lowerCorner[0];
    var miny = lowerCorner[1];
    var maxx = upperCorner[0];
    var maxy = upperCorner[1];

    var bboxArr = [];
    bboxArr.push(minx);
    bboxArr.push(miny);
    bboxArr.push(maxx);
    bboxArr.push(maxy);

    return bboxArr.join(',');
}

function layer_changed() {
    var new_layer = document.getElementById('layer_input').value;
    if (new_layer === current_selected_layer)
        // nothing has changed
        return;

    // if new layer has been selected
    var styles = getAvailableStyles(new_layer);
    var style_selector = document.getElementById('styles');

    var i = 0;
    while (i < style_selector.options.length) {
        style_selector.removeChild(style_selector.options[i]);
    }

    styles.forEach(function (style) {
        var option = document.createElement('option');
        option.value = style;
        style_selector.appendChild(option);
    });

    document.getElementById('style_input').value = styles[0];
    style_changed();
}

function style_changed() {
    var new_style = document.getElementById('style_input').value;
    if (new_style === current_selected_style)
        // nothing has changed
        return;

    // if new style has been selected
    var style = getStyle(new_style);
    update_map(style);
}

// async function update_map(style){
function update_map(style) {
    // add_background_to_style(style)
    map.setStyle(style);
    // await sleep(2000);
    // map.addLayer(new google.maps.TransitLayer());
}

// Adds a background layer to the map style json
function add_background_to_style(style) {
    style.sources["background"] = {
        "type": "raster",
        "tiles": ["http://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
        // "tiles": ["https://www.googleapis.com/tile/v1/tiles/{z}/{x}/{y}?key=AIzaSyCFan9y3E6XCb_3HE6kbbghfmRTmIgVJ9M"],
        "tileSize": 256
    };
    var first_layer_id = style.layers[0].id;
    style.layers.splice(first_layer_id, 0, {
        "id": "background",
        "type": "raster",
        "source": "background"
    });
}

function getThemeNames(theme_type) {
    var by_themes = 'Biogeography///Abiotic///Demography///Species///Administrative Units///Land Use Land Cover///Conservation';

    var by_geography = 'India///Nilgiri Biosphere Reserve///Western Ghats///BR Hills, Karnataka///Vembanad, Kerala///Bandipur, Karnataka';

    if (theme_type === 1) return by_themes.split('///');else if (theme_type === 2) return by_geography.split('///');
}

function expand_layer_details(layer_id) {
    var expanded_div_id = layer_id + "_expanded";
    var div = document.getElementById(expanded_div_id);
    div.classList.toggle('hide');

    // On first time opening, fetch the thumbnail and show
    var thumb_div = div.getElementsByClassName('layer-thumb')[0];
    if (thumb_div.children.length === 0) {
        //uncomment following to get thumbnails through naksha
        thumb_div.insertAdjacentHTML('afterbegin', "<img src=" + thumbnailsUrl + layer_id + "_thumb.gif onerror='this.src=" + thumbnailsUrl + "no_preview.png' style='width: 100%;height: 100%;'></img>");

        //uncomment following to get thumbnails directly from geoserver
        //thumb_div.insertAdjacentHTML('afterbegin', "<img src=http://" + get_host() + "/geoserver/www/map_thumbnails/" + layer_id +"_thumb.gif></img>")
    }
}

function getFilteredLayers(layers) {
    var groupName = map_props.groupName;
    if (groupName === 'undefined' || groupName === null) return layers; // no filtering required
    var filteredLayers = [];
    if (groupName === 'assambiodiversity') {
        var url = baseUrl + "layer/tags?tag=assam";
        var groupLayers = httpGetAsync(url);
        return layers.filter(function (l) {
            return groupLayers.includes(l.name);
        });
    } else return layers;
}

function populateLayerPanel() {
    var all_layers = getAvailableLayers();
    var layers = getFilteredLayers(all_layers);
    var nav_pane = document.getElementById('nav-all-layers');

    var layer_pane_html = nav_pane.innerHTML;
    layers.forEach(function (layer) {
        layerNameToTitleMap[layer.name] = layer.title;
        layer.thumbnail = "";
        layer_pane_html += "<div class='layer-div no-select'>" + "<div id=" + layer.name + " class='layer-name-div no-select' onclick='expand_layer_details(this.id)'>" + layer.title + "</div>" + "<div id=" + layer.name + "_expanded class='layer-expanded hide'>" + "<div class='layer-thumb'></div>" + "<div class='layer-desc'>" + layer.abstract + "</div>" + "<i id=add_" + layer.name + "_button class='fa fa-plus-circle float-right pointer' onclick='add_layer_to_map(\"" + layer.name + "\",\"" + layer.title + "\",\"" + layer.bbox + "\")' style='font-size:36px;color:green;'></i>" + "<i id=rem_" + layer.name + "_button class='fa fa-minus-circle float-right pointer hide' onclick='remove_layer_from_map(\"" + layer.name + "\")' style='font-size:36px;color:red;'></i>" + "</div>" + "</div>";
    });
    nav_pane.innerHTML = layer_pane_html;
}

function toggleSideBar() {
    document.getElementById("nav").classList.toggle("nav--active");
    document.getElementById("nav").getElementsByClassName('hamburger')[0].classList.toggle("is-active");
}

function toggleFeaturesSideBar() {
    document.getElementById("features-nav").classList.toggle("features-nav--active");
    document.getElementById("features-nav").getElementsByClassName('hamburger')[0].classList.toggle("is-active");
}

function add_layer_to_map(layerName, layerTitle, layerBbox) {

    if (active_layers.indexOf(layerName) !== -1) {
        // layer is already active
        alert("Layer " + layerName + " is already added to map");
        return;
    }
    var allStyles = getAvailableStyles(layerName);
    // allStyles contains extra entry of default style at first position
    var defaultStyle = allStyles.splice(0, 1)[0];
    var style = getStyle(defaultStyle.styleName);
    append_new_style(style);
    addLayerToSelectedTab(layerName, layerTitle, layerBbox, allStyles, defaultStyle, style);
    document.getElementById("add_" + layerName + "_button").classList.toggle('hide');
    document.getElementById("rem_" + layerName + "_button").classList.toggle('hide');
    active_layers.push(layerName);
    // fit bounds to new added layer
    zoomToExtent(layerBbox);
}

function append_new_style(style) {
    Object.keys(style.sources).forEach(function (key) {
        style.sources[key].tiles = [geoserverBaseUrl + "gwc/service/tms/1.0.0/" + getWorkspace() + ":" + style.layers[0].id + "/{z}/{x}/{y}"];
        map.addSource(key, style.sources[key]);
    });

    var topLayer = null;
    if (fixed_layers.length > 0) topLayer = fixed_layers[0];

    style.layers.forEach(function (layer) {
        map.addLayer(layer, topLayer);
    });
}

function zoomToExtent(Bbox) {
    var coord = Bbox.split(',');
    var minx = Number(coord[0]);
    var miny = Number(coord[1]);
    var maxx = Number(coord[2]);
    var maxy = Number(coord[3]);
    var BboxArray = [[minx, miny], [maxx, maxy]];
    var finalBBox = getIntersectionWithHardBounds(BboxArray);
    if (finalBBox) map.fitBounds(finalBBox);
}

function getIntersectionWithHardBounds(Bbox) {
    var hardBounds = map_props.hardBounds;
    if (hardBounds == undefined) return Bbox;

    var left = Math.max(Bbox[0][0], hardBounds[0][0]);
    var right = Math.min(Bbox[1][0], hardBounds[1][0]);

    if (left > right) // no intersection
        return null;

    var down = Math.max(Bbox[0][1], hardBounds[0][1]);
    var up = Math.min(Bbox[1][1], hardBounds[1][1]);

    if (down > up) // no intersection
        return null;

    return [[left, down], [right, up]];
}

function addLayerToSelectedTab(layerName, layerTitle, layerBbox, all_styles, defaultStyle, style) {
    var selectedLayersPanel = document.getElementById('nav-selected-layers');
    var html = selectedLayersPanel.innerHTML;
    var layerType = style.layers[0].type; //circle or fill
    var styleSelectorHTML = "";
    var styleNameToTitleMap = {};
    all_styles.forEach(function (style) {
        styleSelectorHTML += "<option value=" + style.styleName;
        if (style.styleName === defaultStyle.styleName) styleSelectorHTML += " selected";
        styleSelectorHTML += ">" + style.styleTitle + "</option>";
        styleNameToTitleMap[style.styleName] = style.styleTitle;
    });
    layerToStyleOptionsMap[layerName] = styleNameToTitleMap;
    html += "<div id=" + layerName + "_styler class='layer-div no-select'>" + "<div class='row'>" + "<div class='layer-name-div no-select col-sm-7'>" + layerTitle + "</div>" + "<i class='fa fa-minus-circle float-right pointer col-sm-2' onclick='remove_layer_from_map(\"" + layerName + "\")' style='font-size:36px;color:red;'></i>" + "</div>" + "<div class='layer-styler-controls row'>" + "<div class='col-sm-5 zoom-to-extent-div inline' style='background-image:url(" + thumbnailsUrl + "zoom-to-extent.png)' onclick='zoomToExtent(\"" + layerBbox + "\")'>" + "zoom to extent" + "</div>" + "<div style='width: 18%;float: left;font-size: 14px;opacity: 0.5;margin: 0 0 0 3%; padding-left: 0%;' class='col-sm-3'>opacity</div>" + "<div class='slidecontainer inline col-sm-3'>" + "<input id=" + layerName + "_slider class='slider' type='range' min='1' max='100' step='5' value=" + getOpacity(style) + " onchange='setOpacity(\"" + layerName + "\",\"" + layerType + "\", this.value)' oninput='setOpacity(\"" + layerName + "\",\"" + layerType + "\", this.value)'></input>" + "</div>" + "</div>" + "<div style='font-size:14px;'>Style by: " + "<select class='style-selector' onchange='changeLayerStyle(\"" + layerName + "\",this)'>" + styleSelectorHTML + "</select>" + "</div>" + "<div class='legend-div' onclick='toggleLegend(this)'>Legend" + "<i class='fa fa-chevron-right' style='font-size:10px;margin:2%;'></i>" + "</div>" + "<img id='" + layerName + "_legend' class='hide legend' src=" + geoserverBaseUrl + "legend/" + layerName + "/" + all_styles[0].styleName + "></img>" + "</div>";

    selectedLayersPanel.innerHTML = html;
}

function toggleLegend(div) {
    div.parentNode.getElementsByClassName('legend')[0].classList.toggle('hide');
    var legendArrow = div.getElementsByClassName('fa')[0];
    legendArrow.classList.toggle('fa-chevron-down');
    legendArrow.classList.toggle('fa-chevron-right');
}

function changeLayerStyle(layerName, layerStyleSelector) {
    var option = layerStyleSelector.options[layerStyleSelector.selectedIndex];
    var selectedStyle = option.getAttribute('value');
    var highlightedLayer = layerName + '-highlighted';
    map.removeLayer(layerName);
    if (map.getLayer(highlightedLayer)) map.removeLayer(highlightedLayer);
    map.removeSource(layerName);
    append_new_style(getStyle(selectedStyle));

    // update the legend according to new style
    var legend = document.getElementById(layerName + '_legend');
    legend.src = geoserverBaseUrl + "legend/" + layerName + "/" + selectedStyle;
}

function setOpacity(layerName, layerType, opacity) {
    if (map.getLayer(layerName) === undefined) return;
    if (layerType === 'fill') map.setPaintProperty(layerName, 'fill-opacity', opacity / 100);else if (layerType === 'circle') map.setPaintProperty(layerName, 'circle-opacity', opacity / 100);
}

function getOpacity(style) {
    if (style.layers[0].type === "circle") return style.layers[0].paint['circle-opacity'] * 100;else if (style.layers[0].type === "fill") return style.layers[0].paint['fill-opacity'] * 100;else return 70;
}

function remove_layer_from_map(layer_name) {
    var index = active_layers.indexOf(layer_name);
    if (index === -1) {
        alert("Layer " + layer_name + " is not present on the map");
    }
    if (map.getLayer(layer_name + '-highlighted') !== undefined) map.removeLayer(layer_name + '-highlighted');
    map.removeLayer(layer_name);
    map.removeSource(layer_name);
    document.getElementById("add_" + layer_name + "_button").classList.toggle('hide');
    document.getElementById("rem_" + layer_name + "_button").classList.toggle('hide');
    active_layers.splice(index, 1);
    //active_layers.splice(layer_name+'-highlighted', 1);

    // remove the layer styler from selected layers tab
    var element = document.getElementById(layer_name + '_styler');
    if (element !== undefined) element.parentNode.removeChild(element);
}

function openTab(evt, div_name) {
    // Declare all variables
    var i, tabcontent, tablinks;
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.add('hide');
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(div_name).classList.remove('hide');
    evt.currentTarget.className += " active";
}

function filterOutMapboxFeatures(features) {
    // skip if the feature is coming from the mapbox base layers
    var retFeatures = [];
    for (var i = 0; i < features.length; i++) {
        if (features[i].layer.source === 'mapbox' || features[i].layer.source === 'claimedboundaries') continue;
        retFeatures.push(features[i]);
    }
    return retFeatures;
}

function showClickedFeature(event) {
    var _features = map.queryRenderedFeatures(event.point);
    var features = filterOutMapboxFeatures(_features);
    if (!features.length) {
        clear_selected_features();
        if (document.getElementById("features-nav").classList.contains("features-nav--active") === false) toggleFeaturesSideBar();

        return;
    }

    // since there can be multiple selected features for a single layer
    var layerToFeatures = {};
    var layerToFeatureIDs = {};

    for (var i = 0; i < features.length; i++) {
        var feature = features[i];

        var layer = feature.layer.id;
        if (!layerToFeatures[layer]) {
            layerToFeatures[layer] = new Set();
            layerToFeatureIDs[layer] = [];
        }

        if (!layerToFeatureIDs[layer].includes(feature.properties.__mlocate__id)) {
            layerToFeatures[layer].add(feature); //TODO: avoid adding the complete feature object
            layerToFeatureIDs[layer].push(feature.properties.__mlocate__id);
        }
    }

    highlightSelectedFeature(layerToFeatures);
    updateSelectedFeatureTree(layerToFeatures);
    if (document.getElementById("features-nav").classList.contains("features-nav--active")) toggleFeaturesSideBar();
}

function removeHighlightedLayers(map) {

    // clear currently highlighted layers
    map.getStyle().layers.forEach(function (layer) {
        if (layer.id.indexOf('-highlighted') !== -1) {
            if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        }
    });
}

function highlightSelectedFeature(layerToFeatures) {

    removeHighlightedLayers(map);
    Object.keys(layerToFeatures).forEach(function (layer) {
        var features = layerToFeatures[layer];
        var layerType;
        var layerSource;
        var filter = ['in', '__mlocate__id'];
        features.forEach(function (feature) {
            if (!layerType) {
                layerType = feature.layer.type;
                layerSource = feature.layer.source;
            }
            filter.push(feature.properties.__mlocate__id);
        });

        var _type, _paint;
        if (layerType === 'fill') {
            _type = 'line';
            _paint = { 'line-width': 1, 'line-color': 'red' };
        } else if (layerType === 'circle') {
            _type = 'circle';
            _paint = { 'circle-opacity': 0, 'circle-stroke-width': 1, 'circle-stroke-color': 'red' };
        } else if (layerType === 'line') {
            // no highlight needed for line type layers
            return;
        }

        // create a layer for highlighted features
        map.addLayer({
            'id': layer + '-highlighted',
            'type': _type,
            'source': layerSource,
            'source-layer': layerSource,
            'paint': _paint,
            'filter': filter
        });
    });
}

function clear_selected_features() {
    removeHighlightedLayers(map);
    clear_selected_feature_tree();
}

function get_style_by(feature) {
    if (feature.layer.type === "fill") return feature.layer.paint['fill-color'].property;else if (feature.layer.type === "circle") return feature.layer.paint['circle-color'].property;else return null;
}

function clear_selected_feature_tree() {
    document.getElementById('features').innerHTML = "";
}

function updateSelectedFeatureTree(layerToFeatures) {
    var selectedFeaturesJSON = {};
    Object.keys(layerToFeatures).forEach(function (layer) {
        var features = layerToFeatures[layer];
        selectedFeaturesJSON[layerNameToTitleMap[layer]] = [];
        features.forEach(function (feature) {
            var attributes = filterAttributes(feature);
            selectedFeaturesJSON[layerNameToTitleMap[layer]].push(attributes);
        });
    });
    document.getElementById('features').innerHTML = createFeatureTreeHTML(selectedFeaturesJSON);
}

function createFeatureTreeHTML(selectedFeaturesJSON) {
    var expandedDivs = [];
    var divs = document.getElementById('features').getElementsByClassName('tree-expandable');
    for (var i = 0; i < divs.length; i++) {
        if (divs[i].getElementsByClassName('expanded').length > 0) expandedDivs.push(divs[i].children[0].innerText);
    };

    var retValue = "";
    for (var key in selectedFeaturesJSON) {
        var hiddenClass = expandedDivs.includes(key) ? 'expanded' : 'hide';
        retValue += "<div class='tree-expandable'>";
        retValue += "<div class='pointer no-select' onclick='toggleAllChildren(this.parentElement)'>" + key + "</div>";
        retValue += "<div class='card-details " + hiddenClass + "'>";
        retValue += renderJSON(selectedFeaturesJSON[key]);
        retValue += "</div></div>";
    }
    return retValue;
}

function filterAttributes(feature) {
    var filteredAttributes = {};
    var layerName = feature.layer.id;
    for (var key in feature.properties) {
        if (key.startsWith("__")) continue;else if (layerToStyleOptionsMap[layerName][layerName + '_' + key] !== undefined) filteredAttributes[layerToStyleOptionsMap[layerName][layerName + '_' + key]] = feature.properties[key];else filteredAttributes[key] = feature.properties[key];
    }
    return filteredAttributes;
}

function renderJSON(objList) {
    var retValue = "";
    for (var i = 0; i < objList.length; i++) {
        var obj = objList[i];
        for (var key in obj) {
            if (key.startsWith("__")) continue;
            retValue += "<div class='tree-node'>" + key + " : " + obj[key] + "</div>";
        }
        if (i !== objList.length - 1) retValue += "<hr class='separator'>";
    }
    return retValue;
}

function toggleAllChildren(div) {
    if (!div.hasChildNodes()) return;
    div.children[1].classList.toggle('hide');
    div.children[1].classList.toggle('expanded');
    return;
}

function set_initial_zoom(map) {
    initial_zoom = map.getZoom();
}

function syncMaps(master, google_map) {
    var center = master.getCenter();
    var zoom = master.getZoom();

    google_map.setCenter(center);
    google_map.setZoom(zoom + 1);

    // now if zoom level was non-integer, the google map
    // would have become blank.
    var new_zoom;
    if (zoom > initial_zoom) new_zoom = Math.ceil(zoom);else new_zoom = Math.floor(zoom);

    if (new_zoom === zoom) return;else {
        master.setZoom(new_zoom);
        google_map.setZoom(new_zoom + 1);
    }
}

function sync_map_move(map, gmap) {
    var center = map.getCenter();
    gmap.setCenter(center);
}

exports.default = {
    toggleSideBar: toggleSideBar,
    toggleFeaturesSideBar: toggleFeaturesSideBar,
    openTab: openTab,
    initMap: initMap
};


window.initMap = initMap;
window.initGoogleMap = initGoogleMap;
window.initMapboxglMap = initMapboxglMap;
window.getWorkspace = getWorkspace;
window.get_map_style = get_map_style;
window.set_map_style = set_map_style;
window.getStyle = getStyle;
window.getAvailableStyles = getAvailableStyles;
window.httpGetAsync = httpGetAsync;
window.getAvailableLayers = getAvailableLayers;
window.getLayerInfo_WMS_3 = getLayerInfo_WMS_3;
window.getLatLonBBoxString = getLatLonBBoxString;
window.layer_changed = layer_changed;
window.style_changed = style_changed;
window.update_map = update_map;
window.add_background_to_style = add_background_to_style;
window.getThemeNames = getThemeNames;
window.expand_layer_details = expand_layer_details;
window.populateLayerPanel = populateLayerPanel;
window.toggleSideBar = toggleSideBar;
window.add_layer_to_map = add_layer_to_map;
window.append_new_style = append_new_style;
window.addLayerToSelectedTab = addLayerToSelectedTab;
window.getOpacity = getOpacity;
window.remove_layer_from_map = remove_layer_from_map;
window.openTab = openTab;
window.showClickedFeature = showClickedFeature;
window.highlightSelectedFeature = highlightSelectedFeature;
window.clear_selected_features = clear_selected_features;
window.get_style_by = get_style_by;
window.clear_selected_feature_tree = clear_selected_feature_tree;
window.updateSelectedFeatureTree = updateSelectedFeatureTree;
window.renderJSON = renderJSON;
window.toggleAllChildren = toggleAllChildren;
window.set_initial_zoom = set_initial_zoom;
window.syncMaps = syncMaps;
window.sync_map_move = sync_map_move;
window.SyncGoogleAndMapboxglMaps = SyncGoogleAndMapboxglMaps;
window.changeBaseLayer = changeBaseLayer;
window.zoomToExtent = zoomToExtent;
window.setOpacity = setOpacity;
window.changeLayerStyle = changeLayerStyle;
window.toggleLegend = toggleLegend;
window.toggleFeaturesSideBar = toggleFeaturesSideBar;