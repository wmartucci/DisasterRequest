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
const coordinatorId = userDetails.role_id;

const logout = document.getElementById("logout");
logout.addEventListener("click", async function(event) {
    try {
        const response = await fetch("/api/logout", {method: "POST"});
        if (!response.ok) {
            throw new Error(`Logout failed with status ${response.status}.`);
        }
        window.location.replace(response.redirected ? response.url : "/login");
    } catch (error) {
        console.error("Failed to sign out:", error);
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
    document.getElementById("status-boxes").classList.toggle("status-mode", statusType === "status");
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
let selectedReportGeometry = null;
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
    selectedReportGeometry = null;
    updateHelpRequestActionButton(null);

    selectDistrictListItem(null);

    document.getElementById("report-details-card").classList.add("empty");
    document.getElementById("report-details-text").textContent = "Select a report from the list or map to view its details.";
    document.getElementById("report-details-image").removeAttribute("src");
}

function renderReportDetails(attributes) {
    const reportDetails = document.getElementById("report-details-text");
    const typeLine = document.createElement("p");
    const typeLabel = document.createElement("strong");
    typeLabel.textContent = "Type: ";
    typeLine.append(typeLabel, document.createTextNode(attributes.type ?? ""));

    const reporterLine = document.createElement("p");
    const reporterLabel = document.createElement("strong");
    reporterLabel.textContent = "Reported by: ";
    const reporterValue = document.createElement("span");
    reporterValue.textContent = "Loading...";
    reporterLine.append(reporterLabel, reporterValue);

    fetch(`/api/incident-reports/${encodeURIComponent(attributes.report_id)}/creator`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Report creator request failed with status ${response.status}.`);
            }
            return response.json();
        })
        .then(creators => {
            if (!reporterLine.isConnected) return;
            reporterValue.textContent = creators[0]?.creator || "Not available";
        })
        .catch(error => {
            console.error("Failed to load report creator:", error);
            if (reporterLine.isConnected) reporterValue.textContent = "Not available";
        });

    const statusLine = document.createElement("p");
    statusLine.className = "report-status-line";
    const statusLabel = document.createElement("strong");
    statusLabel.textContent = "Status: ";
    const statusValue = document.createElement("span");
    statusValue.className = "report-status-value";
    statusValue.textContent = attributes.status ?? "";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "report-status-edit";
    editButton.setAttribute("aria-label", "Edit report status");
    editButton.title = "Edit report status";
    const editIcon = document.createElement("calcite-icon");
    editIcon.icon = "pencil";
    editIcon.scale = "s";
    editButton.appendChild(editIcon);
    statusLine.append(statusLabel, statusValue, editButton);

    const statusEditor = document.createElement("span");
    statusEditor.className = "report-status-editor";
    statusEditor.hidden = true;
    const statusSelect = document.createElement("select");
    statusSelect.className = "report-status-select";
    ["Pending Assistance", "Help Requested", "Unit in Response", "Resolved"].forEach(status => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        statusSelect.appendChild(option);
    });
    statusSelect.value = attributes.status;
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "report-status-save";
    saveButton.setAttribute("aria-label", "Save report status");
    saveButton.title = "Save report status";
    const saveIcon = document.createElement("calcite-icon");
    saveIcon.icon = "check";
    saveIcon.scale = "s";
    saveButton.appendChild(saveIcon);
    statusEditor.append(statusSelect, saveButton);
    statusLine.appendChild(statusEditor);

    const descriptionLine = document.createElement("p");
    descriptionLine.className = "report-description-line";
    const descriptionLabel = document.createElement("strong");
    descriptionLabel.textContent = "Description: ";
    descriptionLine.append(descriptionLabel, document.createTextNode(attributes.description ?? ""));

    reportDetails.replaceChildren(typeLine, reporterLine, statusLine, descriptionLine);
}

document.getElementById("report-details-text").addEventListener("click", async event => {
    const editButton = event.target.closest(".report-status-edit");
    if (editButton) {
        const statusLine = editButton.closest(".report-status-line");
        statusLine.querySelector(".report-status-value").hidden = true;
        editButton.hidden = true;
        const statusEditor = statusLine.querySelector(".report-status-editor");
        statusEditor.hidden = false;
        statusEditor.querySelector("select").focus();
        return;
    }

    const saveButton = event.target.closest(".report-status-save");
    if (!saveButton || selectedReportId == null) return;

    const reportId = selectedReportId;
    const statusEditor = saveButton.closest(".report-status-editor");
    const newStatus = statusEditor.querySelector("select").value;
    saveButton.disabled = true;
    try {
        const params = new URLSearchParams({status: newStatus});
        const response = await fetch(
            `/api/incidents/${encodeURIComponent(reportId)}/status?${params}`,
            {method: "PUT"}
        );
        if (!response.ok) {
            throw new Error(`Report status update failed with status ${response.status}.`);
        }
        await response.json();

        await updateMapAndTable();
        await updateIncidentStats(selectedDistrict);

        if (selectedReportId !== reportId) return;
        const refreshedItem = [...document.querySelectorAll("#list-group calcite-list-item")]
            .find(item => String(item.value?.attributes?.report_id) === String(reportId));
        if (!refreshedItem) {
            clearSelectedReport();
            return;
        }

        const refreshedFeature = refreshedItem.value;
        refreshedItem.selected = true;
        const layerView = await mapView.whenLayerView(activeLayer);
        incidentHighlight?.remove();
        incidentHighlight = layerView.highlight(refreshedFeature, {"name": "incident"});
        selectedReportAttributes = refreshedFeature.attributes;
        selectedReportGeometry = refreshedFeature.geometry;
        updateHelpRequestActionButton(selectedReportAttributes);
        renderReportDetails(selectedReportAttributes);
    }
    catch (error) {
        saveButton.disabled = false;
        console.error("Failed to update report status:", error);
    }
});

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
        selectedReportGeometry = result.graphic.geometry;
        const objectId = result.graphic.getObjectId();

        const list = document.getElementById("list-group");
        const listItem = [...list.querySelectorAll("calcite-list-item")].find(item => item.value?.attributes?.report_id === result.graphic.attributes.report_id);
        if (listItem) {
            listItem.selected = true;
            listItem.scrollIntoView({behavior: "smooth",block: "center"});
        }

        const reportAttributes = result.graphic.attributes;
        selectedReportAttributes = reportAttributes;
        updateHelpRequestActionButton(reportAttributes);
        document.getElementById("report-details-card").classList.remove("empty");
        renderReportDetails(reportAttributes);

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
    selectedReportGeometry = feature.geometry;
    console.log(incidentHighlight);

    const reportAttributes = feature.attributes;
    selectedReportAttributes = reportAttributes;
    updateHelpRequestActionButton(reportAttributes);
    document.getElementById("report-details-card").classList.remove("empty");
    renderReportDetails(reportAttributes);

    const image = document.getElementById("report-details-image");
    image.src = reportAttributes.image_url;
});



const menuItems = document.querySelectorAll("calcite-menu-item[data-section]");
const sections = document.querySelectorAll(".dashboard-section");

let helpRequestsLoaded = false;
let helpRequestsLoadPromise = null;
let createRequestClickHandler = null;
let helpRequestsMineOnly = false;
let helpRequestsSortAscending = false;
let helpRequestsStatusFilter = null;
let currentHelpRequests = [];
let helpRequestsChart = null;
let helpRequestToDelete = null;
let stagedResourceRequests = [];

const resourceTypes = ["Food", "Water", "Medical Supplies", "Shelter", "Services", "Other"];
const resourceRequestDialog = document.getElementById("resource-request-dialog");
const requestResourcesToggle = document.getElementById("request-resources-toggle");
const resourceRequestEditor = document.getElementById("resource-request-editor");
const resourceRequestRows = document.getElementById("resource-request-rows");
let activeHelpRequestId = null;

function addResourceRequestRow() {
    const row = document.createElement("div");
    row.className = "resource-request-row";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Resource name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.setAttribute("aria-label", "Resource name");
    nameInput.setAttribute("autocomplete", "off");
    nameLabel.appendChild(nameInput);

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Resource type";
    const typeSelect = document.createElement("select");
    typeSelect.required = true;
    typeSelect.setAttribute("aria-label", "Resource type");
    typeSelect.add(new Option("Select a resource", ""));
    resourceTypes.forEach(type => typeSelect.add(new Option(type, type)));
    typeLabel.appendChild(typeSelect);

    const quantityLabel = document.createElement("label");
    quantityLabel.textContent = "Quantity";
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "0";
    quantityInput.step = "1";
    quantityInput.required = true;
    quantityInput.setAttribute("aria-label", "Resource quantity");
    quantityLabel.appendChild(quantityInput);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "resource-request-remove";
    removeButton.setAttribute("aria-label", "Remove resource");
    removeButton.title = "Remove resource";
    const removeIcon = document.createElement("calcite-icon");
    removeIcon.icon = "x";
    removeIcon.scale = "s";
    removeButton.appendChild(removeIcon);
    removeButton.addEventListener("click", () => row.remove());

    row.append(nameLabel, typeLabel, quantityLabel, removeButton);
    resourceRequestRows.appendChild(row);
}

function openResourceRequestDialog(unit, requestId) {
    document.getElementById("resource-request-unit").textContent =
        `Help request created with ${unit.unit_name}. Would you like to request resources to go with it?`;
    activeHelpRequestId = requestId;
    requestResourcesToggle.checked = false;
    resourceRequestEditor.hidden = true;
    resourceRequestRows.replaceChildren();
    stagedResourceRequests = [];
    resourceRequestDialog.open = true;
}

requestResourcesToggle.addEventListener("change", () => {
    resourceRequestEditor.hidden = !requestResourcesToggle.checked;
    if (requestResourcesToggle.checked && resourceRequestRows.childElementCount === 0) {
        addResourceRequestRow();
    }
});

document.getElementById("add-resource-request-button").addEventListener("click", addResourceRequestRow);
document.getElementById("resource-request-cancel-button").addEventListener("click", () => {
    resourceRequestDialog.open = false;
});
document.getElementById("resource-request-ok-button").addEventListener("click", async event => {
    if (requestResourcesToggle.checked) {
        const rows = [...resourceRequestRows.querySelectorAll(".resource-request-row")];
        const validRows = rows.map(row => {
            const nameInput = row.querySelector('input[type="text"]');
            const typeSelect = row.querySelector("select");
            const quantityInput = row.querySelector('input[type="number"]');
            nameInput.setCustomValidity(nameInput.value.trim() ? "" : "Enter a resource name.");
            return nameInput.reportValidity()
                && typeSelect.reportValidity()
                && quantityInput.reportValidity();
        });
        if (rows.length === 0 || validRows.some(isValid => !isValid)) {
            return;
        }
        stagedResourceRequests = rows.map(row => ({
            resource_name: row.querySelector('input[type="text"]').value.trim(),
            resource_type: row.querySelector("select").value,
            quantity: Number(row.querySelector('input[type="number"]').value)
        }));
    } else {
        stagedResourceRequests = [];
    }

    const button = event.currentTarget;
    button.disabled = true;
    try {
        if (stagedResourceRequests.length > 0) {
            const params = new URLSearchParams({request_id: String(activeHelpRequestId)});
            const response = await fetch(`/api/resources/request?${params}`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(stagedResourceRequests)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Resource request submission failed with status ${response.status}.`);
            }
            console.log("Created resource requests:", await response.json());
        }
        resourceRequestDialog.open = false;
    } catch (error) {
        console.error("Failed to submit resource requests:", error);
    } finally {
        button.disabled = false;
    }
});

