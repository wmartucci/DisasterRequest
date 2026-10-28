const GeoJSONLayer = await $arcgis.import("@arcgis/core/layers/GeoJSONLayer.js");

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
    return layer;
}

const mapElement = document.querySelector("arcgis-map");
await mapElement.viewOnReady();

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
const renderer = {
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
}
await layer.load();
layer.renderer = renderer;
mapElement.map.add(layer);
var activeLayer = layer;

// Set table properties
const table = document.querySelector("arcgis-feature-table");
table.layer = layer;
table.multipleSelectionDisabled = true;
table.hideSelectionColumn = true;
table.hiddenFields = ["__OBJECTID"];
table.addEventListener("arcgisCellClick", (event) => {
    const id = event.detail.objectId;
    table.highlightIds.removeAll();
    table.highlightIds.add(id);
});

// Retrieve type or status corresponding with selected card
function selectedCardToTypeStatus(selectedCard) {
    if (selectedCard == null) return null;
    return selectedCard.id === "card-1" ? "Fire"
            : selectedCard.id === "card-2" ? "Power"
            : selectedCard.id === "card-3" ? "Fallen Tree"
            : selectedCard.id === "card-4" ? "Flood"
            : null;
}

var selectedCard = null;
var selectedDistrict = null;

// Card event listener, fetch new GeoJSON based on type clicked
async function handleCardClick(event) {
    if (selectedCard != null) selectedCard.classList.toggle("selected");

    let result;
    let layer;
    let selectedSameCard = false;

    if (selectedCard == event.currentTarget) {
        result = await loadIncidentReports({as_geojson: true, district_id: selectedDistrict});
        layer = geoJSONtoLayer(result, "incidents", "Incident Reports");
        selectedSameCard = true;
    }
    else {
        selectedCard = event.currentTarget;
        selectedCard.classList.toggle("selected");    

        const type = selectedCardToTypeStatus(selectedCard);

        result = await loadIncidentReports({as_geojson: true, type: type, district_id: selectedDistrict});
        layer = geoJSONtoLayer(result, "incidents", "Incident Reports");
    }

    layer.renderer = renderer;
    table.highlightIds.removeAll();
    table.layer = null;

    mapElement.map.remove(activeLayer);
    mapElement.map.add(layer);

    activeLayer = layer;
    
    await layer.load();

    table.layer = layer;
    table.hiddenFields = ["__OBJECTID"];

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
    const type_count_fields = ["fire_count", "power_count", "tree_count", "flood_count"]
    const incident_stats = await loadIncidentReportStats({district_id: district_id});
    document.querySelectorAll('[id^="card-"]').forEach((card, index) => {
        card.querySelector("p").textContent = incident_stats[0][type_count_fields[index]];
    });
}
await updateIncidentStats();

// Update display when feature selected in map
let highlightHandle;
const layerView = await mapElement.view.whenLayerView(layer);
mapElement.addEventListener("arcgisViewClick", async (event) => {
    const incidents = mapElement.map.findLayerById("incidents");
    const districts = mapElement.map.findLayerById("districts");

    const response = await mapElement.hitTest(event.detail, {
        include: [incidents, districts].filter(Boolean)
    });

    const result = response.results.find(r => 
        r.type === "graphic" && r.graphic.layer.id === "incidents"
    ) ?? response.results.find(r => 
        r.type === "graphic" && r.graphic.layer.id === "districts"
    );
   
    highlightHandle?.remove();
    if (!result) return;

    const layer = result.graphic.layer;
    const layerView = await mapElement.view.whenLayerView(layer);
    highlightHandle = layerView.highlight(result.graphic);

    if (layer.id === "incidents") {
        const objectId = result.graphic.getObjectId();
        table.highlightIds.removeAll();
        table.highlightIds.add(objectId);

        await table.scrollToRow(objectId);
    }
    else if (layer.id === "districts") {
        const graphic = result.graphic;
        const feature = await graphic.layer.queryFeatures({
            objectIds: [graphic.getObjectId()],
            outFields: ["*"],
            returnGeometry: false
        });
        const districtId = feature.features[0].attributes["district_id"];
        const type = selectedCardToTypeStatus(selectedCard);
        const incidentsInDistrict = await loadIncidentReports({type: type, district_id: districtId, as_geojson: true});
        const incidentsInDistrictLayer = geoJSONtoLayer(incidentsInDistrict, "incidents", "Incident Reports");
        incidentsInDistrictLayer.renderer = renderer;

        table.highlightIds.removeAll();
        table.layer = null;

        mapElement.map.remove(activeLayer);
        mapElement.map.add(incidentsInDistrictLayer);

        activeLayer = incidentsInDistrictLayer;
        selectedDistrict = districtId;
        
        await incidentsInDistrictLayer.load();
        await updateIncidentStats(districtId);

        table.layer = incidentsInDistrictLayer;
        table.hiddenFields = ["__OBJECTID"];
    }
});