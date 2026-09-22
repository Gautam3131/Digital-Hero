import AuthPanel from "./AuthPanel"
import { apiFetch } from "./apiBase"

async function login(email, password) {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "Sign in could not be completed.")
  if (!data.member) throw new Error("The server returned an incomplete sign-in response.")
  return data.member
}

export default function SignInPage() {
  return <AuthPanel backHref="/" description="Sign in to see your scores, draw entries, rewards, and the good your membership is already moving." onSubmit={async ({ email, password }) => { await login(email, password); window.location.assign("/subscriber-dashboard") }} redirectPath="/sign-in" submitLabel="Open my dashboard" title="Welcome back" />
}