function updateHelpRequestActionButton(reportAttributes) {
    const button = document.getElementById("help-request-action-button");
    const canCreateRequest = reportAttributes?.status === "Pending Assistance";
    button.textContent = !reportAttributes || canCreateRequest
        ? "Create Request"
        : "View Request";

    if (createRequestClickHandler) {
        button.removeEventListener("click", createRequestClickHandler);
        createRequestClickHandler = null;
    }

    if (canCreateRequest) {
        createRequestClickHandler = async () => {
            const reportId = selectedReportId;
            const reportGeometry = selectedReportGeometry;
            if (reportId == null || !reportGeometry || coordinatorId == null) {
                console.error("Cannot find the selected report location or coordinator.");
                return;
            }

            try {
                const params = new URLSearchParams({
                    long: String(reportGeometry.longitude),
                    lat: String(reportGeometry.latitude)
                });
                const response = await fetch(`/api/nearest-response-unit?${params}`);
                if (!response.ok) {
                    throw new Error(`Nearest response unit request failed with status ${response.status}.`);
                }

                const nearestUnits = await response.json();
                const nearestUnit = nearestUnits[0];
                if (!nearestUnit?.unit_id) {
                    throw new Error("No response unit was found for the selected report.");
                }
                console.log("Nearest response unit:", nearestUnit);

                const helpRequestParams = new URLSearchParams({
                    report_id: String(reportId),
                    unit_id: String(nearestUnit.unit_id)
                });
                const helpRequestResponse = await fetch(`/api/help-requests?${helpRequestParams}`, {
                    method: "POST"
                });
                if (!helpRequestResponse.ok) {
                    throw new Error(`Help request creation failed with status ${helpRequestResponse.status}.`);
                }
                const createdHelpRequest = await helpRequestResponse.json();
                if (createdHelpRequest.request_id == null) {
                    throw new Error("Help request creation did not return a request ID.");
                }
                console.log("Help request:", createdHelpRequest);

                const coordinatorParams = new URLSearchParams({
                    coordinator_id: String(coordinatorId)
                });
                const coordinatorResponse = await fetch(
                    `/api/incidents/${encodeURIComponent(reportId)}/coordinator?${coordinatorParams}`,
                    {method: "PUT"}
                );
                if (!coordinatorResponse.ok) {
                    throw new Error(`Coordinator assignment failed with status ${coordinatorResponse.status}.`);
                }
                console.log("Assigned coordinator:", await coordinatorResponse.json());

                const statusParams = new URLSearchParams({status: "Help Requested"});
                const statusResponse = await fetch(
                    `/api/incidents/${encodeURIComponent(reportId)}/status?${statusParams}`,
                    {method: "PUT"}
                );
                if (!statusResponse.ok) {
                    throw new Error(`Report status update failed with status ${statusResponse.status}.`);
                }
                const updatedReport = await statusResponse.json();
                console.log("Report status:", updatedReport);

                await updateMapAndTable();
                await updateIncidentStats(selectedDistrict);

                openResourceRequestDialog(nearestUnit, createdHelpRequest.request_id);
                if (selectedReportId !== reportId) return;
                const refreshedItem = [...document.querySelectorAll("#list-group calcite-list-item")]
                    .find(item => String(item.value?.attributes?.report_id) === String(reportId));
                if (!refreshedItem) {
                    clearSelectedReport();
                    return;
                }

                const refreshedFeature = refreshedItem.value;
                refreshedItem.selected = true;
                const layerView = await mapView.whenLayerView(activeLayer);
                incidentHighlight?.remove();
                incidentHighlight = layerView.highlight(refreshedFeature, {"name": "incident"});
                selectedReportAttributes = refreshedFeature.attributes;
                selectedReportGeometry = refreshedFeature.geometry;
                updateHelpRequestActionButton(selectedReportAttributes);
                renderReportDetails(selectedReportAttributes);
                document.getElementById("report-details-image").src = selectedReportAttributes.image_url;
            }
            catch (error) {
                console.error("Failed to create a help request:", error);
            }
        };
        button.addEventListener("click", createRequestClickHandler);
    }
}

