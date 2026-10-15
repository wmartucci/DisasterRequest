import {
  getIncidentReports as getReports,
  getCommunityMembers as getMembers,
  createIncidentReport,
  updateIncidentReportStatus as updateStatus,
  deleteIncidentReport as deleteReport,
} from "./api.js";

const createReport = (payload) =>
  createIncidentReport({ ...payload, status: "Pending Assistance" });

const readableError = (error) =>
  error.message?.includes("[object Object]")
    ? "The API rejected one or more fields. Check the report values and try again."
    : error.message || "The request could not be completed. Please try again.";

const $ = (selector) => document.querySelector(selector);

const statuses = [
  "Pending Assistance",
  "Help Requested",
  "Unit in Response",
  "Resolved",
];

const types = ["Fallen Tree", "Flood", "Fire", "Power"];

let reports = [];
let members = [];
let ready = false;
let busy = false;
let loading = false;
let generation = 0;
let pendingDelete = null;

function make(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function options(select, values) {
  values.forEach((value) => select.add(new Option(value, value)));
}

options($("#status-filter"), statuses);
options($("#update-status"), statuses);
options($("#type-filter"), types);
options($("#create-type"), types);

function clearMessages() {
  $("#error").hidden = true;
  $("#notice").hidden = true;
}

function message(text, error = false) {
  const target = $(error ? "#error" : "#notice");
  target.textContent = text;
  target.className = error ? "message error" : "message success";
  target.hidden = false;
}

function show(screen) {
  document.querySelectorAll(".screen").forEach((section) => {
    section.hidden = section.id !== screen;
  });

  document.querySelectorAll("[data-screen]").forEach((button) => {
    if (button.dataset.screen === screen) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function syncControls() {
  const enabled = ready && !busy && !loading;

  document.querySelectorAll("[data-write]").forEach((button) => {
    button.disabled = !enabled;
  });

  $("#create-form [type=submit]").disabled = !enabled || !members.length;
  $("#refresh").disabled = busy || loading;
  $("#confirm-delete").disabled = busy;
  $("#cancel-delete").disabled = busy;

  $("#connection").textContent = loading
    ? "Loading reports…"
    : ready
      ? `${reports.length} reports loaded`
      : "Reports unavailable";

  document.querySelectorAll(".write-note").forEach((note) => {
    note.textContent = "Changes are sent to the team API.";
  });
}

function reporter(report) {
  const member = members.find(
    (item) => Number(item.member_id) === Number(report.member_id),
  );

  return {
    name:
      [
        report.first_name ?? member?.first_name,
        report.last_name ?? member?.last_name,
      ]
        .filter(Boolean)
        .join(" ") || `Member #${report.member_id}`,
    phone: report.tel_no ?? member?.tel_no ?? "Phone unavailable",
  };
}

function date(value) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString()
    : "Not available";
}

function render() {
  $("#total").textContent = ready ? reports.length : "—";

  $("#pending").textContent = ready
    ? reports.filter((r) => r.status === "Pending Assistance").length
    : "—";

  $("#resolved").textContent = ready
    ? reports.filter((r) => r.status === "Resolved").length
    : "—";

  const query = $("#query").value.trim().toLowerCase();

  const filtered = reports.filter(
    (r) =>
      (!$("#status-filter").value || r.status === $("#status-filter").value) &&
      (!$("#type-filter").value || r.type === $("#type-filter").value) &&
      [r.report_id, reporter(r).name, r.address, r.city, r.state, r.description]
        .join(" ")
        .toLowerCase()
        .includes(query),
  );

  $("#rows").replaceChildren();

  $("#count").textContent = ready
    ? `${filtered.length} of ${reports.length} reports`
    : loading
      ? "Loading reports…"
      : "Reports could not be loaded. Use Refresh reports to try again.";

  if (!filtered.length) {
    const row = make("tr");
    const cell = make(
      "td",
      ready ? "No reports match your filters." : "No reports loaded.",
      "empty",
    );
    cell.colSpan = 5;
    row.append(cell);
    $("#rows").append(row);
  }

  filtered.forEach((report) => {
    const row = make("tr");

    const cells = [
      "Report",
      "Community member",
      "Location",
      "Status",
      "Actions",
    ].map((label) => {
      const cell = make("td");
      cell.dataset.label = label;
      row.append(cell);
      return cell;
    });

    cells[0].append(
      make("strong", `#${report.report_id} · ${report.type}`),
      make("small", date(report.report_timestamp)),
    );

    cells[1].append(
      make("span", reporter(report).name),
      make("small", `Member #${report.member_id} · ${reporter(report).phone}`),
    );

    cells[2].append(
      make("span", report.address),
      make("small", [report.city, report.state].filter(Boolean).join(", ")),
    );

    cells[3].append(
      make(
        "span",
        report.status,
        `status-chip ${report.status === "Resolved" ? "resolved" : ""}`,
      ),
    );

    const actions = make("div");

    const details = make("button", "Details", "secondary-button");
    details.type = "button";
    details.setAttribute("aria-label", `View report ${report.report_id}`);
    details.addEventListener("click", () => openDetails(report));
    actions.append(details);

    const manage = make("button", "Manage", "secondary-button");
    manage.type = "button";
    manage.setAttribute("aria-label", `Manage report ${report.report_id}`);

    manage.addEventListener("click", () => {
      clearMessages();
      show("manage");
      $("#update-form [name=report_id]").value = report.report_id;
      $("#delete-form [name=report_id]").value = report.report_id;
      $("#update-status").value = report.status;
      $("#update-form [name=report_id]").focus();
    });

    actions.append(manage);
    cells[4].append(actions);
    $("#rows").append(row);
  });

  syncControls();
}

function renderMembers() {
  const previous = $("#member").value;

  $("#member").replaceChildren(
    new Option(
      members.length ? "Select a community member" : "No members available",
      "",
    ),
  );

  members.forEach((member) => {
    $("#member").add(
      new Option(
        `#${member.member_id} · ${member.first_name} ${member.last_name}`,
        member.member_id,
      ),
    );
  });

  if (members.some((member) => String(member.member_id) === previous)) {
    $("#member").value = previous;
  }
}

function openDetails(report) {
  $("#details-title").textContent = `Incident #${report.report_id}`;

  const list = make("dl", null, "details-list");

  const values = {
    Type: report.type,
    Status: report.status,
    Reporter: `${reporter(report).name} (member #${report.member_id})`,
    Phone: reporter(report).phone,
    Address: [report.address, report.city, report.state]
      .filter(Boolean)
      .join(", "),
    Reported: date(report.report_timestamp),
    Description: report.description,
    Coordinates:
      report.latitude != null && report.longitude != null
        ? `${report.latitude}, ${report.longitude}`
        : "Not available",
    Coordinator: report.coordinator_id ?? "Unassigned",
  };

  for (const [label, value] of Object.entries(values)) {
    list.append(make("dt", label), make("dd", value));
  }

  if (report.image_url) {
    const term = make("dt", "Image");
    const value = make("dd");

    try {
      const url = new URL(report.image_url);
      if (!["https:", "http:"].includes(url.protocol)) throw Error();

      const link = make("a", "Open attached image");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      value.append(link);
    } catch {
      value.textContent = "Image link unavailable";
    }

    list.append(term, value);
  }

  $("#details-body").replaceChildren(list);
  $("#details").showModal();
}

async function load() {
  const token = ++generation;
  loading = true;
  ready = false;
  render();

  const [reportResult, memberResult] = await Promise.allSettled([
    getReports(),
    getMembers(),
  ]);

  if (token !== generation) return;

  reports = [];
  members = [];
  loading = false;

  if (
    reportResult.status === "fulfilled" &&
    Array.isArray(reportResult.value)
  ) {
    reports = reportResult.value;
    ready = true;
  } else {
    message(
      reportResult.status === "rejected"
        ? readableError(reportResult.reason)
        : "The reports API returned an unexpected format.",
      true,
    );
  }

  if (memberResult.status === "fulfilled" && Array.isArray(memberResult.value)) {
    members = memberResult.value;
  } else if (ready) {
    message(
      "Reports loaded, but community members could not be loaded. Creating reports is unavailable until members load.",
      true,
    );
  }

  renderMembers();
  render();
}

async function refreshAfterChange(success) {
  await load();

  message(
    ready
      ? success
      : `${success} The list could not refresh. Use Refresh reports before making another change.`,
  );
}

function getId(form) {
  const id = Number(new FormData(form).get("report_id"));

  if (!Number.isSafeInteger(id) || id < 1) {
    throw Error("Enter a valid positive report ID.");
  }

  return id;
}

function checkWrite() {
  if (!ready || loading) {
    throw Error("Load reports before making changes.");
  }
}

async function mutate(operation) {
  if (busy) return;
  clearMessages();

  try {
    checkWrite();
    busy = true;
    syncControls();
    await operation();
  } catch (error) {
    message(readableError(error), true);
  } finally {
    busy = false;
    syncControls();
  }
}

$("#create-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  mutate(async () => {
    const payload = Object.fromEntries(new FormData(form));

    for (const key of ["address", "city", "state", "description"]) {
      payload[key] = payload[key].trim();

      if (!payload[key]) {
        throw Error(`${key[0].toUpperCase() + key.slice(1)} cannot be blank.`);
      }
    }

    payload.member_id = Number(payload.member_id);
    payload.latitude = Number(payload.latitude);
    payload.longitude = Number(payload.longitude);

    if (!members.some((m) => Number(m.member_id) === payload.member_id)) {
      throw Error("Choose an existing community member.");
    }

    if (!types.includes(payload.type)) {
      throw Error("Choose a valid incident type.");
    }

    if (
      !Number.isFinite(payload.latitude) ||
      Math.abs(payload.latitude) > 90 ||
      !Number.isFinite(payload.longitude) ||
      Math.abs(payload.longitude) > 180
    ) {
      throw Error("Enter valid latitude and longitude.");
    }

    payload.image_url = payload.image_url.trim() || null;

    if (payload.image_url && !/^https?:\/\//i.test(payload.image_url)) {
      throw Error("Image URL must start with http:// or https://.");
    }

    await createReport(payload);
    form.reset();
    await refreshAfterChange("Incident created.");
    show("browse");
  });
});

