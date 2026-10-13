"use strict";
// Frontend-only demo. No server requests or database credentials.
const STORAGE_KEY = "disaster-response-frontend-v2";
const INCIDENT_STATUSES = [
  "Pending Assistance",
  "Help Requested",
  "Unit in Response",
  "Resolved",
];
const REQUEST_STATUSES = ["Pending", "In Progress", "Completed"];
const TYPES = ["Fallen Tree", "Flood", "Fire", "Power"];
const URGENCIES = ["Low", "Medium", "High", "Critical"];
const STATUS_CLASS = {
  "Pending Assistance": "pending",
  "Help Requested": "requested",
  "Unit in Response": "responding",
  Resolved: "resolved",
  Pending: "pending",
  "In Progress": "responding",
  Completed: "resolved",
};
const REQUEST_TO_INCIDENT = {
  Pending: "Help Requested",
  "In Progress": "Unit in Response",
  Completed: "Resolved",
};
const initialData = {
  members: [
    {
      member_id: 1,
      first_name: "Maya",
      last_name: "Patel",
      street_address: "121 Buffalo Trl",
      city: "Asheville",
      state: "North Carolina",
      tel_no: "828-555-0101",
    },
    {
      member_id: 2,
      first_name: "Ethan",
      last_name: "Brooks",
      street_address: "1070 Tunnel Rd",
      city: "Asheville",
      state: "North Carolina",
      tel_no: "828-555-0102",
    },
  ],
  coordinators: [
    {
      coordinator_id: 1,
      first_name: "Jordan",
      last_name: "Lee",
      phone: "828-555-0110",
      email: "jordan@example.com",
    },
    {
      coordinator_id: 2,
      first_name: "Alex",
      last_name: "Rivera",
      phone: "828-555-0111",
      email: "alex@example.com",
    },
  ],
  volunteers: [
    {
      vol_id: 1,
      first_name: "Sam",
      last_name: "Wilson",
      phone: "828-555-0120",
      email: "sam@example.com",
    },
    {
      vol_id: 2,
      first_name: "Priya",
      last_name: "Shah",
      phone: "828-555-0121",
      email: "priya@example.com",
    },
  ],
  units: [
    {
      unit_name: "Asheville Rescue",
      personnel_count: 12,
      organization: "Community Rescue",
    },
    {
      unit_name: "Fire Response A",
      personnel_count: 8,
      organization: "Fire Department",
    },
    {
      unit_name: "Medical Response B",
      personnel_count: 6,
      organization: "Medical Services",
    },
  ],
  incidents: [
    {
      report_id: 1,
      member_id: 1,
      coordinator_id: 1,
      street_address: "121 Buffalo Trl",
      city: "Asheville",
      state: "North Carolina",
      latitude: 35.63,
      longitude: -82.46,
      radius: 50,
      report_date: "2024-10-03",
      report_time: "07:39:15",
      image_url: "",
      description:
        "A tree is blocking the driveway and access to transportation.",
      type: "Fallen Tree",
      status: "Help Requested",
    },
    {
      report_id: 25,
      member_id: 2,
      coordinator_id: 2,
      street_address: "1070 Tunnel Rd",
      city: "Asheville",
      state: "North Carolina",
      latitude: 35.59,
      longitude: -82.49,
      radius: 100,
      report_date: "2024-10-02",
      report_time: "08:50:12",
      image_url: "",
      description:
        "Floodwater entering nearby homes. Residents need assistance.",
      type: "Flood",
      status: "Pending Assistance",
    },
    {
      report_id: 17,
      member_id: 1,
      coordinator_id: 1,
      street_address: "469 Kenilworth Rd",
      city: "Asheville",
      state: "North Carolina",
      latitude: null,
      longitude: null,
      radius: null,
      report_date: "2024-09-26",
      report_time: "04:38:42",
      image_url: "",
      description: "Smoke reported from a second-floor apartment.",
      type: "Fire",
      status: "Unit in Response",
    },
    {
      report_id: 40,
      member_id: 2,
      coordinator_id: 2,
      street_address: "18 Oak St",
      city: "Asheville",
      state: "North Carolina",
      latitude: null,
      longitude: null,
      radius: null,
      report_date: "2024-10-01",
      report_time: "14:20:00",
      image_url: "",
      description: "A neighborhood power interruption has been resolved.",
      type: "Power",
      status: "Resolved",
    },
  ],
  requests: [
    {
      request_id: 1,
      report_id: 1,
      unit_name: "Asheville Rescue",
      urgency: "High",
      status: "Pending",
      timestamp: "2024-10-03T08:00:00",
      called_911: false,
    },
    {
      request_id: 2,
      report_id: 17,
      unit_name: "Fire Response A",
      urgency: "Critical",
      status: "In Progress",
      timestamp: "2024-09-26T05:00:00",
      called_911: true,
    },
  ],
  resources: [
    {
      resource_id: 1,
      request_id: 1,
      vol_id: 1,
      amount: 4,
      item: "Bottled water packs",
      service: "",
    },
    {
      resource_id: 2,
      request_id: 2,
      vol_id: 2,
      amount: 2,
      item: "",
      service: "Transport trips",
    },
  ],
  posts: [
    {
      post_id: 1,
      member_id: 1,
      post_title: "Temporary shelter open",
      post_content:
        "The community center is offering temporary shelter and drinking water.",
      media: "",
    },
    {
      post_id: 2,
      member_id: 2,
      post_title: "Food distribution",
      post_content:
        "Volunteers will distribute food packages at the community center.",
      media: "",
    },
    {
      post_id: 3,
      member_id: 1,
      post_title: "Road cleared",
      post_content: "The neighborhood road is open again after debris removal.",
      media: "",
    },
  ],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
let data = clone(initialData);
let storageAvailable = true;
let confirmAction = null;
let activeScreen = "home";
const $ = (id) => {
  const element = document.getElementById(id);
  if (!element) throw Error(`Missing element: ${id}`);
  return element;
};
const node = (tag, text, className = "") => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const personName = (p) =>
  p ? `${p.first_name} ${p.last_name}` : "Unavailable";
const find = (collection, key, value) =>
  data[collection].find((record) => String(record[key]) === String(value));
const nextId = (collection, key) =>
  Math.max(0, ...data[collection].map((record) => Number(record[key]))) + 1;
const newest = (list) =>
  [...list].sort((a, b) =>
    `${b.report_date}T${b.report_time}`.localeCompare(
      `${a.report_date}T${a.report_time}`,
    ),
  );
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    storageAvailable = false;
  }
  $("storage-note").textContent = storageAvailable
    ? "Frontend demo · Sample changes saved in this browser · No database connection"
    : "Frontend demo · Browser storage unavailable; changes reset on reload · No database connection";
}
function load() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!Object.keys(initialData).every((key) => Array.isArray(parsed[key])))
        throw Error("Invalid demo data");
      data = parsed;
    }
  } catch {
    data = clone(initialData);
    storageAvailable = false;
  }
}
function message(id, text, error = false) {
  const element = $(id);
  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle("error", error);
  element.setAttribute("role", error ? "alert" : "status");
}
function options(
  id,
  records,
  key,
  label,
  placeholder = "Select a record",
  preserve = true,
) {
  const select = $(id),
    previous = preserve ? select.value : "";
  select.replaceChildren();
  const first = node("option", placeholder);
  first.value = "";
  select.append(first);
  for (const record of records) {
    const option = node("option", label(record));
    option.value = String(record[key]);
    select.append(option);
  }
  if (records.some((r) => String(r[key]) === previous)) select.value = previous;
}
function badge(text) {
  return node(
    "span",
    text,
    `status status-${STATUS_CLASS[text] || "requested"}`,
  );
}
function button(text, action, className = "secondary-button") {
  const b = node("button", text, className);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function table(id, headers, rows) {
  const wrap = $(id);
  wrap.replaceChildren();
  if (!rows.length) {
    wrap.append(node("p", "No records to display.", "empty"));
    return;
  }
  const t = node("table"),
    head = node("thead"),
    tr = node("tr");
  for (const h of headers) {
    const th = node("th", h);
    th.scope = "col";
    tr.append(th);
  }
  head.append(tr);
  t.append(head);
  const body = node("tbody");
  for (const values of rows) {
    const row = node("tr");
    for (const [column, value] of values.entries()) {
      const cell = node("td");
      cell.dataset.label = headers[column];
      if (value instanceof Node) cell.append(value);
      else cell.textContent = value ?? "—";
      row.append(cell);
    }
    body.append(row);
  }
  t.append(body);
  wrap.append(t);
}
function details(title, fields, extra) {
  $("details-heading").textContent = title;
  const content = $("details-content");
  content.replaceChildren();
  const list = node("dl", undefined, "details-list");
  for (const [label, value] of fields) {
    list.append(node("dt", label));
    const dd = node("dd");
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value ?? "Not provided";
    list.append(dd);
  }
  content.append(list);
  if (extra) content.append(extra);
  $("details-dialog").showModal();
}
function safeLink(url, label) {
  if (!url) return "Not provided";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "Invalid URL";
    const a = node("a", label);
    a.href = parsed.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  } catch {
    return "Invalid URL";
  }
}
function confirm(title, description, acceptLabel, action) {
  confirmAction = action;
  $("confirm-heading").textContent = title;
  $("confirm-description").textContent = description;
  $("confirm-accept").textContent = acceptLabel;
  $("confirm-dialog").showModal();
}
function showScreen(id, focus = true) {
  if (!document.getElementById(id)) return;
  activeScreen = id;
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
  document.querySelectorAll(".navigation button").forEach((b) => {
    const active = b.dataset.screen === id;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (focus) $(id).querySelector("h2").focus({ preventScroll: true });
}
// Templates contain only fixed application markup. User data is inserted with DOM textContent.
function choices(list) {
  return list.map((value) => `<option>${value}</option>`).join("");
}
function field(label, name, type = "text", attributes = "") {
  return `<label>${label}<input name="${name}" type="${type}" ${attributes}></label>`;
}
function select(label, name, id, values) {
  return `<label>${label}<select name="${name}" id="${id}" required>${values ? choices(values) : ""}</select></label>`;
}
function form(id, content, submit) {
  return `<form id="${id}">${content}<div class="form-actions"><button class="primary-button" type="submit">${submit}</button><button class="secondary-button" type="reset">Clear</button></div><p id="${id}-message" class="message" role="status" hidden></p></form>`;
}
function screen(id, eyebrow, title, description, content) {
  return `<section id="${id}" class="screen" hidden aria-labelledby="${id}-heading"><div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2 id="${id}-heading" tabindex="-1">${title}</h2><p>${description}</p></div></div>${content}</section>`;
}
function panel(title, content) {
  return `<div class="panel">${title ? `<h3>${title}</h3>` : ""}${content}</div>`;
}
const phoneAttributes =
  'required pattern="([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})" title="Use 10 digits or XXX-XXX-XXXX" placeholder="540-555-0100"';
function renderShell() {
  const reporterFields =
    field(
      "First name",
      "first_name",
      "text",
      'required maxlength="80" autocomplete="given-name"',
    ) +
    field(
      "Last name",
      "last_name",
      "text",
      'required maxlength="80" autocomplete="family-name"',
    ) +
    field("Phone", "tel_no", "tel", phoneAttributes) +
    field(
      "Home street address",
      "member_street_address",
      "text",
      'required maxlength="200"',
    ) +
    field("Home city", "member_city", "text", 'required maxlength="100"') +
    field("Home state", "member_state", "text", 'required maxlength="100"');
  $("screens").innerHTML =
    screen(
      "home",
      "THE BIG PICTURE",
      "Community incident overview",
      "One place to follow reports, responses, and support.",
      `<div id="home-stats" class="stats"></div>${panel("Recent incidents", '<div id="home-table" class="table-wrapper"></div>')}<div class="panel form-actions"><button type="button" class="primary-button" data-screen="report">+ Report an Incident</button><button type="button" class="secondary-button" data-screen="response">Open Response Desk →</button><button type="button" class="secondary-button" data-screen="resources">Allocate resources →</button></div>`,
    ) +
    screen(
      "browse",
      "FIND & FOLLOW",
      "Incident reports",
      "Search by report ID, location, or description.",
      panel(
        "",
        `<form id="search-form" class="filters">${field("Search", "query", "search", 'placeholder="City, description, address, or ID"')}<label>Type<select name="type"><option value="">All types</option>${choices(TYPES)}</select></label><label>Status<select name="status"><option value="">All statuses</option>${choices(INCIDENT_STATUSES)}</select></label><div class="form-actions"><button class="primary-button" type="submit">Search</button><button class="secondary-button" type="reset">Clear</button></div></form><p id="search-count" class="muted" role="status"></p><div id="incident-table" class="table-wrapper"></div>`,
      ),
    ) +
    screen(
      "report",
      "REQUEST ASSISTANCE",
      "Report an incident",
      "Describe what happened and where help is needed. No account required.",
      panel(
        "",
        form(
          "report-form",
          `<fieldset><legend>1. Reporter details</legend><label>Community member<select name="member_id" id="report-member"></select></label><div id="new-member-fields" class="form-grid" style="margin-top:20px">${reporterFields}</div></fieldset><fieldset><legend>2. Incident details</legend><div class="form-grid">${select("Incident type", "type", "report-type", ["", ...TYPES])}${select("Reviewing coordinator", "coordinator_id", "report-coordinator")}${field("Street address", "street_address", "text", 'required maxlength="200"')}${field("City", "city", "text", 'required maxlength="100"')}${field("State", "state", "text", 'required maxlength="100"')}${field("Image URL (optional)", "image_url", "url", 'placeholder="https://…"')}<label class="full-width">Description<textarea name="description" rows="4" maxlength="3000" required></textarea></label>${field("Area radius in meters (optional)", "radius", "number", 'min="0" step="1"')}${field("Latitude (optional)", "latitude", "number", 'min="-90" max="90" step="any"')}${field("Longitude (optional)", "longitude", "number", 'min="-180" max="180" step="any"')}</div><p class="muted">Enter both coordinates together, or leave both empty.</p></fieldset>`,
          "Submit report",
        ),
      ),
    ) +
    screen(
      "response",
      "REVIEW & DISPATCH",
      "Response Desk",
      "Review incidents, create help requests, and assign response units.",
      `<div class="two-columns">${panel("Review an incident", form("review-form", `<div class="form-grid">${select("Incident", "report_id", "review-report")}${select("Coordinator", "coordinator_id", "review-coordinator")}${select("Incident status", "status", "review-status", INCIDENT_STATUSES)}</div><p id="review-current" class="muted"></p><p class="muted">A linked help request controls response status. Use the request form below to change it.</p>`, "Save review"))}${panel("Create a help request", form("request-form", `<div class="form-grid">${select("Incident without a help request", "report_id", "request-report")}${select("Response unit", "unit_name", "request-unit")}${select("Urgency", "urgency", "request-urgency", URGENCIES)}</div><label class="checkbox-label"><input name="called_911" type="checkbox"> 911 has been called</label><p class="muted">One help request per incident. Creating a request changes its incident to Help Requested.</p>`, "Create help request"))}</div>${panel("Help requests", '<div id="request-table" class="table-wrapper"></div>')}${panel("Update a help request", form("request-update-form", `<div class="form-grid">${select("Help request", "request_id", "update-request")}${select("Assigned unit", "unit_name", "update-unit")}${select("Urgency", "urgency", "update-urgency", URGENCIES)}${select("Request status", "status", "update-status", REQUEST_STATUSES)}</div><label class="checkbox-label"><input name="called_911" id="update-911" type="checkbox"> 911 has been called</label><p class="muted">Pending → Help Requested; In Progress → Unit in Response; Completed → Resolved.</p>`, "Save request"))}`,
    ) +
    screen(
      "resources",
      "SUPPORT IN ACTION",
      "Resources & allocations",
      "Connect volunteer-provided items and services to help requests.",
      panel(
        "Allocate a resource",
        form(
          "resource-form",
          `<div class="form-grid">${select("Help request", "request_id", "resource-request")}${select("Providing volunteer", "vol_id", "resource-volunteer")}${select("Resource kind", "kind", "resource-kind", ["Item", "Service"])}${field("Amount (items or service units)", "amount", "number", 'required min="1" step="1"')}${field("Item or service description", "description", "text", 'required maxlength="200"')}</div>`,
          "Allocate resource",
        ),
      ) +
        panel(
          "Allocated resources",
          '<label class="compact-label">Filter by request<select id="resource-filter"></select></label><div id="resource-table" class="table-wrapper"></div>',
        ),
    ) +
    screen(
      "people",
      "THE RESPONSE NETWORK",
      "People & response units",
      "Manage the people and units used in reports, requests, and resources.",
      panel(
        "",
        `<div class="panel-heading"><h3 id="directory-title">Community members</h3><label class="compact-label">Directory<select id="directory-type"><option value="members">Community members</option><option value="coordinators">Response coordinators</option><option value="volunteers">Volunteers</option><option value="units">Response units</option></select></label></div><div id="directory-table" class="table-wrapper"></div>`,
      ) +
        panel(
          "Add a record",
          form(
            "directory-form",
            '<div id="directory-fields" class="form-grid"></div>',
            "Add record",
          ),
        ),
    ) +
    screen(
      "posts",
      "STAY CONNECTED",
      "Community posts",
      "Share updates and remove outdated information.",
      panel(
        "Share an update",
        form(
          "post-form",
          `<div class="form-grid">${select("Community member", "member_id", "post-member")}${field("Title", "post_title", "text", 'required maxlength="50"')}<label class="full-width">Post content<textarea name="post_content" rows="3" maxlength="3000" required></textarea></label>${field("Media URL (optional)", "media", "url", 'placeholder="https://…"')}</div>`,
          "Publish demo post",
        ),
      ) +
        '<p id="post-message" class="message" role="status" hidden></p><div id="posts-list" class="post-grid"></div>',
    );
}
function toggleNewMember() {
  const fresh = !$("report-member").value;
  $("new-member-fields").hidden = !fresh;
  $("new-member-fields")
    .querySelectorAll("input")
    .forEach((input) => (input.disabled = !fresh));
}
function renderOptions() {
  options(
    "report-member",
    data.members,
    "member_id",
    (p) => `#${p.member_id} · ${personName(p)}`,
    "New community member",
  );
  for (const id of ["report-coordinator", "review-coordinator"])
    options(
      id,
      data.coordinators,
      "coordinator_id",
      (p) => personName(p),
      "Select a coordinator",
    );
  options(
    "review-report",
    newest(data.incidents),
    "report_id",
    (r) => `#${r.report_id} · ${r.type} · ${r.city}`,
    "Select an incident",
  );
  const eligible = data.incidents.filter(
    (r) =>
      r.status !== "Resolved" &&
      !data.requests.some((q) => q.report_id === r.report_id),
  );
  options(
    "request-report",
    newest(eligible),
    "report_id",
    (r) => `#${r.report_id} · ${r.type} · ${r.city}`,
    eligible.length ? "Select an incident" : "No eligible incidents",
  );
  for (const id of ["request-unit", "update-unit"])
    options(id, data.units, "unit_name", (u) => u.unit_name, "Select a unit");
  for (const id of ["update-request", "resource-request", "resource-filter"])
    options(
      id,
      data.requests,
      "request_id",
      (r) => `#${r.request_id} · Incident #${r.report_id}`,
      id === "resource-filter" ? "All requests" : "Select a help request",
    );
  options(
    "resource-volunteer",
    data.volunteers,
    "vol_id",
    (p) => personName(p),
    "Select a volunteer",
  );
  options(
    "post-member",
    data.members,
    "member_id",
    (p) => personName(p),
    "Select a community member",
  );
  toggleNewMember();
}
function incidentDetails(id) {
  const r = find("incidents", "report_id", id);
  if (!r) return;
  const request = data.requests.find((q) => q.report_id === r.report_id);
  details(`Incident #${id}`, [
    ["Type", r.type],
    ["Location", `${r.street_address}, ${r.city}, ${r.state}`],
    ["Description", r.description],
    ["Status", badge(r.status)],
    ["Reported", `${r.report_date} at ${r.report_time}`],
    ["Community member", personName(find("members", "member_id", r.member_id))],
    [
      "Coordinator",
      personName(find("coordinators", "coordinator_id", r.coordinator_id)),
    ],
    [
      "Coordinates",
      r.latitude === null ? "Not provided" : `${r.latitude}, ${r.longitude}`,
    ],
    ["Radius", r.radius === null ? "Not provided" : `${r.radius} m`],
    ["Image", safeLink(r.image_url, "Open incident image")],
    [
      "Help request",
      request
        ? `#${request.request_id} · ${request.unit_name} · ${request.status}`
        : "No help request",
    ],
  ]);
}
function incidentRows(records) {
  return records.map((r) => [
    `#${r.report_id}`,
    r.type,
    `${r.street_address}, ${r.city}`,
    badge(r.status),
    button("View", () => incidentDetails(r.report_id)),
  ]);
}
function renderSearch() {
  const f = $("search-form"),
    query = f.elements.query.value.trim().toLowerCase(),
    type = f.elements.type.value,
    status = f.elements.status.value;
  const matches = newest(data.incidents).filter(
    (r) =>
      `${r.report_id} ${r.city} ${r.street_address} ${r.description}`
        .toLowerCase()
        .includes(query) &&
      (!type || r.type === type) &&
      (!status || r.status === status),
  );
  table(
    "incident-table",
    ["Report", "Type", "Location", "Status", "Details"],
    incidentRows(matches),
  );
  $("search-count").textContent = `${matches.length} demo incident(s) found.`;
}
function renderHome() {
  const stats = [
    ["Incident reports", data.incidents.length],
    [
      "Awaiting response",
      data.incidents.filter((r) => r.status !== "Resolved").length,
    ],
    ["Help requests", data.requests.length],
    ["Volunteers", data.volunteers.length],
  ];
  $("home-stats").replaceChildren();
  for (const [label, value] of stats) {
    const card = node("div", undefined, "stat");
    card.append(node("strong", value), node("span", label));
    $("home-stats").append(card);
  }
  table(
    "home-table",
    ["Report", "Type", "Location", "Status", "Details"],
    incidentRows(newest(data.incidents).slice(0, 5)),
  );
}
function requestDetails(id) {
  const r = find("requests", "request_id", id),
    report = find("incidents", "report_id", r.report_id),
    unit = find("units", "unit_name", r.unit_name),
    allocated = data.resources.filter((a) => a.request_id === r.request_id);
  const extra = node("div", undefined, "detail-section");
  extra.append(node("h3", "Allocated resources"));
  if (!allocated.length)
    extra.append(node("p", "No resources allocated yet.", "muted"));
  for (const a of allocated)
    extra.append(
      node(
        "p",
        `${a.amount} × ${a.item || a.service} · ${personName(find("volunteers", "vol_id", a.vol_id))}`,
      ),
    );
  details(
    `Help request #${id}`,
    [
      ["Incident", `#${report.report_id} · ${report.type} · ${report.city}`],
      ["Response unit", r.unit_name],
      ["Organization", unit.organization],
      ["Personnel", unit.personnel_count],
      ["Urgency", r.urgency],
      ["Status", badge(r.status)],
      ["911 called", r.called_911 ? "Yes" : "No"],
      ["Created", new Date(r.timestamp).toLocaleString()],
    ],
    extra,
  );
}
function renderRequests() {
  table(
    "request-table",
    [
      "Request",
      "Incident",
      "Response unit",
      "Urgency",
      "Status",
      "911",
      "Details",
    ],
    data.requests.map((r) => [
      `#${r.request_id}`,
      `#${r.report_id} · ${find("incidents", "report_id", r.report_id)?.type || "Unavailable"}`,
      r.unit_name,
      r.urgency,
      badge(r.status),
      r.called_911 ? "Yes" : "No",
      button("View", () => requestDetails(r.request_id)),
    ]),
  );
}
function renderResources() {
  const filter = $("resource-filter").value,
    rows = data.resources.filter(
      (r) => !filter || String(r.request_id) === filter,
    );
  table(
    "resource-table",
    ["Resource", "Request", "Volunteer", "Item / service", "Amount"],
    rows.map((r) => [
      `#${r.resource_id}`,
      `#${r.request_id}`,
      personName(find("volunteers", "vol_id", r.vol_id)),
      `${r.item ? "Item" : "Service"} · ${r.item || r.service}`,
      r.amount,
    ]),
  );
}
function renderPosts() {
  const list = $("posts-list");
  list.replaceChildren();
  if (!data.posts.length) {
    list.append(node("p", "No community posts to display.", "empty"));
    return;
  }
  for (const p of [...data.posts].reverse()) {
    const article = node("article", undefined, "panel");
    article.append(
      node("h3", p.post_title),
      node("p", p.post_content, "post-content"),
      node(
        "p",
        `Post #${p.post_id} · ${personName(find("members", "member_id", p.member_id))}`,
        "post-meta",
      ),
    );
    if (p.media) {
      const media = node("p");
      media.append(safeLink(p.media, "Open attached media"));
      article.append(media);
    }
    const remove = button(
      "Delete post",
      () =>
        confirm(
          "Delete this post?",
          `Remove “${p.post_title}” from the demo? You can restore sample posts by resetting the demo.`,
          "Delete post",
          () => {
            data.posts = data.posts.filter(
              (item) => item.post_id !== p.post_id,
            );
            save();
            renderPosts();
            message("post-message", `Demo post #${p.post_id} deleted.`);
            const next = list.querySelector("button");
            (next || document.querySelector('[data-screen="posts"]')).focus();
          },
        ),
      "delete-button",
    );
    remove.setAttribute("aria-label", `Delete post: ${p.post_title}`);
    article.append(remove);
    list.append(article);
  }
}
const directoryLabels = {
  members: "Community members",
  coordinators: "Response coordinators",
  volunteers: "Volunteers",
  units: "Response units",
};
function renderDirectory(changeFields = false) {
  const kind = $("directory-type").value;
  $("directory-title").textContent = directoryLabels[kind];
  if (kind === "units")
    table(
      "directory-table",
      ["Unit name", "Organization", "Personnel"],
      data.units.map((u) => [u.unit_name, u.organization, u.personnel_count]),
    );
  else if (kind === "members")
    table(
      "directory-table",
      ["ID", "Name", "Location", "Phone"],
      data.members.map((p) => [
        p.member_id,
        personName(p),
        `${p.street_address}, ${p.city}, ${p.state}`,
        p.tel_no,
      ]),
    );
  else {
    const key = kind === "coordinators" ? "coordinator_id" : "vol_id";
    table(
      "directory-table",
      ["ID", "Name", "Phone", "Email"],
      data[kind].map((p) => [p[key], personName(p), p.phone, p.email]),
    );
  }
  if (changeFields) {
    let fields;
    if (kind === "units")
      fields =
        field(
          "Unit name (unique)",
          "unit_name",
          "text",
          'required maxlength="100"',
        ) +
        field(
          "Organization",
          "organization",
          "text",
          'required maxlength="150"',
        ) +
        field(
          "Personnel count",
          "personnel_count",
          "number",
          'required min="0" step="1"',
        );
    else {
      fields =
        field("First name", "first_name", "text", 'required maxlength="80"') +
        field("Last name", "last_name", "text", 'required maxlength="80"') +
        field(
          "Phone",
          kind === "members" ? "tel_no" : "phone",
          "tel",
          phoneAttributes,
        );
      if (kind === "members")
        fields +=
          field(
            "Street address",
            "street_address",
            "text",
            'required maxlength="200"',
          ) +
          field("City", "city", "text", 'required maxlength="100"') +
          field("State", "state", "text", 'required maxlength="100"');
      else
        fields += field("Email", "email", "email", 'required maxlength="200"');
    }
    $("directory-fields").innerHTML = fields;
  }
}
function syncReview() {
  const r = find("incidents", "report_id", $("review-report").value);
  $("review-current").textContent = r
    ? `Current status: ${r.status}`
    : "Select an incident to review.";
  if (r) {
    $("review-coordinator").value = String(r.coordinator_id);
    $("review-status").value = r.status;
  }
}
function syncRequest() {
  const r = find("requests", "request_id", $("update-request").value);
  if (r) {
    $("update-unit").value = r.unit_name;
    $("update-urgency").value = r.urgency;
    $("update-status").value = r.status;
    $("update-911").checked = r.called_911;
  }
}
function refresh() {
  renderOptions();
  renderHome();
  renderSearch();
  renderRequests();
  renderResources();
  renderPosts();
  renderDirectory();
  syncReview();
  syncRequest();
}
function values(formElement) {
  const result = Object.fromEntries(new FormData(formElement));
  for (const key in result)
    if (typeof result[key] === "string") result[key] = result[key].trim();
  return result;
}
function requireText(value, label) {
  if (!value) throw Error(`${label} is required. Spaces alone are not valid.`);
  return value;
}
function requireRecord(collection, key, id, label) {
  const record = find(collection, key, id);
  if (!record) throw Error(`Select an existing ${label}.`);
  return record;
}
function integer(value, min, label) {
  const result = Number(value);
  if (value === "" || !Number.isSafeInteger(result) || result < min)
    throw Error(`${label} must be a whole number of at least ${min}.`);
  return result;
}
function validUrl(url, label) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (["http:", "https:"].includes(u.protocol)) return url;
  } catch {}
  throw Error(`${label} must start with http:// or https://.`);
}
function onSubmit(id, handler) {
  const f = $(id);
  f.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!f.reportValidity()) return;
    try {
      handler(values(f), f);
    } catch (error) {
      message(`${id}-message`, error.message, true);
    }
  });
  f.addEventListener("reset", () => {
    message(`${id}-message`, "");
    setTimeout(() => {
      toggleNewMember();
      if (id === "review-form") syncReview();
      if (id === "request-update-form") syncRequest();
    }, 0);
  });
}
function setupForms() {
  $("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    renderSearch();
  });
  $("search-form").addEventListener("reset", () => setTimeout(renderSearch, 0));
  $("report-member").addEventListener("change", toggleNewMember);
  $("review-report").addEventListener("change", () => {
    syncReview();
    message("review-form-message", "");
  });
  $("update-request").addEventListener("change", () => {
    syncRequest();
    message("request-update-form-message", "");
  });
  $("resource-filter").addEventListener("change", renderResources);
  $("directory-type").addEventListener("change", () => {
    renderDirectory(true);
    message("directory-form-message", "");
  });
  onSubmit("report-form", (v, f) => {
    const coordinator = requireRecord(
      "coordinators",
      "coordinator_id",
      v.coordinator_id,
      "coordinator",
    );
    if (!TYPES.includes(v.type)) throw Error("Select a valid incident type.");
    for (const key of ["street_address", "city", "state", "description"])
      requireText(v[key], key.replaceAll("_", " "));
    const image = validUrl(v.image_url, "Image URL");
    if (Boolean(v.latitude) !== Boolean(v.longitude))
      throw Error("Enter both latitude and longitude, or leave both empty.");
    const latitude = v.latitude === "" ? null : Number(v.latitude),
      longitude = v.longitude === "" ? null : Number(v.longitude);
    if (
      latitude !== null &&
      (!Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180)
    )
      throw Error("Enter valid coordinates.");
    const radius = v.radius === "" ? null : integer(v.radius, 0, "Radius");
    let member;
    if (v.member_id)
      member = requireRecord(
        "members",
        "member_id",
        v.member_id,
        "community member",
      );
    else {
      for (const key of [
        "first_name",
        "last_name",
        "tel_no",
        "member_street_address",
        "member_city",
        "member_state",
      ])
        requireText(v[key], key.replaceAll("_", " "));
      if (!/^([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4})$/.test(v.tel_no))
        throw Error("Use a 10-digit phone number.");
      member = {
        member_id: nextId("members", "member_id"),
        first_name: v.first_name,
        last_name: v.last_name,
        tel_no: v.tel_no,
        street_address: v.member_street_address,
        city: v.member_city,
        state: v.member_state,
      };
    }
    const now = new Date(),
      pad = (n) => String(n).padStart(2, "0");
    const report = {
      report_id: nextId("incidents", "report_id"),
      member_id: member.member_id,
      coordinator_id: coordinator.coordinator_id,
      street_address: v.street_address,
      city: v.city,
      state: v.state,
      latitude,
      longitude,
      radius,
      image_url: image,
      type: v.type,
      description: v.description,
      status: "Pending Assistance",
      report_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      report_time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    };
    if (!v.member_id) data.members.push(member);
    data.incidents.push(report);
    save();
    f.reset();
    refresh();
    message(
      "report-form-message",
      `Demo report #${report.report_id} added. Find it in Incidents or Response Desk.`,
    );
  });
  onSubmit("review-form", (v) => {
    const report = requireRecord(
        "incidents",
        "report_id",
        v.report_id,
        "incident",
      ),
      coordinator = requireRecord(
        "coordinators",
        "coordinator_id",
        v.coordinator_id,
        "coordinator",
      );
    if (!INCIDENT_STATUSES.includes(v.status))
      throw Error("Select a valid status.");
    const request = data.requests.find((q) => q.report_id === report.report_id);
    if (request && v.status !== REQUEST_TO_INCIDENT[request.status])
      throw Error(
        "Update the linked help request below to change response status.",
      );
    if (!request && ["Help Requested", "Unit in Response"].includes(v.status))
      throw Error("Create a help request before setting this response status.");
    report.coordinator_id = coordinator.coordinator_id;
    report.status = v.status;
    save();
    refresh();
    message(
      "review-form-message",
      `Demo review saved for incident #${report.report_id}.`,
    );
  });
  onSubmit("request-form", (v, f) => {
    const report = requireRecord(
      "incidents",
      "report_id",
      v.report_id,
      "incident",
    );
    requireRecord("units", "unit_name", v.unit_name, "response unit");
    if (data.requests.some((q) => q.report_id === report.report_id))
      throw Error("This incident already has a help request.");
    if (report.status === "Resolved")
      throw Error("Reopen the incident before creating a help request.");
    if (!URGENCIES.includes(v.urgency)) throw Error("Select a valid urgency.");
    const request = {
      request_id: nextId("requests", "request_id"),
      report_id: report.report_id,
      unit_name: v.unit_name,
      urgency: v.urgency,
      status: "Pending",
      timestamp: new Date().toISOString(),
      called_911: v.called_911 === "on",
    };
    data.requests.push(request);
    report.status = "Help Requested";
    save();
    f.reset();
    refresh();
    message(
      "request-form-message",
      `Demo help request #${request.request_id} created and assigned to ${request.unit_name}.`,
    );
  });
  onSubmit("request-update-form", (v) => {
    const request = requireRecord(
      "requests",
      "request_id",
      v.request_id,
      "help request",
    );
    requireRecord("units", "unit_name", v.unit_name, "response unit");
    if (!REQUEST_STATUSES.includes(v.status) || !URGENCIES.includes(v.urgency))
      throw Error("Select a valid status and urgency.");
    Object.assign(request, {
      unit_name: v.unit_name,
      urgency: v.urgency,
      status: v.status,
      called_911: v.called_911 === "on",
    });
    find("incidents", "report_id", request.report_id).status =
      REQUEST_TO_INCIDENT[v.status];
    save();
    refresh();
    message(
      "request-update-form-message",
      `Demo request #${request.request_id} saved. Its incident is now ${REQUEST_TO_INCIDENT[v.status]}.`,
    );
  });
  onSubmit("resource-form", (v, f) => {
    const request = requireRecord(
        "requests",
        "request_id",
        v.request_id,
        "help request",
      ),
      volunteer = requireRecord("volunteers", "vol_id", v.vol_id, "volunteer");
    const amount = integer(v.amount, 1, "Amount");
    requireText(v.description, "Description");
    if (!["Item", "Service"].includes(v.kind))
      throw Error("Select Item or Service.");
    const r = {
      resource_id: nextId("resources", "resource_id"),
      request_id: request.request_id,
      vol_id: volunteer.vol_id,
      amount,
      item: v.kind === "Item" ? v.description : "",
      service: v.kind === "Service" ? v.description : "",
    };
    data.resources.push(r);
    save();
    f.reset();
    refresh();
    message(
      "resource-form-message",
      `Demo resource #${r.resource_id} allocated to request #${request.request_id}.`,
    );
  });
  onSubmit("directory-form", (v, f) => {
    const kind = $("directory-type").value;
    let record;
    if (kind === "units") {
      requireText(v.unit_name, "Unit name");
      requireText(v.organization, "Organization");
      if (
        data.units.some(
          (u) => u.unit_name.toLowerCase() === v.unit_name.toLowerCase(),
        )
      )
        throw Error("A response unit with this name already exists.");
      record = {
        unit_name: v.unit_name,
        organization: v.organization,
        personnel_count: integer(v.personnel_count, 0, "Personnel count"),
      };
    } else {
      for (const key of [
        "first_name",
        "last_name",
        kind === "members" ? "tel_no" : "phone",
      ])
        requireText(v[key], key.replaceAll("_", " "));
      const key =
        kind === "members"
          ? "member_id"
          : kind === "coordinators"
            ? "coordinator_id"
            : "vol_id";
      record = { [key]: nextId(kind, key), ...v };
      if (kind === "members")
        for (const key of ["street_address", "city", "state"])
          requireText(v[key], key.replaceAll("_", " "));
      else requireText(v.email, "Email");
    }
    data[kind].push(record);
    save();
    f.reset();
    refresh();
    message(
      "directory-form-message",
      `Demo record added to ${directoryLabels[kind].toLowerCase()}.`,
    );
  });
  onSubmit("post-form", (v, f) => {
    const member = requireRecord(
      "members",
      "member_id",
      v.member_id,
      "community member",
    );
    requireText(v.post_title, "Title");
    requireText(v.post_content, "Post content");
    if (v.post_title.length > 50 || v.post_content.length > 3000)
      throw Error("The post exceeds the allowed length.");
    const media = validUrl(v.media, "Media URL");
    const post = {
      post_id: nextId("posts", "post_id"),
      member_id: member.member_id,
      post_title: v.post_title,
      post_content: v.post_content,
      media,
    };
    data.posts.push(post);
    save();
    f.reset();
    refresh();
    message("post-form-message", `Demo post #${post.post_id} published.`);
  });
}
function start() {
  load();
  renderShell();
  renderDirectory(true);
  refresh();
  setupForms();
  save();
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("button[data-screen]");
    if (nav) showScreen(nav.dataset.screen);
  });
  $("close-details").addEventListener("click", () =>
    $("details-dialog").close(),
  );
  $("confirm-cancel").addEventListener("click", () =>
    $("confirm-dialog").close(),
  );
  $("confirm-accept").addEventListener("click", () => {
    const action = confirmAction;
    confirmAction = null;
    $("confirm-dialog").close();
    if (action) action();
  });
  $("confirm-dialog").addEventListener("close", () => (confirmAction = null));
  $("reset-demo").addEventListener("click", () =>
    confirm(
      "Reset demo data?",
      "This removes your demo edits and restores the original sample records.",
      "Reset demo",
      () => {
        data = clone(initialData);
        document.querySelectorAll("form").forEach((f) => f.reset());
        save();
        refresh();
        document.querySelectorAll(".message").forEach((m) => {
          m.hidden = true;
          m.textContent = "";
        });
        showScreen("home");
      },
    ),
  );
  showScreen("home", false);
}
try {
  start();
} catch (error) {
  console.error(error);
  const errorBox = document.getElementById("app-error");
  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent =
      "The frontend could not start. Keep index.html, style.css, and main.js together and reload. Error: " +
      error.message;
  }
}
