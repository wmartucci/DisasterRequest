// UI actions + DB API interaction
// Temporary sample data.
// Later, we will load these records from the backend.
const sampleIncidents = [
    {
        report_id: 25,
        type: "Flood",
        address: "1070 Tunnel Rd",
        city: "Asheville",
        state: "North Carolina",
        description: "Floodwater entering nearby homes. Residents need assistance.",
        status: "Pending Assistance",
        report_date: "2024-10-02",
        report_time: "08:50:12"
    },
    {
        report_id: 1,
        type: "Fallen Tree",
        address: "121 Buffalo Trl",
        city: "Asheville",
        state: "North Carolina",
        description: "A tree is blocking the driveway and access to transportation.",
        status: "Help Requested",
        report_date: "2024-10-03",
        report_time: "07:39:15"
    },
    {
        report_id: 17,
        type: "Fire",
        address: "469 Kenilworth Rd",
        city: "Asheville",
        state: "North Carolina",
        description: "Smoke reported from a second-floor apartment.",
        status: "Unit in Response",
        report_date: "2024-09-26",
        report_time: "04:38:42"
    },
    {
        report_id: 40,
        type: "Power",
        address: "18 Oak St",
        city: "Asheville",
        state: "North Carolina",
        description: "A neighborhood power interruption has been resolved.",
        status: "Resolved",
        report_date: "2024-10-01",
        report_time: "14:20:00"
    }
];

// Data access function.
// We will replace its contents with a backend request later.
async function getIncidents() {
    return sampleIncidents;
}

const statusClasses = {
    "Pending Assistance": "status-pending",
    "Help Requested": "status-requested",
    "Unit in Response": "status-responding",
    "Resolved": "status-resolved"
};

// Create a table cell safely using textContent.
function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

function createStatusCell(status) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");

    badge.classList.add("status-badge");

    const statusClass = statusClasses[status];
    if (statusClass) {
        badge.classList.add(statusClass);
    }

    badge.textContent = status;
    cell.appendChild(badge);

    return cell;
}

// Display incident records in either table.
function renderIncidents(tableBody, incidents, includeActions = false) {
    tableBody.replaceChildren();

    if (incidents.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No matching incidents found.");

        cell.colSpan = includeActions ? 5 : 4;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    incidents.forEach((incident) => {
        const row = document.createElement("tr");

        row.appendChild(createCell(`#${incident.report_id}`));
        row.appendChild(createCell(incident.type));
        row.appendChild(
            createCell(`${incident.address}, ${incident.city}`)
        );
        row.appendChild(createStatusCell(incident.status));

        if (includeActions) {
            const actionCell = document.createElement("td");
            const viewButton = document.createElement("button");

            viewButton.type = "button";
            viewButton.className = "secondary-button";
            viewButton.textContent = "View";
            viewButton.setAttribute(
                "aria-label",
                `View report ${incident.report_id}`
            );

            viewButton.addEventListener("click", () => {
                showIncidentDetails(incident);
            });

            actionCell.appendChild(viewButton);
            row.appendChild(actionCell);
        }

        tableBody.appendChild(row);
    });
}

// Show the selected incident underneath the search results.
function showIncidentDetails(incident) {
    const details = document.getElementById("incident-details");
    details.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = `Report #${incident.report_id}`;
    details.appendChild(heading);

    const fields = [
        ["Type", incident.type],
        ["Location", `${incident.address}, ${incident.city}, ${incident.state}`],
        ["Reported", `${incident.report_date} at ${incident.report_time}`],
        ["Status", incident.status],
        ["Description", incident.description]
    ];

    fields.forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const labelElement = document.createElement("strong");

        labelElement.textContent = `${label}: `;
        paragraph.appendChild(labelElement);
        paragraph.appendChild(document.createTextNode(value));
        details.appendChild(paragraph);
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "secondary-button";
    closeButton.textContent = "Close details";

    closeButton.addEventListener("click", () => {
        details.hidden = true;
    });

    details.appendChild(closeButton);
    details.hidden = false;
}

// Switch between application screens.
function showScreen(screenId) {
    const selectedScreen = document.getElementById(screenId);

    if (!selectedScreen || !selectedScreen.classList.contains("screen")) {
        return;
    }

    document.querySelectorAll(".screen").forEach((screen) => {
        screen.hidden = screen.id !== screenId;
    });

    document.querySelectorAll(".navigation button").forEach((button) => {
        const isActive = button.dataset.screen === screenId;

        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

async function initializeApp() {
    const incidents = await getIncidents();

    // Connect navigation and the homepage reporting button.
    document.querySelectorAll("button[data-screen]").forEach((button) => {
        button.addEventListener("click", () => {
            showScreen(button.dataset.screen);
        });
    });

    // Homepage: show the most recently reported incidents first.
    const recentIncidents = [...incidents]
        .sort((a, b) => {
            const first = `${a.report_date}T${a.report_time}`;
            const second = `${b.report_date}T${b.report_time}`;
            return second.localeCompare(first);
        })
        .slice(0, 5);

    renderIncidents(
        document.getElementById("recent-incidents"),
        recentIncidents
    );

    const searchResults = document.getElementById("search-results");
    const searchMessage = document.getElementById("search-message");

    function searchIncidents() {
        const searchText = document.getElementById("search-text")
            .value.trim().toLowerCase();

        const selectedType = document.getElementById("type-filter").value;
        const selectedStatus = document.getElementById("status-filter").value;

        const filteredIncidents = incidents.filter((incident) => {
            const searchableText =
                `${incident.city} ${incident.description}`.toLowerCase();

            const matchesText = searchableText.includes(searchText);
            const matchesType =
                !selectedType || incident.type === selectedType;
            const matchesStatus =
                !selectedStatus || incident.status === selectedStatus;

            return matchesText && matchesType && matchesStatus;
        });

        renderIncidents(searchResults, filteredIncidents, true);

        searchMessage.textContent =
            `${filteredIncidents.length} sample incident(s) found.`;

        document.getElementById("incident-details").hidden = true;
    }

    document.getElementById("search-form")
        .addEventListener("submit", (event) => {
            event.preventDefault();
            searchIncidents();
        });

    // Display all sample records initially.
    searchIncidents();
    showScreen("home");
}

initializeApp().catch((error) => {
    console.error("Application initialization failed:", error);

    document.getElementById("search-message").textContent =
        "Unable to load incidents. Please reload the page.";
});
