const GeoJSONLayer = await $arcgis.import("@arcgis/core/layers/GeoJSONLayer.js");
const Collection = await $arcgis.import("@arcgis/core/core/Collection.js");
const classBreaks = await $arcgis.import(
    "@arcgis/core/smartMapping/statistics/classBreaks.js"
);
const ClassBreaksRenderer = await $arcgis.import(
    "@arcgis/core/renderers/ClassBreaksRenderer.js"
);
const Color = await $arcgis.import("@arcgis/core/Color.js");
const colorRamps = await $arcgis.import(
    "@arcgis/core/smartMapping/symbology/support/colorRamps.js"
);

async function loadIncidentReports({type = null, status = null, district_id = null, as_geojson = null} = {}) {
    const filters = {
        status: status,
        type: type,
        district_id: district_id,
        as_geojson: as_geojson
    };

    const params = new URLSearchParams(
        Object.entries(filters).filter(([key, value]) => value != null)
    );

    const response = await fetch(`http://127.0.0.1:8000/api/incidents?${params.toString()}`);
    const data = await response.json()
    
    return data;
}

async function loadIncidentReportStats({district_id = null} = {}) {
    const filters = {
        district_id: district_id,
    };

    const params = new URLSearchParams(
        Object.entries(filters).filter(([key, value]) => value != null)
    );

    const response = await fetch(`http://127.0.0.1:8000/api/incidents/stats?${params.toString()}`);
    const data = await response.json()
    
    return data;
}

async function loadList(layer) {
    const layerFeatures = await layer.queryFeatures({
        where: "1=1",
        outFields: ["*"],
        returnGeometry: true
    });

    const list = document.getElementById("list-group");
    list.replaceChildren();

    layerFeatures.features.forEach(feature => {
        console.log(feature.attributes);
        const item = document.createElement("calcite-list-item");
        item.label = feature.attributes.type + " | " + feature.attributes.status;
        item.description = feature.attributes.address;
        item.value = feature;

        const content = document.createElement("div");
        content.slot = "content";
        content.innerHTML = `
            <strong>${feature.attributes.type}</strong> | ${feature.attributes.status} <br>
            <i>${feature.attributes.address}, ${feature.attributes.city}, ${feature.attributes.state}</i>
        `;
        item.appendChild(content);
        const icon = document.createElement("calcite-icon");
        switch (feature.attributes.type) {
            case "Fire":
                icon.icon = "fire-index";
                break;
            case "Power":
                icon.icon = "battery-charging";
                break;
            case "Fallen Tree":
                icon.icon = "tree";
                break;
            case "Flood":
                icon.icon = "water-drop";
                break;
            default:
                icon.icon = "exclamation-mark-triangle";
                break;
        }
        icon.slot = "content-start";
        const timestamp = document.createElement("span");
        timestamp.slot = "content-end";
        const time = new Date(feature.attributes.report_timestamp);
        timestamp.textContent = time.toLocaleString();
        item.appendChild(icon);
        item.appendChild(timestamp);
        list.appendChild(item);
    });
}

function geoJSONtoLayer(geojson, id, title, geometryType = "point") {
    const blob = new Blob([JSON.stringify(geojson)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const layer = new GeoJSONLayer({
        id: id,
        title: title,
        url: url,
        geometryType: geometryType
    });
    layer.outFields = ["*"];
    return layer;
}

const mapElement = document.querySelector("arcgis-map");
await mapElement.viewOnReady();

const mapView = mapElement.view;
const highlights = mapElement.highlights;
mapElement.highlights = new Collection([
    {name: "incident", color: "#00ffff", fillOpacity: 0},
    {name: "district", color: "#00ffff", fillOpacity: 0}
]);

// Load districts layer
const response = await fetch("http://127.0.0.1:8000/api/districts");
const data = await response.json();
const districtsLayer = geoJSONtoLayer(data, "districts", "Districts", "polygon");
const districtsRenderer = {
    type: "simple",
    symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0],
        outline: {
            color: [0, 0, 0, 1],
            width: 1,
            style: "solid"
        }
    }
};
districtsLayer.renderer = districtsRenderer;
mapElement.map.add(districtsLayer);

