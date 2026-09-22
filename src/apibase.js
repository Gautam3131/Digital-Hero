const configuredApiBase = import.meta.env.VITE_API_BASE_URL || ""
const productionApiBase = "https://digital-heroes-api-production.up.railway.app"
const apiBase = (configuredApiBase || (import.meta.env.PROD ? productionApiBase : "")).replace(/\/$/, "")

export function apiUrl(path) {
  return `${apiBase}${path}`
}

export function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), { credentials: apiBase ? "include" : "same-origin", ...options }).catch((error) => {
    if (error instanceof TypeError) throw new Error("The API server is unavailable. Check the server health and try again.")
    throw error
  })
}
