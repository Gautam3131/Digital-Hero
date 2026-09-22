const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

export function apiUrl(path) {
  return `${apiBase}${path}`
}

export function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), { credentials: apiBase ? "include" : "same-origin", ...options })
}
