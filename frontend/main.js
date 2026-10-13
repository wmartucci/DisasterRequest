// Temporary demo records. Changes reset when the page reloads.
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

const statusClasses = {
    "Pending Assistance": "status-pending",
    "Help Requested": "status-requested",
    "Unit in Response": "status-responding",
    "Resolved": "status-resolved"
};

// Later, this function will request records from the backend.
async function getIncidents() {
    return sampleIncidents;
}

// Find an HTML element and identify missing elements clearly.
function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing HTML element: ${id}`);
    }

    return element;
}

function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

function createStatusCell(status) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");

    badge.classList.add("status-badge");

    if (statusClasses[status]) {
        badge.classList.add(statusClasses[status]);
    }

    badge.textContent = status;
    cell.appendChild(badge);
    return cell;
}

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
            const button = document.createElement("button");

            button.type = "button";
            button.className = "secondary-button";
            button.textContent = "View";
            button.setAttribute(
                "aria-label",
                `View report ${incident.report_id}`
            );

            button.addEventListener("click", () => {
                showIncidentDetails(incident);
            });

            actionCell.appendChild(button);
            row.appendChild(actionCell);
        }

        tableBody.appendChild(row);
    });
}

function showIncidentDetails(incident) {
    const details = getElement("incident-details");
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
        const strong = document.createElement("strong");

        strong.textContent = `${label}: `;
        paragraph.appendChild(strong);
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

function showScreen(screenId) {
    const selectedScreen = document.getElementById(screenId);

    if (!selectedScreen || !selectedScreen.classList.contains("screen")) {
        return;
    }

    document.querySelectorAll(".screen").forEach((screen) => {
        screen.hidden = screen.id !== screenId;
    });

    document.querySelectorAll(".navigation button").forEach((button) => {
        const active = button.dataset.screen === screenId;

        button.classList.toggle("active", active);

        if (active) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

async function initializeApp() {
    const incidents = await getIncidents();

    // Search elements.
    const searchForm = getElement("search-form");
    const searchResults = getElement("search-results");
    const searchMessage = getElement("search-message");

    // Reporting elements.
    const incidentForm = getElement("incident-form");
    const reportError = getElement("report-error");
    const reportSuccess = getElement("report-success");

    // Manage Incidents elements.
    const manageForm = getElement("manage-form");
    const manageReport = getElement("manage-report");
    const manageStatus = getElement("manage-status");
    const manageCurrent = getElement("manage-current");
    const manageError = getElement("manage-error");
    const manageSuccess = getElement("manage-success");

    function refreshHome() {
        const recentIncidents = [...incidents]
            .sort((a, b) => {
                const first = `${a.report_date}T${a.report_time}`;
                const second = `${b.report_date}T${b.report_time}`;
                return second.localeCompare(first);
            })
            .slice(0, 5);

        renderIncidents(
            getElement("recent-incidents"),
            recentIncidents
        );
    }

    function searchIncidents() {
        const text = getElement("search-text")
            .value.trim().toLowerCase();

        const type = getElement("type-filter").value;
        const status = getElement("status-filter").value;

        const matches = incidents.filter((incident) => {
            const searchableText =
                `${incident.city} ${incident.description}`.toLowerCase();

            return (
                searchableText.includes(text) &&
                (!type || incident.type === type) &&
                (!status || incident.status === status)
            );
        });

        renderIncidents(searchResults, matches, true);

        searchMessage.textContent =
            `${matches.length} sample incident(s) found.`;

        getElement("incident-details").hidden = true;
    }

    function showCurrentStatus() {
        const incident = incidents.find(
            (record) => String(record.report_id) === manageReport.value
        );

        if (!incident) {
            manageCurrent.textContent =
                "Select a report to see its current status.";
            manageStatus.value = "Pending Assistance";
            return;
        }

        manageStatus.value = incident.status;
        manageCurrent.textContent =
            `Report #${incident.report_id}: current status is ${incident.status}.`;
    }

    function populateManageReports() {
        const selectedId = manageReport.value;

        manageReport.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a report";
        manageReport.appendChild(placeholder);

        incidents.forEach((incident) => {
            const option = document.createElement("option");

            option.value = String(incident.report_id);
            option.textContent =
                `#${incident.report_id} — ${incident.type} — ${incident.city}`;

            manageReport.appendChild(option);
        });

        manageReport.value = selectedId;
        showCurrentStatus();
    }

    function refreshViews() {
        refreshHome();
        searchIncidents();
        populateManageReports();
    }

    // Navigation.
    document.querySelectorAll("button[data-screen]").forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.screen === "manage") {
                populateManageReports();
                manageError.textContent = "";
                manageSuccess.textContent = "";
            }

            showScreen(button.dataset.screen);
        });
    });

    // Search.
    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        searchIncidents();
    });

    // Report an Incident.
    incidentForm.addEventListener("submit", (event) => {
        event.preventDefault();

        reportError.textContent = "";
        reportSuccess.textContent = "";

        const type = getElement("incident-type").value;
        const city = getElement("incident-city").value.trim();
        const address = getElement("incident-address").value.trim();
        const state = getElement("incident-state").value.trim();
        const description = getElement("incident-description").value.trim();

        const allowedTypes = ["Fallen Tree", "Flood", "Fire", "Power"];

        if (
            !allowedTypes.includes(type) ||
            !city ||
            !address ||
            !state ||
            !description
        ) {
            reportError.textContent =
                "Please complete every field. Spaces alone are not valid.";
            return;
        }

        const now = new Date();
        const pad = (number) => String(number).padStart(2, "0");

        const reportDate =
            `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        const reportTime =
            `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        const nextId =
            Math.max(0, ...incidents.map((incident) => incident.report_id)) + 1;

        incidents.push({
            report_id: nextId,
            type,
            address,
            city,
            state,
            description,
            status: "Pending Assistance",
            report_date: reportDate,
            report_time: reportTime
        });

        refreshViews();
        incidentForm.reset();

        reportSuccess.textContent =
            `Demo report #${nextId} added. View it in Home or Browse Incidents. ` +
            "It will disappear when you refresh the page.";
    });

    incidentForm.addEventListener("reset", () => {
        reportError.textContent = "";
        reportSuccess.textContent = "";
    });

    // Manage Incidents.
    manageReport.addEventListener("change", () => {
        manageError.textContent = "";
        manageSuccess.textContent = "";
        showCurrentStatus();
    });

    manageStatus.addEventListener("change", () => {
        manageError.textContent = "";
        manageSuccess.textContent = "";
    });

    manageForm.addEventListener("submit", (event) => {
        event.preventDefault();

        manageError.textContent = "";
        manageSuccess.textContent = "";

        const incident = incidents.find(
            (record) => String(record.report_id) === manageReport.value
        );

        if (!incident) {
            manageError.textContent = "Please select an incident report.";
            return;
        }

        const newStatus = manageStatus.value;

        if (!Object.prototype.hasOwnProperty.call(statusClasses, newStatus)) {
            manageError.textContent = "Please select a valid status.";
            return;
        }

        if (incident.status === newStatus) {
            manageSuccess.textContent =
                "This report already has that status. No change was made.";
            return;
        }

        const previousStatus = incident.status;
        incident.status = newStatus;

        refreshViews();

        manageSuccess.textContent =
            `Demo report #${incident.report_id} changed from ` +
            `${previousStatus} to ${newStatus}. ` +
            "This change will reset when you refresh the page.";
    });

    // Initial display.
    refreshViews();
    showScreen("home");
}

initializeApp().catch((error) => {
    console.error("Application initialization failed:", error);

    const message = document.getElementById("search-message");

    if (message) {
        message.textContent =
            "Unable to start the demo. Check that index.html contains " +
            "the reporting and Manage Incidents forms.";
    }
});
