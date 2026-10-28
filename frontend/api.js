const API_BASE_URL = "http://localhost:8000";

async function requestApi(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Accept: "application/json", ...options.headers },
        ...options,
    });

    if (!response.ok) {
        let detail = `API request failed (${response.status})`;
        try {
            detail = (await response.json()).detail || detail;
        } catch {
            // Keep the status-based message when the server did not return JSON.
        }
        throw new Error(detail);
    }

    // 204 No Content (e.g. /api/logout) has no body to parse.
    if (response.status === 204) return null;
    
    return response.json();
}
 
// --------- AUTH functions ----------
export function login(user_name, password) {
    return requestApi("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name, password }),
    });
}
 
export function signup({ first_name, last_name, role, user_name, password }) {
    return requestApi("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name, last_name, role, user_name, password }),
    });
}
 
export function logout() {
    return requestApi("/api/logout", { method: "POST" });
}
 
export function getCurrentUser() {
    return requestApi("/api/me");
}

// --------- CREATE functions ----------
export function createIncidentReport({
    member_id,
    type,
    address,
    city,
    state,
    image_url = null,
    description,
    status,
    latitude,
    longitude,
}) {
    const report = {
        member_id,
        type,
        address,
        city,
        state,
        image_url,
        description,
        status,
        latitude,
        longitude,
    };

    return requestApi("/api/incident-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
    });
}

// --------- READ functions ----------
export function getIncidentReports() {
    return requestApi("/api/incident-reports");
}

export function getIncidentReport(reportId) {
    return requestApi(
        `/api/incident-reports?report_id=${encodeURIComponent(reportId)}`,
    );
}

export function getCommunityMembers(filters = {}) {
    const params = new URLSearchParams(filters);
    return requestApi(`/api/community-members?${params}`);
}

export function getVolunteers() {
    return requestApi("/api/volunteers");
}

// --------- UPDATE functions ----------
export function updateIncidentReportStatus(reportId, newStatus) {
    return requestApi(`/api/incident-reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: newStatus }),
    });
}

// --------- DELETE functions ----------
export function deleteIncidentReport(reportId) {
    return requestApi(`/api/incident-reports/${encodeURIComponent(reportId)}`, {
        method: "DELETE",
    });
}