function renderHelpRequests(helpRequests) {
    currentHelpRequests = helpRequests;
    const helpRequestsList = document.getElementById("requests-list-group");
    helpRequestsList.replaceChildren();
    renderHelpRequestDetails(null);
    const heading = document.getElementById("request-list-heading");
    heading.textContent = helpRequestsStatusFilter
        ? `Help Requests — ${helpRequestsStatusFilter}`
        : "Help Requests";
    const visibleRequests = helpRequestsStatusFilter
        ? helpRequests.filter(request => request.request_status === helpRequestsStatusFilter)
        : helpRequests;
    visibleRequests.forEach(request => {
        const item = document.createElement("calcite-list-item");
        item.label = request.request_status;
        item.description = request.request_timestamp;
        item.value = request;

        const content = document.createElement("div");
        content.slot = "content";
        content.className = "help-request-list-content";
        const type = document.createElement("strong");
        type.textContent = request.type;
        const separator = document.createElement("span");
        separator.textContent = "|";
        separator.setAttribute("aria-hidden", "true");
        const timestamp = document.createElement("span");
        const date = new Date(request.request_timestamp);
        timestamp.textContent = Number.isNaN(date.getTime())
            ? String(request.request_timestamp)
            : date.toLocaleString();
        timestamp.className = "help-request-list-timestamp";
        const status = document.createElement("calcite-chip");
        status.label = request.request_status;
        status.textContent = request.request_status;
        status.appearance = "outline-fill";
        status.slot = "content-end";
        status.classList.add("help-request-status-chip");
        const statusClass = {
            "Pending": "pending",
            "In Progress": "in-progress",
            "Completed": "completed"
        }[request.request_status];
        if (statusClass) status.classList.add(`help-request-status-${statusClass}`);
        content.append(type, separator, timestamp);
        item.appendChild(content);
        item.appendChild(status);
        if (String(request.coordinator_id) === String(coordinatorId)) {
            const icon = document.createElement("calcite-icon");
            icon.icon = "star";
            icon.slot = "content-start";
            item.appendChild(icon);
        }
        helpRequestsList.appendChild(item);
    });
    sortHelpRequestList();
}

