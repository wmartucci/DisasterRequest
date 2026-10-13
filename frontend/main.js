// DEMO DATA: these records and changes reset on page reload.
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

const samplePosts = [
    {
        post_id: 1,
        member_id: 1,
        post_title: "Temporary shelter open",
        post_content:
            "The community center is offering temporary shelter and drinking water."
    },
    {
        post_id: 2,
        member_id: 2,
        post_title: "Food distribution",
        post_content:
            "Volunteers will distribute food packages at the community center."
    },
    {
        post_id: 3,
        member_id: 3,
        post_title: "Road cleared",
        post_content:
            "The fallen tree has been removed. The neighborhood road is open again."
    }
];

const statusClasses = {
    "Pending Assistance": "status-pending",
    "Help Requested": "status-requested",
    "Unit in Response": "status-responding",
    "Resolved": "status-resolved"
};

const allowedTypes = ["Fallen Tree", "Flood", "Fire", "Power"];

// Replace this function with a backend request during integration.
async function getIncidents() {
    return sampleIncidents;
}

function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing HTML element: ${id}`);
    }

    return element;
}

// Use textContent so entered text is displayed safely.
function createTextElement(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;

    if (className) {
        element.className = className;
    }

    return element;
}

function newestFirst(incidents) {
    return [...incidents].sort((a, b) => {
        const first = `${a.report_date}T${a.report_time}`;
        const second = `${b.report_date}T${b.report_time}`;

        return second.localeCompare(first);
    });
}

function renderIncidents(tableBody, incidents, includeActions = false) {
    tableBody.replaceChildren();

    if (incidents.length === 0) {
        const row = document.createElement("tr");
        const cell = createTextElement("td", "No matching incidents found.");

        cell.colSpan = includeActions ? 5 : 4;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    incidents.forEach((incident) => {
        const row = document.createElement("tr");

        row.appendChild(
            createTextElement("td", `#${incident.report_id}`)
        );
        row.appendChild(createTextElement("td", incident.type));
        row.appendChild(
            createTextElement(
                "td",
                `${incident.address}, ${incident.city}`
            )
        );

        const statusCell = document.createElement("td");
        const badge = createTextElement(
            "span",
            incident.status,
            "status-badge"
        );

        if (statusClasses[incident.status]) {
            badge.classList.add(statusClasses[incident.status]);
        }

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        if (includeActions) {
            const actionCell = document.createElement("td");
            const button = createTextElement(
                "button",
                "View",
                "secondary-button"
            );

            button.type = "button";
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

    details.appendChild(
        createTextElement("h3", `Report #${incident.report_id}`)
    );

    const fields = [
        ["Type", incident.type],
        ["Location", `${incident.address}, ${incident.city}, ${incident.state}`],
        ["Reported", `${incident.report_date} at ${incident.report_time}`],
        ["Status", incident.status],
        ["Description", incident.description]
    ];

    fields.forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        paragraph.appendChild(
            createTextElement("strong", `${label}: `)
        );
        paragraph.appendChild(document.createTextNode(value));
        details.appendChild(paragraph);
    });

    const closeButton = createTextElement(
        "button",
        "Close details",
        "secondary-button"
    );

    closeButton.type = "button";
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

    const searchForm = getElement("search-form");
    const incidentForm = getElement("incident-form");
    const manageForm = getElement("manage-form");
    const manageReport = getElement("manage-report");
    const manageStatus = getElement("manage-status");
    const manageCurrent = getElement("manage-current");
    const manageError = getElement("manage-error");
    const manageSuccess = getElement("manage-success");
    const reportError = getElement("report-error");
    const reportSuccess = getElement("report-success");
    const postsList = getElement("posts-list");
    const postMessage = getElement("post-message");

    function refreshHome() {
        renderIncidents(
            getElement("recent-incidents"),
            newestFirst(incidents).slice(0, 5)
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

        renderIncidents(
            getElement("search-results"),
            newestFirst(matches),
            true
        );

        getElement("search-message").textContent =
            `${matches.length} sample incident(s) found.`;

        getElement("incident-details").hidden = true;
    }

    function getSelectedIncident() {
        return incidents.find(
            (incident) =>
                String(incident.report_id) === manageReport.value
        );
    }

    function showCurrentStatus() {
        const incident = getSelectedIncident();

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

        const placeholder = createTextElement(
            "option",
            "Select a report"
        );
        placeholder.value = "";
        manageReport.appendChild(placeholder);

        newestFirst(incidents).forEach((incident) => {
            const option = createTextElement(
                "option",
                `#${incident.report_id} — ${incident.type} — ${incident.city}`
            );

            option.value = String(incident.report_id);
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

    searchForm.addEventListener("reset", () => {
        // Wait until the browser has reset the input values.
        setTimeout(searchIncidents, 0);
    });

    // Insert a demo incident.
    incidentForm.addEventListener("submit", (event) => {
        event.preventDefault();

        reportError.textContent = "";
        reportSuccess.textContent = "";

        const type = getElement("incident-type").value;
        const city = getElement("incident-city").value.trim();
        const address = getElement("incident-address").value.trim();
        const state = getElement("incident-state").value.trim();
        const description = getElement("incident-description").value.trim();

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
        const nextId =
            Math.max(0, ...incidents.map((item) => item.report_id)) + 1;

        incidents.push({
            report_id: nextId,
            type,
            address,
            city,
            state,
            description,
            status: "Pending Assistance",
            report_date:
                `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
            report_time:
                `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
        });

        refreshViews();
        incidentForm.reset();

        reportSuccess.textContent =
            `Demo report #${nextId} added. View it in Home or Browse Incidents. ` +
            "It will disappear when the page reloads.";
    });

    incidentForm.addEventListener("reset", () => {
        reportError.textContent = "";
        reportSuccess.textContent = "";
    });

    // Update a demo incident.
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

        const incident = getSelectedIncident();

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
            "This change resets when the page reloads.";
    });

    // Display and delete demo community posts.
    function renderPosts() {
        postsList.replaceChildren();

        if (samplePosts.length === 0) {
            postsList.appendChild(
                createTextElement(
                    "p",
                    "No community posts to display.",
                    "panel"
                )
            );
            return;
        }

        samplePosts.forEach((post) => {
            const article = document.createElement("article");
            article.className = "panel";

            article.appendChild(
                createTextElement("h3", post.post_title)
            );
            article.appendChild(
                createTextElement("p", post.post_content, "post-content")
            );
            article.appendChild(
                createTextElement(
                    "p",
                    `Post #${post.post_id} · Community member #${post.member_id}`,
                    "post-reference"
                )
            );

            const deleteButton = createTextElement(
                "button",
                "Delete Post",
                "delete-button"
            );

            deleteButton.type = "button";
            deleteButton.setAttribute(
                "aria-label",
                `Delete post: ${post.post_title}`
            );

            deleteButton.addEventListener("click", () => {
                const confirmed = window.confirm(
                    `Delete "${post.post_title}"?\n\n` +
                    "This will remove it from the demo."
                );

                if (!confirmed) {
                    return;
                }

                const index = samplePosts.findIndex(
                    (item) => item.post_id === post.post_id
                );

                if (index === -1) {
                    return;
                }

                samplePosts.splice(index, 1);
                renderPosts();

                postMessage.textContent =
                    `Demo post #${post.post_id} deleted. ` +
                    "It will return when the page reloads.";

                const nextButton = postsList.querySelector("button");

                if (nextButton) {
                    nextButton.focus();
                } else {
                    document.querySelector(
                        '.navigation button[data-screen="posts"]'
                    ).focus();
                }
            });

            article.appendChild(deleteButton);
            postsList.appendChild(article);
        });
    }

    // Initial display.
    refreshViews();
    renderPosts();
    showScreen("home");
}

initializeApp().catch((error) => {
    console.error("Application initialization failed:", error);

    const message = document.getElementById("app-error");

    if (message) {
        message.textContent =
            "Unable to start the demo. Check that index.html and main.js " +
            "are both the latest versions, then reload.";
    }
});
