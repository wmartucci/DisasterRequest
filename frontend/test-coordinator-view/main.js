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

const geojson = await loadIncidentReports({as_geojson: true});

function geoJSONtoLayer(geojson) {
    const blob = new Blob([JSON.stringify(geojson)], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const layer = new GeoJSONLayer({
        url
    });
    return layer;
}

const layer = geoJSONtoLayer(geojson);

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
const viewElement = document.querySelector("arcgis-map");
await viewElement.viewOnReady();
viewElement.map.add(layer);
var activeLayer = layer;

var selectedCard = null;

async function handleCardClick(event) {
    if (selectedCard != null) {
        selectedCard.classList.toggle("selected");
    }
    if (selectedCard == event.currentTarget) {
        const result = await loadIncidentReports({as_geojson: true});
        const layer = geoJSONtoLayer(result);
        layer.renderer = renderer;
        viewElement.map.add(layer);
        viewElement.map.remove(activeLayer);
        activeLayer = layer;
        selectedCard = null;
    }
    else {
        selectedCard = event.currentTarget;
        selectedCard.classList.toggle("selected");    

        const type = selectedCard.id === "card-1" ? "Fire"
                : selectedCard.id === "card-2" ? "Power"
                : selectedCard.id === "card-3" ? "Fallen Tree"
                : selectedCard.id === "card-4" ? "Flood"
                : "Other"

        const result = await loadIncidentReports({as_geojson: true, type: type});
        const layer = geoJSONtoLayer(result);
        layer.renderer = renderer;
        viewElement.map.add(layer);
        viewElement.map.remove(activeLayer);
        activeLayer = layer;
    }
}

const card1 = document.getElementById("card-1");
card1.addEventListener("click", handleCardClick);
const card2 = document.getElementById("card-2");
card2.addEventListener("click", handleCardClick);
const card3 = document.getElementById("card-3");
card3.addEventListener("click", handleCardClick);
const card4 = document.getElementById("card-4");
card4.addEventListener("click", handleCardClick);