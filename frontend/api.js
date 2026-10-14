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
  return response.json();
}

export function getIncidentReports() {
  return requestApi("/api/incident-reports");
}

export function getIncidentReport(reportId) {
  return requestApi(`/api/incident-reports?report_id=${encodeURIComponent(reportId)}`);
}

export function getCommunityMembers(filters = {}) {
  const params = new URLSearchParams(filters);
  return requestApi(`/api/community-members?${params}`);
}

export function getVolunteers() {
  return requestApi("/api/volunteers");
}