// Load incidents layer
const incidents_geojson = await loadIncidentReports({as_geojson: true});
const layer = geoJSONtoLayer(incidents_geojson, "incidents", "Incident Reports");
const typeRenderer = {
    type: "unique-value",
    field: "type",
    defaultSymbol: {
        type: "simple-marker",
        color: "gray",
        size: 10
    },
    uniqueValueInfos: [
        {
            value: "Fire",
            symbol: {
                type: "simple-marker",
                color: "#94360E",
                size: 10
            }
        },
        {
            value: "Power",
            symbol: {
                type: "simple-marker",
                color: "#D8CB14",
                size: 10
            }
        },
        {
            value: "Fallen Tree",
            symbol: {
                type: "simple-marker",
                color: "#199720",
                size: 10
            }
        },
        {
            value: "Flood",
            symbol: {
                type: "simple-marker",
                color: "#005380",
                size: 10
            }
        }
    ]
};
const statusRenderer = {
    type: "unique-value",
    field: "status",
    defaultSymbol: {
        type: "simple-marker",
        color: "gray",
        size: 10
    },
    uniqueValueInfos: [
        {
            value: "Pending Assistance",
            symbol: {
                type: "simple-marker",
                color: "#94130e",
                size: 10
            }
        },
        {
            value: "Help Requested",
            symbol: {
                type: "simple-marker",
                color: "#d87914",
                size: 10
            }
        },
        {
            value: "Unit in Response",
            symbol: {
                type: "simple-marker",
                color: "#bc9a12",
                size: 10
            }
        },
        {
            value: "Resolved",
            symbol: {
                type: "simple-marker",
                color: "#5fb108",
                size: 10
            }
        }
    ]
};
await layer.load();
await loadList(layer);layer.renderer = typeRenderer;
mapElement.map.add(layer);
var activeLayer = layer;

let statusType = "type";
let type = null;
let status = null;
let districtReport = "report";

// Retrieve type or status corresponding with selected card
function selectedCardToTypeStatus(selectedCard) {
    if (selectedCard == null) return null;
    if (statusType === "type") {
        return selectedCard.id === "card-1" ? "Fire"
                : selectedCard.id === "card-2" ? "Power"
                : selectedCard.id === "card-3" ? "Fallen Tree"
                : selectedCard.id === "card-4" ? "Flood"
                : null;
    }
    return selectedCard.id === "card-1" ? "Pending Assistance"
            : selectedCard.id === "card-2" ? "Help Requested"
            : selectedCard.id === "card-3" ? "Unit in Response"
            : selectedCard.id === "card-4" ? "Resolved"
            : null;
}

function getColorScheme(label) {
    switch (label) {
        case "Fire":
            return ["Red 3", false];
        case "Power":
            return ["Esri Yellow 1", true];
        case "Fallen Tree":
            return ["Green 4", false];
        case "Flood":
            return ["Blue 3", false];
        default:
            return ["Gray 1", false];
    }
}

var selectedCard = null;
var selectedDistrict = null;

