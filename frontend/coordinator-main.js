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

let districtReport = "report";
let incidentSortAscending = false;

const sortIncidentsButton = document.getElementById("sort-incidents-button");
const sortIncidentsIcon = document.getElementById("sort-incidents-icon");

function sortIncidentList() {
    const list = document.getElementById("list-group");
    const items = [...list.querySelectorAll("calcite-list-item")];
    items.sort((a, b) => {
        const timeA = new Date(a.value.attributes.report_timestamp).getTime();
        const timeB = new Date(b.value.attributes.report_timestamp).getTime();
        return incidentSortAscending ? timeA - timeB : timeB - timeA;
    });
    list.replaceChildren(...items);
}

function updateIncidentSortControl() {
    sortIncidentsButton.hidden = districtReport !== "report";
    const direction = incidentSortAscending ? "ascending" : "descending";
    sortIncidentsButton.setAttribute("aria-label", `Sort incidents by time ${direction}`);
    sortIncidentsButton.title = `Sort incidents by time ${direction}`;
    sortIncidentsIcon.icon = incidentSortAscending ? "sort-ascending" : "sort-descending";
}

sortIncidentsButton.addEventListener("click", () => {
    incidentSortAscending = !incidentSortAscending;
    updateIncidentSortControl();
    sortIncidentList();
});