function renderHelpRequestDetails(request) {
    const container = document.getElementById("request-details-content");
    container.replaceChildren();
    container.classList.toggle("empty", !request);

    if (!request) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "Select a help request to view its details.";
        container.appendChild(emptyMessage);
        return;
    }

    const formatDate = value => {
        if (!value) return "Not available";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    };
    const addSection = (heading, fields) => {
        const section = document.createElement("section");
        section.className = "request-detail-section";
        const title = document.createElement("h4");
        title.textContent = heading;
        const list = document.createElement("dl");
        fields.forEach(([label, value]) => {
            if (value == null || value === "") return;
            const term = document.createElement("dt");
            term.textContent = label;
            const description = document.createElement("dd");
            description.textContent = String(value);
            list.append(term, description);
        });
        section.append(title, list);
        container.appendChild(section);
    };

    const requestSection = document.createElement("section");
    requestSection.className = "request-detail-section";
    const requestHeading = document.createElement("h4");
    requestHeading.textContent = "Help Request";
    const requestList = document.createElement("dl");
    const requestIdTerm = document.createElement("dt");
    requestIdTerm.textContent = "Request ID";
    const requestIdDescription = document.createElement("dd");
    requestIdDescription.textContent = String(request.request_id);
    const statusTerm = document.createElement("dt");
    statusTerm.textContent = "Status";
    const statusDescription = document.createElement("dd");
    statusDescription.className = "request-status-description";
    const statusLine = document.createElement("div");
    statusLine.className = "request-status-line";
    const statusValue = document.createElement("span");
    statusValue.className = "request-status-value";
    statusValue.textContent = request.request_status;
    statusLine.appendChild(statusValue);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "request-status-edit";
    editButton.setAttribute("aria-label", "Edit help request status");
    editButton.title = "Edit status";
    const editIcon = document.createElement("calcite-icon");
    editIcon.icon = "pencil";
    editIcon.scale = "s";
    editButton.appendChild(editIcon);
    editButton.addEventListener("click", () => {
        statusValue.hidden = true;
        editButton.hidden = true;
        statusEditor.hidden = false;
        statusEditor.querySelector("select").focus();
    });

    const statusEditor = document.createElement("span");
    statusEditor.className = "request-status-editor";
    statusEditor.hidden = true;
    const statusSelect = document.createElement("select");
    statusSelect.className = "request-status-select";
    ["Pending", "In Progress", "Completed"].forEach(status => {
        statusSelect.add(new Option(status, status, false, status === request.request_status));
    });
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "request-status-save";
    saveButton.setAttribute("aria-label", "Save help request status");
    saveButton.title = "Save status";
    const saveIcon = document.createElement("calcite-icon");
    saveIcon.icon = "check";
    saveIcon.scale = "s";
    saveButton.appendChild(saveIcon);
    saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        try {
            const params = new URLSearchParams({status: statusSelect.value});
            const response = await fetch(
                `/api/help-requests/${encodeURIComponent(request.request_id)}/status?${params}`,
                {method: "PUT"}
            );
            if (!response.ok) {
                throw new Error(`Help request status update failed with status ${response.status}.`);
            }
            const updated = await response.json();
            request.request_status = updated.status;
            const requestIndex = currentHelpRequests.findIndex(
                current => String(current.request_id) === String(request.request_id)
            );
            if (requestIndex !== -1) currentHelpRequests[requestIndex] = request;

            renderHelpRequests(currentHelpRequests);
            const updatedItem = [...document.querySelectorAll("#requests-list-group calcite-list-item")]
                .find(item => String(item.value?.request_id) === String(request.request_id));
            if (updatedItem) {
                updatedItem.selected = true;
                renderHelpRequestDetails(updatedItem.value);
            }
            try {
                await updateHelpRequestChartCounts();
            } catch (error) {
                console.error("Failed to refresh help request counts:", error);
            }
        } catch (error) {
            console.error("Failed to update help request status:", error);
            statusError.textContent = "Could not save status. Try again.";
        } finally {
            saveButton.disabled = false;
        }
    });
    statusEditor.append(statusSelect, saveButton);

    const statusError = document.createElement("span");
    statusError.className = "request-status-error";
    statusError.setAttribute("role", "alert");
    statusLine.append(editButton, statusEditor);
    statusDescription.append(statusLine, statusError);
    requestList.append(requestIdTerm, requestIdDescription, statusTerm, statusDescription);
    requestSection.append(requestHeading, requestList);
    container.appendChild(requestSection);

    const deleteActions = document.createElement("div");
    deleteActions.className = "request-detail-actions";
    const deleteRequestButton = document.createElement("calcite-button");
    deleteRequestButton.kind = "brand";
    deleteRequestButton.iconStart = "trash";
    deleteRequestButton.textContent = "Delete Help Request";
    deleteRequestButton.addEventListener("click", () => {
        helpRequestToDelete = request;
        document.getElementById("delete-help-request-message").textContent =
            `Delete help request ${request.request_id}?`;
        document.getElementById("delete-help-request-error").textContent = "";
        document.getElementById("delete-help-request-dialog").open = true;
    });
    deleteActions.appendChild(deleteRequestButton);
    container.appendChild(deleteActions);

    addSection("Request Time", [
        ["Requested", formatDate(request.request_timestamp)]
    ]);
    addSection("Incident", [
        ["Report ID", request.report_id],
        ["Type", request.type],
        ["Description", request.description],
        ["Reported", formatDate(request.report_timestamp)],
        ["Location", [request.address, request.city, request.state].filter(Boolean).join(", ")]
    ]);
    addSection("Assigned Response Unit", [
        ["Unit", request.unit_name],
        ["Unit type", request.unit_type]
    ]);
}