async function getRenderer(layer = null) {
    let field;
    if (type != null) {
        switch (type) {
            case "Fire":
                field = "fire_count";
                break;
            case "Power":
                field = "power_count";
                break;
            case "Fallen Tree":
                field = "tree_count";
                break;
            case "Flood":
                field = "flood_count";
                break;
        }
    }
    else if (status != null) {
        switch (status) {
            case "Pending Assistance":
                field = "pending_count";
                break;
            case "Help Requested":
                field = "requested_count";
                break;
            case "Unit in Response":
                field = "in_response_count";
                break;
            case "Resolved":
                field = "resolved_count";
                break;
        }
    }
    else {
        field = "total_incidents";
    }
    if (districtReport === "district") {
        await layer.load();

        let colorScheme = [];

        const [ramp, reverse] = getColorScheme(selectedCard === null ? "" : selectedCardToTypeStatus(selectedCard));
        colorScheme = colorRamps.byName(ramp);
        colorScheme = colorScheme.colorsForClassBreaks
            .find(c => c.numClasses === 5)
            .colors;
        colorScheme = reverse ? colorScheme.reverse() : colorScheme;

        const result = await classBreaks({
            layer,
            field,
            classificationMethod: "natural-breaks",
            numClasses: 5
        });

        const renderer = new ClassBreaksRenderer({
            field,
            classBreakInfos: result.classBreakInfos.map((info, i) => ({
                ...info,
                symbol: {
                    type: "simple-fill",
                    color: colorScheme[i],
                    outline: {color: "#000000", width: 0.5}
                }
            }))
        });
        return renderer;
    }
    else {
        return statusType === "type" ? typeRenderer : statusRenderer;
    }
}

async function updateMapAndTable() {
    let result;
    let layer;
    if (districtReport == "report") {
        result = await loadIncidentReports({as_geojson: true, type: type, status: status, district_id: selectedDistrict});
        layer = geoJSONtoLayer(result, "incidents", "Incident Reports");
    }
    else {
        const response = await fetch("http://127.0.0.1:8000/api/districts?include_counts=True");
        const data = await response.json();
        layer = geoJSONtoLayer(data, "districts_styled", "Districts", "polygon");
    }
    await layer.load();
    const rendererResult = await getRenderer(layer);

    layer.renderer = rendererResult;
    // table.highlightIds.removeAll();
    // table.layer = null;

    mapElement.map.remove(activeLayer);
    mapElement.map.add(layer);

    activeLayer = layer;
    
    await layer.load();

    console.log("Updated map");
    // table.layer = layer;
    // table.hiddenFields = ["__OBJECTID"];    

    await loadList(layer);
}

// Card event listener, fetch new GeoJSON based on type clicked
async function handleCardClick(event) {
    if (selectedCard != null) selectedCard.classList.toggle("selected");
    let selectedSameCard = false;

    if (selectedCard == event.currentTarget) {
        selectedSameCard = true;
        type = null;
        status = null;
    }
    else {
        selectedCard = event.currentTarget;
        selectedCard.classList.toggle("selected");    

        if (statusType === "type") type = selectedCardToTypeStatus(selectedCard);
        else if (statusType === "status") status = selectedCardToTypeStatus(selectedCard);
    }

    await updateMapAndTable();

    if (selectedSameCard) {
        selectedCard = null;
    }
}

// Add event handler to cards
document.querySelectorAll('[id^="card-"]').forEach(card => {
    card.addEventListener("click", handleCardClick);
});

// Update incident type stats
async function updateIncidentStats(district_id = null) {
    const type_labels = ["Fires", "Power Outages", "Fallen Trees", "Floods"];
    const count_fields = statusType === "type" ? ["fire_count", "power_count", "tree_count", "flood_count"] :
                                                 ["pending_count", "requested_count", "in_response_count", "resolved_count"];
    
    const labels = statusType === "type" ? ["Fires", "Power Outages", "Fallen Trees", "Floods"] : 
                                           ["Pending Assistance", "Help Requested", "Unit in Response", "Resolved"];
    
    const incident_stats = await loadIncidentReportStats({district_id: district_id});
    document.querySelectorAll('[id^="card-"]').forEach((card, index) => {
        const elements = [...card.querySelectorAll("p")]
        elements[0].textContent = incident_stats[0][count_fields[index]];
        elements[1].textContent = labels[index];
    });
}
await updateIncidentStats();