async function loadList(layer) {
    const layerFeatures = await layer.queryFeatures({
        where: "1=1",
        outFields: ["*"],
        returnGeometry: true
    });

    const list = document.getElementById("list-group");
    list.replaceChildren();

    const heading = document.getElementById("list-heading");

    updateIncidentSortControl();

    if (districtReport === "report") {
        heading.textContent = "Incidents";
        layerFeatures.features.forEach(feature => {
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
        sortIncidentList();
    }
    else {
        heading.textContent = "Districts";
        layerFeatures.features.forEach(feature => {
            const item = document.createElement("calcite-list-item");
            console.log(feature.attributes);
            item.label = feature.attributes.district_name;
            item.description = feature.attributes.address;
            item.value = feature;

            const content = document.createElement("div");
            content.slot = "content";
            content.innerHTML = `
                <strong>${feature.attributes.district_name}</strong> | Total Incidents: ${feature.attributes.total_incidents} <br>
                <i>Fires: ${feature.attributes.fire_count} | Power Outages: ${feature.attributes.power_count} | Fallen Trees: ${feature.attributes.tree_count} | Floods: ${feature.attributes.flood_count}</i>
            `;
            item.appendChild(content);
            const icon = document.createElement("calcite-icon");
            icon.icon = "number-of-territories";
            icon.slot = "content-start";
            item.appendChild(icon);
            list.appendChild(item);
        });
    }
    
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

const user = document.getElementById("nav-user");
const userDetailsResponse = await fetch("/api/me");
const userDetails = await userDetailsResponse.json();
user.username = userDetails.first_name + " " + userDetails.last_name;

const logout = document.getElementById("logout");
logout.addEventListener("click", async function(event) {
    // Implement logout functionality here
    console.log("Logout clicked");
    const response = await fetch("/api/logout", {method: 'POST'});
    if (response.redirected) {
        window.location.replace(response.url);
    }
});

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
await loadList(layer);
layer.renderer = typeRenderer;
mapElement.map.add(layer);
var activeLayer = layer;

let statusType = "type";
let type = null;
let status = null;

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
        case "Pending Assistance":
            return ["Red 3", false];
        case "Help Requested":
            return ["Orange 2", false];
        case "Unit in Response":
            return ["Esri Yellow 1", true];
        case "Resolved":
            return ["Green 4", false];
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

    mapElement.map.remove(activeLayer);
    mapElement.map.add(layer);

    activeLayer = layer;
    
    await layer.load();

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
let selectedReportId = null;
let selectedReportAttributes = null;
let syncingDistrictListSelection = false;

function selectDistrictListItem(districtId) {
    const listItems = document.querySelectorAll("#list-group calcite-list-item");
    syncingDistrictListSelection = true;
    try {
        listItems.forEach(item => {
            const isSelected = districtId != null &&
                String(item.value?.attributes?.district_id) === String(districtId);
            item.selected = isSelected;
            if (isSelected) item.scrollIntoView({behavior: "smooth", block: "center"});
        });
    } finally {
        syncingDistrictListSelection = false;
    }
}

function clearSelectedDistrict(clearList = true) {
    districtHighlight?.remove();
    districtHighlight = null;
    selectedDistrict = null;
    if (clearList) selectDistrictListItem(null);
}

function clearSelectedReport() {
    incidentHighlight?.remove();
    incidentHighlight = null;
    selectedReportId = null;
    selectedReportAttributes = null;
    document.getElementById("help-request-action-button").textContent = "Create Request";

    selectDistrictListItem(null);

    document.getElementById("report-details-card").classList.add("empty");
    document.getElementById("report-details-text").textContent = "Select a report from the list or map to view its details.";
    document.getElementById("report-details-image").removeAttribute("src");
}

const districtReportSwitch = document.getElementById("district-report-switch");
districtReportSwitch.addEventListener("click", async function(event) {
    districtReport = districtReport === "district" ? "report" : "district";
    clearSelectedReport();
    clearSelectedDistrict();
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
        const reportId = result.graphic.attributes.report_id;
        if (selectedReportId === reportId) {
            clearSelectedReport();
            return;
        }

        incidentHighlight?.remove();
        incidentHighlight = layerView.highlight(result.graphic, {"name": "incident"});
        selectedReportId = reportId;
        const objectId = result.graphic.getObjectId();

        const list = document.getElementById("list-group");
        const listItem = [...list.querySelectorAll("calcite-list-item")].find(item => item.value?.attributes?.report_id === result.graphic.attributes.report_id);
        if (listItem) {
            listItem.selected = true;
            listItem.scrollIntoView({behavior: "smooth",block: "center"});
        }

        const reportDetails = document.getElementById("report-details-text");
        const reportAttributes = result.graphic.attributes;
        selectedReportAttributes = reportAttributes;
        updateHelpRequestActionButton(reportAttributes);
        document.getElementById("report-details-card").classList.remove("empty");
        const text = `<strong>Type</strong>: ${reportAttributes.type}

        <strong>Status</strong>: ${reportAttributes.status}

        <strong>Description</strong>: ${reportAttributes.description}`
        reportDetails.innerHTML = text;

        const image = document.getElementById("report-details-image");
        image.src = reportAttributes.image_url;
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
            await loadList(incidentsInDistrictLayer);
            await updateIncidentStats(currentSelectedDistrict);
        }
        // Remove highlight from district if clicked again, reload all incidents
        else {
            clearSelectedDistrict();

            const incidentsInDistrict = await loadIncidentReports({type: type, status: status, as_geojson: true});
            const incidentsInDistrictLayer = geoJSONtoLayer(incidentsInDistrict, "incidents", "Incident Reports");
            const rendererResult = await getRenderer(incidentsInDistrictLayer);
            incidentsInDistrictLayer.renderer = rendererResult;

            mapElement.map.remove(activeLayer);
            mapElement.map.add(incidentsInDistrictLayer);

            activeLayer = incidentsInDistrictLayer;
            
            await incidentsInDistrictLayer.load();
            await loadList(incidentsInDistrictLayer);
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
            selectDistrictListItem(currentSelectedDistrict);
            await updateIncidentStats(currentSelectedDistrict);
        }
        // Remove highlight from previously highlighted district
        else {
            clearSelectedDistrict();
            await updateIncidentStats();
        }
    }
});

const deleteDialog = document.getElementById("delete-dialog");
const deleteButton = document.getElementById("delete-report-button");
deleteButton.addEventListener("click", function(event) {
    if (selectedReportId == null || selectedReportAttributes == null) return;

    const reportDetails = document.getElementById("delete-report-details");
    reportDetails.replaceChildren();
    [
        ["Type", selectedReportAttributes.type],
        ["Address", selectedReportAttributes.address],
        ["Status", selectedReportAttributes.status],
        ["Description", selectedReportAttributes.description]
    ].forEach(([label, value]) => {
        const row = document.createElement("p");
        const labelElement = document.createElement("strong");
        labelElement.textContent = `${label}: `;
        row.append(labelElement, document.createTextNode(value ?? "Not provided"));
        reportDetails.appendChild(row);
    });
    deleteDialog.open = true;
});

["dialog-back-button", "dialog-cancel-button"].forEach(buttonId => {
    document.getElementById(buttonId).addEventListener("click", function() {
        deleteDialog.open = false;
    });
});

const dialogDeleteButton = document.getElementById("dialog-delete-button");
dialogDeleteButton.addEventListener("click", function(event) {
    if (selectedReportId == null) return;
    const reportID = selectedReportId;

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

    deleteDialog.open = false;
})

const list = document.getElementById("list-group");
list.addEventListener("calciteListItemSelect", async function(event) {
    if (syncingDistrictListSelection) return;

    if (districtReport === "district") {
        const item = event.target;
        if (!item.selected) {
            if (String(item.value?.attributes?.district_id) === String(selectedDistrict)) {
                clearSelectedDistrict(false);
            }
            return;
        }

        const feature = item.value;
        const districtId = feature.attributes.district_id;
        districtHighlight?.remove();
        const layerView = await mapView.whenLayerView(activeLayer);
        districtHighlight = layerView.highlight(feature, {"name": "district"});
        selectedDistrict = districtId;
        return;
    }

    if (districtReport !== "report") return;

    const feature = event.target.value;
    console.log("Selected");
    console.log(feature);

    const layerView = await mapView.whenLayerView(activeLayer);
    incidentHighlight?.remove();
    incidentHighlight = layerView.highlight(feature, {"name": "incident"});
    selectedReportId = feature.attributes.report_id;
    console.log(incidentHighlight);

    const reportDetails = document.getElementById("report-details-text");
    const reportAttributes = feature.attributes;
    selectedReportAttributes = reportAttributes;
    updateHelpRequestActionButton(reportAttributes);
    document.getElementById("report-details-card").classList.remove("empty");
    const text = `<strong>Type</strong>: ${reportAttributes.type}

    <strong>Status</strong>: ${reportAttributes.status}

    <strong>Description</strong>: ${reportAttributes.description}`
    reportDetails.innerHTML = text;

    const image = document.getElementById("report-details-image");
    image.src = reportAttributes.image_url;
});



const menuItems = document.querySelectorAll("calcite-menu-item[data-section]");
const sections = document.querySelectorAll(".dashboard-section");

let helpRequestsLoaded = false;
let helpRequestsLoadPromise = null;

function updateHelpRequestActionButton(reportAttributes) {
    const button = document.getElementById("help-request-action-button");
    button.textContent = reportAttributes.status === "Pending Assistance"
        ? "Create Request"
        : "View Request";
}

async function loadHelpRequests() {
    const [requestsResponse, countsResponse] = await Promise.all([
        fetch("/api/help-requests"),
        fetch("/api/help-requests/counts")
    ]);
    if (!requestsResponse.ok || !countsResponse.ok) {
        throw new Error("Unable to load help requests.");
    }

    const [helpRequests, helpRequestsCounts] = await Promise.all([
        requestsResponse.json(),
        countsResponse.json()
    ]);

    const helpRequestsList = document.getElementById("requests-list-group");
    helpRequestsList.replaceChildren();
    helpRequests.forEach(request => {
        const item = document.createElement("calcite-list-item");
        item.label = request.request_status;
        item.description = request.request_timestamp;
        item.value = request;

        const content = document.createElement("div");
        content.slot = "content";
        content.innerHTML = `
            <strong>${request.type}</strong> | ${request.request_status}
        `;
        item.appendChild(content);
        const icon = document.createElement("calcite-icon");
        icon.icon = "star";
        icon.slot = "content-start";
        item.appendChild(icon);
        const timestamp = document.createElement("span");
        timestamp.slot = "content-end";
        timestamp.textContent = new Date(request.request_timestamp).toLocaleString();
        item.appendChild(timestamp);
        helpRequestsList.appendChild(item);
    });

    new Chart(
        document.getElementById("helpRequestCountsChart"),
        {
            type: "doughnut",
            data: {
                labels: ["Pending", "In Progress", "Completed"],
                datasets: [{
                    data: [helpRequestsCounts[0]["count"], helpRequestsCounts[1]["count"], helpRequestsCounts[2]["count"]],
                    backgroundColor: ["#bc2938", "#e4ad05", "#21903b"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                radius: "70%",
                plugins: {
                    legend: {
                        position: "left",
                        labels: {
                            boxWidth: 12,
                            padding: 8
                        }
                    }
                }
            }
        }
    );
    helpRequestsLoaded = true;
}

async function ensureHelpRequestsLoaded() {
    if (helpRequestsLoaded) return true;
    if (helpRequestsLoadPromise) return helpRequestsLoadPromise;

    const heading = document.getElementById("request-list-heading");
    helpRequestsLoadPromise = (async () => {
        try {
            heading.textContent = "Loading Help Requests...";
            await loadHelpRequests();
            heading.textContent = "Help Requests";
            return true;
        }
        catch (error) {
            console.error("Failed to load help requests:", error);
            heading.textContent = "Unable to load Help Requests";
            const errorItem = document.createElement("calcite-list-item");
            errorItem.label = "Could not load help requests";
            errorItem.description = "Select this tab again to retry.";
            document.getElementById("requests-list-group").replaceChildren(errorItem);
            return false;
        }
        finally {
            helpRequestsLoadPromise = null;
        }
    })();

    return helpRequestsLoadPromise;
}

async function showDashboardSection(target) {
    sections.forEach(section => {
        section.hidden = section.id !== target;
    });
    menuItems.forEach(menuItem => {
        menuItem.active = menuItem.dataset.section === target;
    });

    if (target === "help-requests") {
        return ensureHelpRequestsLoaded();
    }
    return true;
}

menuItems.forEach(item => {
    item.addEventListener('click', async () => {
        await showDashboardSection(item.dataset.section);
    });
});

document.getElementById("help-request-action-button").addEventListener("click", async () => {
    if (!selectedReportAttributes || selectedReportAttributes.status === "Pending Assistance") return;

    const loaded = await showDashboardSection("help-requests");
    if (!loaded) return;

    const requestList = document.getElementById("requests-list-group");
    const requestItem = [...requestList.querySelectorAll("calcite-list-item")]
        .find(item => String(item.value?.report_id) === String(selectedReportId));
    if (!requestItem) {
        console.warn(`No help request found for report ${selectedReportId}.`);
        return;
    }

    requestList.querySelectorAll("calcite-list-item").forEach(item => {
        item.selected = item === requestItem;
    });
    requestItem.scrollIntoView({behavior: "smooth", block: "center"});
});