const deleteHelpRequestDialog = document.getElementById("delete-help-request-dialog");
document.getElementById("cancel-delete-help-request-button").addEventListener("click", () => {
    deleteHelpRequestDialog.open = false;
    helpRequestToDelete = null;
});

document.getElementById("confirm-delete-help-request-button").addEventListener("click", async event => {
    if (!helpRequestToDelete) return;

    const button = event.currentTarget;
    const requestId = helpRequestToDelete.request_id;
    const errorMessage = document.getElementById("delete-help-request-error");
    button.disabled = true;
    errorMessage.textContent = "";
    try {
        const response = await fetch(`/api/help-requests/${encodeURIComponent(requestId)}`, {
            method: "DELETE"
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Help request deletion failed with status ${response.status}.`);
        }
    } catch (error) {
        console.error("Failed to delete help request:", error);
        errorMessage.textContent = error.message || "Could not delete the help request. Try again.";
        return;
    } finally {
        button.disabled = false;
    }

    deleteHelpRequestDialog.open = false;
    helpRequestToDelete = null;
    renderHelpRequestDetails(null);
    try {
        await fetchHelpRequests(helpRequestsMineOnly);
        await updateHelpRequestChartCounts();
        const resourcesResponse = await fetch("/api/resources");
        if (!resourcesResponse.ok) {
            throw new Error(`Resource refresh failed with status ${resourcesResponse.status}.`);
        }
        renderResources(await resourcesResponse.json());
    } catch (error) {
        console.error("Help request was deleted, but the dashboard did not fully refresh:", error);
    }
});

async function updateHelpRequestChartCounts() {
    if (!helpRequestsChart) return;
    const response = await fetch("/api/help-requests/counts");
    if (!response.ok) {
        throw new Error(`Unable to refresh help request counts (${response.status}).`);
    }
    const counts = await response.json();
    const countsByStatus = Object.fromEntries(counts.map(row => [row.status, Number(row.count)]));
    helpRequestsChart.data.datasets[0].data = helpRequestsChart.data.labels.map(
        status => countsByStatus[status] || 0
    );
    helpRequestsChart.update();
}

function renderResources(resources) {
    const table = document.getElementById("resource-overview-table");
    table.querySelectorAll('calcite-table-row:not([slot="table-header"])').forEach(row => row.remove());

    if (resources.length === 0) {
        const row = document.createElement("calcite-table-row");
        const cell = document.createElement("calcite-table-cell");
        cell.textContent = "No resources found.";
        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    resources.forEach(resource => {
        const row = document.createElement("calcite-table-row");

        const name = document.createElement("calcite-table-cell");
        name.textContent = resource.resource_name;

        const typeCell = document.createElement("calcite-table-cell");
        const type = document.createElement("calcite-chip");
        type.label = resource.resource_type;
        type.textContent = resource.resource_type;
        type.appearance = "outline-fill";
        typeCell.appendChild(type);

        const quantity = document.createElement("calcite-table-cell");
        quantity.textContent = String(resource.quantity);

        const available = document.createElement("calcite-table-cell");
        available.textContent = resource.member_id != null ? "Yes" : "No";

        row.append(name, typeCell, quantity, available);
        table.appendChild(row);
    });
}

function renderResourcesMessage(message) {
    const table = document.getElementById("resource-overview-table");
    table.querySelectorAll('calcite-table-row:not([slot="table-header"])').forEach(row => row.remove());
    const row = document.createElement("calcite-table-row");
    const cell = document.createElement("calcite-table-cell");
    cell.textContent = message;
    row.appendChild(cell);
    table.appendChild(row);
}

document.getElementById("requests-list-group").addEventListener("calciteListItemSelect", event => {
    renderHelpRequestDetails(event.target.selected ? event.target.value : null);
});

function sortHelpRequestList() {
    const list = document.getElementById("requests-list-group");
    const items = [...list.querySelectorAll("calcite-list-item")];
    items.sort((a, b) => {
        const timeA = new Date(a.value.request_timestamp).getTime();
        const timeB = new Date(b.value.request_timestamp).getTime();
        return helpRequestsSortAscending ? timeA - timeB : timeB - timeA;
    });
    list.replaceChildren(...items);
}

async function fetchHelpRequests(mineOnly = false) {
    const url = mineOnly
        ? `/api/help-requests/${encodeURIComponent(coordinatorId)}`
        : "/api/help-requests";
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load help requests (${response.status}).`);
    }
    renderHelpRequests(await response.json());
}

async function loadHelpRequests() {
    const [requestsResponse, countsResponse, resourcesResponse] = await Promise.all([
        fetch("/api/help-requests"),
        fetch("/api/help-requests/counts"),
        fetch("/api/resources")
    ]);
    if (!requestsResponse.ok || !countsResponse.ok) {
        throw new Error("Unable to load help requests.");
    }

    const [helpRequests, helpRequestsCounts, resources] = await Promise.all([
        requestsResponse.json(),
        countsResponse.json(),
        resourcesResponse.ok
            ? resourcesResponse.json()
            : Promise.resolve(null)
    ]);

    renderHelpRequests(helpRequests);
    if (resources === null) {
        console.error(`Unable to load resources (${resourcesResponse.status}).`);
        renderResourcesMessage("Unable to load resources.");
    } else {
        renderResources(resources);
    }

    const statuses = ["Pending", "In Progress", "Completed"];
    const countsByStatus = Object.fromEntries(
        helpRequestsCounts.map(row => [row.status, Number(row.count)])
    );
    helpRequestsChart = new Chart(
        document.getElementById("helpRequestCountsChart"),
        {
            type: "doughnut",
            data: {
                labels: statuses,
                datasets: [{
                    data: statuses.map(status => countsByStatus[status] || 0),
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
                },
                onClick: (event, elements, chart) => {
                    if (elements.length === 0) return;
                    const selectedStatus = chart.data.labels[elements[0].index];
                    helpRequestsStatusFilter = helpRequestsStatusFilter === selectedStatus
                        ? null
                        : selectedStatus;
                    renderHelpRequests(currentHelpRequests);
                }
            }
        }
    );
    helpRequestsLoaded = true;
}

const filterMyRequestsButton = document.getElementById("filter-my-requests-button");
const filterMyRequestsIcon = document.getElementById("filter-my-requests-icon");
filterMyRequestsButton.addEventListener("click", async () => {
    if (!helpRequestsLoaded && !await ensureHelpRequestsLoaded()) return;

    const previousFilter = helpRequestsMineOnly;
    helpRequestsMineOnly = !helpRequestsMineOnly;
    filterMyRequestsButton.setAttribute("aria-pressed", String(helpRequestsMineOnly));
    filterMyRequestsButton.setAttribute(
        "aria-label",
        helpRequestsMineOnly ? "Show all help requests" : "Show my help requests"
    );
    filterMyRequestsButton.title = helpRequestsMineOnly ? "Show all help requests" : "Show my help requests";
    filterMyRequestsIcon.icon = helpRequestsMineOnly ? "star-f" : "star";

    try {
        await fetchHelpRequests(helpRequestsMineOnly);
    } catch (error) {
        helpRequestsMineOnly = previousFilter;
        filterMyRequestsButton.setAttribute("aria-pressed", String(helpRequestsMineOnly));
        filterMyRequestsButton.setAttribute(
            "aria-label",
            helpRequestsMineOnly ? "Show all help requests" : "Show my help requests"
        );
        filterMyRequestsButton.title = helpRequestsMineOnly ? "Show all help requests" : "Show my help requests";
        filterMyRequestsIcon.icon = helpRequestsMineOnly ? "star-f" : "star";
        console.error("Failed to filter help requests:", error);
    }
});

const sortHelpRequestsButton = document.getElementById("sort-help-requests-button");
const sortHelpRequestsIcon = document.getElementById("sort-help-requests-icon");
sortHelpRequestsButton.addEventListener("click", () => {
    helpRequestsSortAscending = !helpRequestsSortAscending;
    const direction = helpRequestsSortAscending ? "ascending" : "descending";
    sortHelpRequestsButton.setAttribute("aria-label", `Sort help requests by time ${direction}`);
    sortHelpRequestsButton.title = `Sort help requests by time ${direction}`;
    sortHelpRequestsIcon.icon = helpRequestsSortAscending ? "sort-ascending" : "sort-descending";
    sortHelpRequestList();
});

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
    let requestItem = [...requestList.querySelectorAll("calcite-list-item")]
        .find(item => String(item.value?.report_id) === String(selectedReportId));

    if (!requestItem && helpRequestsMineOnly) {
        try {
            await fetchHelpRequests(false);
            helpRequestsMineOnly = false;
            filterMyRequestsButton.setAttribute("aria-pressed", "false");
            filterMyRequestsButton.setAttribute("aria-label", "Show my help requests");
            filterMyRequestsButton.title = "Show my help requests";
            filterMyRequestsIcon.icon = "star";
            requestItem = [...requestList.querySelectorAll("calcite-list-item")]
                .find(item => String(item.value?.report_id) === String(selectedReportId));
        } catch (error) {
            console.error("Failed to load the selected help request:", error);
            return;
        }
    }

    if (!requestItem) {
        console.warn(`No help request found for report ${selectedReportId}.`);
        return;
    }

    requestList.querySelectorAll("calcite-list-item").forEach(item => {
        item.selected = item === requestItem;
        item.classList.toggle("view-request-highlight", item === requestItem);
    });
    await new Promise(resolve => requestAnimationFrame(resolve));
    requestItem.selected = true;
    renderHelpRequestDetails(requestItem.value);
    const listContainer = document.getElementById("requests-list");
    const containerRect = listContainer.getBoundingClientRect();
    const itemRect = requestItem.getBoundingClientRect();
    const itemTop = itemRect.top - containerRect.top + listContainer.scrollTop;
    listContainer.scrollTo({
        top: itemTop - (listContainer.clientHeight - itemRect.height) / 2,
        behavior: "smooth"
    });
});