// Toggle listener
const statusTypeSwitch = document.getElementById("status-type-switch");
statusTypeSwitch.addEventListener("click", async function(event) {
    statusType = statusType === "type" ? "status" : "type";  

    if (selectedCard != null) {
        selectedCard.classList.toggle("selected");
        type = null;
        status = null;
        selectedCard = null;
    }

    if (statusType === "type") type = selectedCardToTypeStatus(selectedCard);
    else if (statusType === "status") status = selectedCardToTypeStatus(selectedCard);

    const colorList = statusType === "type" ? ["#94360E", "#D8CB14", "#199720", "#005380"] : 
                                              ["#94130e", "#d87914", "#bc9a12", "#5fb108"]
    document.querySelectorAll('[id^="card-"]').forEach((card, index) => {
        card.style.backgroundColor = colorList[index];
    });

    await updateMapAndTable();
    await updateIncidentStats();
});

// Update display when feature selected in map
let highlightHandle;
let incidentHighlight = null;
let districtHighlight = null;

const districtReportSwitch = document.getElementById("district-report-switch");
districtReportSwitch.addEventListener("click", async function(event) {
    districtReport = districtReport === "district" ? "report" : "district";
    incidentHighlight?.remove();
    incidentHighlight = null;
    await updateMapAndTable();
    await updateIncidentStats();
});

const layerView = await mapElement.view.whenLayerView(layer); 
mapElement.addEventListener("arcgisViewClick", async (event) => {
    // Get topmost feature that was clicked on
    const incidents = mapElement.map.findLayerById("incidents");
    const districts = mapElement.map.findLayerById("districts");
    const districtsStyled = mapElement.map.findLayerById("districts_styled");

    const response = await mapElement.hitTest(event.detail, {
        include: [districtsStyled, incidents, districts].filter(Boolean)
    });

    const result = response.results.find(r => 
        r.type === "graphic" && r.graphic.layer.id === "districts_styled"
    ) ?? response.results.find(r => 
        r.type === "graphic" && r.graphic.layer.id === "incidents"
    ) ?? response.results.find(r => 
        r.type === "graphic" && r.graphic.layer.id === "districts"
    );
   
    if (!result) return;

    const layer = result.graphic.layer;
    const layerView = await mapElement.view.whenLayerView(layer);

    // Highlight selected incident on map and table and update information card
    if (layer.id === "incidents") {
        incidentHighlight?.remove();
        incidentHighlight = layerView.highlight(result.graphic, {"name": "incident"});
        const objectId = result.graphic.getObjectId();

        const list = document.getElementById("list-group");
        const listItem = [...list.querySelectorAll("calcite-list-item")].find(item => item.value?.attributes?.report_id === result.graphic.attributes.report_id);
        if (listItem) {
            listItem.selected = true;
            listItem.scrollIntoView({behavior: "smooth",block: "center"});
        }

        const reportDetails = document.getElementById("report-details-text");
        const reportAttributes = result.graphic.attributes;
        const text = `<strong>Type</strong>: ${reportAttributes.type}

        <strong>Status</strong>: ${reportAttributes.status}

        <strong>Description</strong>: ${reportAttributes.description}`
        reportDetails.innerHTML = text;

        const image = document.getElementById("report-details-image");
        image.src = reportAttributes.image_url;
        const deleteReportID = document.getElementById("delete-report-id");
        deleteReportID.value = String(reportAttributes.report_id);
    }
    // Highlight selected district on map
    else if (layer.id === "districts") {
        const graphic = result.graphic;
        const feature = await graphic.layer.queryFeatures({
            objectIds: [graphic.getObjectId()],
            outFields: ["*"],
            returnGeometry: false
        });
        const currentSelectedDistrict = feature.features[0].attributes["district_id"];

        // Highlight new district selection if differs from previous selection, load incidents in district
        if (currentSelectedDistrict != selectedDistrict) {
            districtHighlight?.remove();
            districtHighlight = layerView.highlight(result.graphic, {"name": "district"});

            // Load incidents in district
            const incidentsInDistrict = await loadIncidentReports({type: type, status: status, district_id: currentSelectedDistrict, as_geojson: true});
            const incidentsInDistrictLayer = geoJSONtoLayer(incidentsInDistrict, "incidents", "Incident Reports");
            incidentsInDistrictLayer.renderer = statusType === "type" ? typeRenderer : statusRenderer;

            incidentHighlight?.remove();
            incidentHighlight = null;

            mapElement.map.remove(activeLayer);
            mapElement.map.add(incidentsInDistrictLayer);

            activeLayer = incidentsInDistrictLayer;
            selectedDistrict = currentSelectedDistrict;
            
            await incidentsInDistrictLayer.load();
            await updateIncidentStats(currentSelectedDistrict);
            selectedDistrict = currentSelectedDistrict;
        }
        // Remove highlight from district if clicked again, reload all incidents
        else {
            districtHighlight?.remove();

            const incidentsInDistrict = await loadIncidentReports({type: type, status: status, as_geojson: true});
            const incidentsInDistrictLayer = geoJSONtoLayer(incidentsInDistrict, "incidents", "Incident Reports");
            const rendererResult = await getRenderer(incidentsInDistrictLayer);
            incidentsInDistrictLayer.renderer = rendererResult;

            mapElement.map.remove(activeLayer);
            mapElement.map.add(incidentsInDistrictLayer);

            activeLayer = incidentsInDistrictLayer;
            selectedDistrict = null;
            
            await incidentsInDistrictLayer.load();
            await updateIncidentStats();
        }
    }
    // Highlight selected district on choropleth map
    else {
        const graphic = result.graphic;
        const feature = await graphic.layer.queryFeatures({
            objectIds: [graphic.getObjectId()],
            outFields: ["*"],
            returnGeometry: false
        });
        const currentSelectedDistrict = feature.features[0].attributes["district_id"];

        // Highlight new district
        if (currentSelectedDistrict != selectedDistrict) {
            districtHighlight?.remove();
            districtHighlight = layerView.highlight(result.graphic, {"name": "district"});

            incidentHighlight?.remove();
            incidentHighlight = null;

            selectedDistrict = currentSelectedDistrict;
        }
        // Remove highlight from previously highlighted district
        else {
            districtHighlight?.remove();
            selectedDistrict = null;
        }
    }
});

