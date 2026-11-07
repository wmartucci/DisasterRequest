const API_BASE_URL = "http://localhost:8000";

async function requestApi(path, options = {}) {
    const { headers = {}, ...rest } = options;

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        // Send and receive the session cookie set by SessionMiddleware.
        // Required because the frontend (port 5500) and API (port 8000)
        // are different origins.
        credentials: "include",
        headers: { Accept: "application/json", ...headers },
    });

    if (!response.ok) {
        let detail = `API request failed (${response.status})`;
        try {
            const body = await response.json();
            if (Array.isArray(body.detail)) {
                // FastAPI's own validation errors (422) arrive as a list, e.g.
                // [{loc: ["body", "email"], msg: "Field required"}].
                // Turn them into "email: Field required".
                detail = body.detail
                    .map((err) => `${err.loc?.at(-1) ?? "request"}: ${err.msg}`)
                    .join("; ");
            } else if (body.detail) {
                detail = body.detail;
            }
        } catch {
            // Keep the status-based message when the server did not return JSON.
        }
        const error = new Error(detail);
        error.status = response.status;
        throw error;
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

export function signup({
    first_name,
    last_name,
    role,
    user_name,
    password,
    email,
    street_address,
    city,
    state,
    tel_no,
}) {
    return requestApi("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            first_name,
            last_name,
            role,
            user_name,
            password,
            email,
            street_address,
            city,
            state,
            tel_no,
        }),
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