$("#update-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  mutate(async () => {
    const id = getId(form);
    const status = new FormData(form).get("status");

    if (!statuses.includes(status)) {
      throw Error("Choose a valid report status.");
    }

    await updateStatus(id, status);
    await refreshAfterChange(`Report #${id} status updated.`);
  });
});

$("#delete-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessages();

  try {
    checkWrite();
    if (busy) return;

    const id = getId(event.currentTarget);
    const report = reports.find((r) => Number(r.report_id) === id);

    if (!report) {
      throw Error(
        `No incident report with ID ${id} in the loaded list. Refresh reports to check again.`,
      );
    }

    pendingDelete = id;

    $("#delete-description").textContent =
      `Report #${id} · ${report.type} · ${report.address}, ${report.city}`;

    $("#delete-error").hidden = true;
    $("#confirm").showModal();
  } catch (error) {
    message(readableError(error), true);
  }
});

$("#confirm-delete").addEventListener("click", () => {
  mutate(async () => {
    const id = pendingDelete;
    if (id === null) throw Error("Choose a report to delete.");

    try {
      await deleteReport(id);
      await refreshAfterChange(`Report #${id} deleted.`);
      $("#confirm").close();
      pendingDelete = null;
      $("#delete-form").reset();
    } catch (error) {
      $("#delete-error").textContent = readableError(error);
      $("#delete-error").hidden = false;
      throw error;
    }
  });
});

$("#cancel-delete").addEventListener("click", () => {
  $("#confirm").close();
  pendingDelete = null;
});

$("#confirm").addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
  else pendingDelete = null;
});

$("#close-details").addEventListener("click", () => {
  $("#details").close();
});

document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => {
    clearMessages();
    show(button.dataset.screen);
  });
});

$("#filters").addEventListener("submit", (event) => {
  event.preventDefault();
});

$("#filters").addEventListener("input", render);

$("#filters").addEventListener("reset", () => {
  setTimeout(render, 0);
});

$("#refresh").addEventListener("click", () => {
  clearMessages();
  load();
});

load();