const deleteButton = document.getElementById("delete-report-button");
deleteButton.addEventListener("click", function(event) {
    const deleteDialog = document.getElementById("delete-dialog");
    deleteDialog.open = true;
});

const dialogDeleteButton = document.getElementById("dialog-delete-button");
dialogDeleteButton.addEventListener("click", function(event) {
    const reportToDelete = document.getElementById("delete-report-id").value;
    let reportID = parseInt(reportToDelete);

    fetch(`http://127.0.0.1:8000/api/incident-reports/${reportID}`, {
        method: "DELETE"
    })
    .then(response => {
        if (response.ok) {
            console.log(`Report ${reportID} deleted successfully`);
        }
        else {
            console.log(`Report ${reportID} not deleted due to error`);
        }
    })
    .catch(error => console.error("Error:", error));

    const deleteDialog = document.getElementById("delete-dialog");
    deleteDialog.open = false;
})

const list = document.getElementById("list-group");
list.addEventListener("calciteListItemSelect", async function(event) {
    const feature = event.target.value;
    console.log("Selected");
    console.log(feature);

    const layerView = await mapView.whenLayerView(activeLayer);
    incidentHighlight?.remove();
    incidentHighlight = layerView.highlight(feature, {"name": "incident"});
    console.log(incidentHighlight);

    const reportDetails = document.getElementById("report-details-text");
    const reportAttributes = feature.attributes;
    const text = `<strong>Type</strong>: ${reportAttributes.type}

    <strong>Status</strong>: ${reportAttributes.status}

    <strong>Description</strong>: ${reportAttributes.description}`
    reportDetails.innerHTML = text;

    const image = document.getElementById("report-details-image");
    image.src = reportAttributes.image_url;
    const deleteReportID = document.getElementById("delete-report-id");
    deleteReportID.value = String(reportAttributes.report_id);
});
