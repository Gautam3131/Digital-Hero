import { useEffect, useState } from "react"
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, Github, LoaderCircle } from "lucide-react"
import { apiFetch, apiUrl } from "./apiBase"
import "./auth-panel.css"

function GoogleMark() {
  return <span className="auth-google-mark" aria-hidden="true">G</span>
}

function AstronautArt() {
  return <div className="auth-astronaut-wrap" aria-hidden="true"><div className="auth-star auth-star-one" /><div className="auth-star auth-star-two" /><div className="auth-star auth-star-three" /><div className="auth-star auth-star-four" /><div className="auth-orbit-line auth-orbit-line-one" /><div className="auth-orbit-line auth-orbit-line-two" /><svg className="auth-astronaut" viewBox="0 0 300 360" role="presentation"><defs><linearGradient id="suit" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#e5d7ff" /><stop offset=".48" stopColor="#ad7dff" /><stop offset="1" stopColor="#6842d5" /></linearGradient><linearGradient id="visor" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#2c1b61" /><stop offset="1" stopColor="#0c0b1a" /></linearGradient></defs><g className="auth-astronaut-body"><ellipse cx="154" cy="326" fill="rgba(95, 55, 210, .32)" rx="72" ry="12" /><path d="M132 81c-21 8-34 30-32 57l7 63c2 17 11 31 25 39l-1 40-31 32c-8 8-7 22 3 28 8 5 19 3 25-5l37-46 11-1 25 43c5 9 16 13 25 8 10-5 14-17 9-27l-23-48 10-35c10-14 14-29 12-47l-5-49c-3-27-20-46-43-52Z" fill="url(#suit)" stroke="#f1eaff" strokeWidth="3" /><circle cx="151" cy="77" fill="url(#suit)" r="48" stroke="#f1eaff" strokeWidth="4" /><path d="M116 71c1-22 16-35 37-35 22 0 37 13 38 35l-3 18c-18 9-47 9-69 0Z" fill="url(#visor)" stroke="#e1d0ff" strokeWidth="3" /><path d="m101 168-30 37c-7 8-6 20 2 27 8 7 20 6 27-2l31-35M207 169l31 34c7 8 6 20-2 27-8 7-20 6-27-2l-31-35" fill="none" stroke="#d9c4ff" strokeLinecap="round" strokeWidth="16" /><path d="M143 123h20M139 142h29" fill="none" stroke="#f5f0ff" strokeLinecap="round" strokeWidth="4" /><circle cx="132" cy="183" fill="#1b1630" r="13" /><circle cx="132" cy="183" fill="#d7fa6b" r="5" /><path d="M130 230c16 9 35 9 49-1" fill="none" stroke="#f5f0ff" strokeLinecap="round" strokeWidth="4" /><path d="M132 273 119 301M183 273l18 31" fill="none" stroke="#f5f0ff" strokeLinecap="round" strokeWidth="12" /></g></svg><span className="auth-astronaut-caption">Keep your signal moving.</span></div>
}

const socialCopy = {
  google: { label: "Continue with Google", icon: <GoogleMark /> },
  github: { label: "Continue with GitHub", icon: <Github size={17} /> },
}

export default function AuthPanel({
  backHref = "/",
  backLabel = "Back to public signal",
  description = "Sign in to access your dashboard, scores, and membership impact.",
  eyebrow = "Member access / 005",
  onSubmit,
  submitLabel = "Sign in",
  title = "Sign in to your account",
  redirectPath = window.location.pathname,
}) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [providers, setProviders] = useState({ google: false, github: false })

  useEffect(() => {
    apiFetch("/api/auth/providers").then((response) => response.ok ? response.json() : null).then((data) => data && setProviders(data)).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get("auth") === "error") setMessage(params.get("reason") === "admin_social_login_disabled" ? "Administrators must use their assigned credentials." : "Social sign in could not be completed. Try again or use email.")
    if (params.has("auth")) window.history.replaceState({}, "", window.location.pathname)
  }, [])

  async function submit(event) {
    event.preventDefault()
    setStatus("loading")
    setMessage("")
    const form = new FormData(event.currentTarget)
    try {
      await onSubmit({ email: form.get("email"), password: form.get("password") })
    } catch (error) {
      setMessage(error.message || "Sign in could not be completed.")
      setStatus("error")
      return
    }
    setStatus("success")
  }

  function startSocial(provider) {
    window.location.assign(apiUrl(`/api/auth/${provider}?redirect=${encodeURIComponent(redirectPath)}`))
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-form-side"><div className="auth-brand"><span className="wordmark-dot" /> digital <strong>heroes</strong></div><div className="auth-copy"><p className="auth-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div><div className="auth-socials"><button className="auth-social-button" disabled={!providers.google || status === "loading"} onClick={() => startSocial("google")} type="button">{socialCopy.google.icon}{socialCopy.google.label}</button><button className="auth-social-button" disabled={!providers.github || status === "loading"} onClick={() => startSocial("github")} type="button">{socialCopy.github.icon}{socialCopy.github.label}</button></div><div className="auth-divider"><span>or sign in with email</span></div><form className="auth-form" onSubmit={submit}><label>Email<input autoComplete="email" name="email" placeholder="member@example.com" required type="email" /></label><label>Password<span className="auth-password-field"><input autoComplete="current-password" name="password" placeholder="Your password" required type={showPassword ? "text" : "password"} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>{message ? <p className="auth-error" role="alert">{message}</p> : null}<button className="auth-submit" disabled={status === "loading"} type="submit">{status === "loading" ? <><LoaderCircle className="auth-spinner" size={16} /> Signing in...</> : <>{submitLabel}<ArrowUpRight size={16} /></>}</button></form><p className="auth-terms">By continuing, you agree to our <a href="/help-center">Terms</a> and <a href="/help-center">Privacy Policy</a>.</p><button className="auth-back" onClick={() => window.location.assign(backHref)} type="button"><ArrowLeft size={15} /> {backLabel}</button></div><div className="auth-art-side"><div className="auth-art-kicker"><span /> Digital Heroes / member signal</div><AstronautArt /><div className="auth-art-copy"><strong>Good things are<br /><em>already in motion.</em></strong><span>Sign in and keep your next round moving.</span></div></div></section></main>
}

