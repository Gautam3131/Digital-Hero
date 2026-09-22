# Digital Heroes

The Digital Heroes platform: an impact-led public landing page with live INR pool telemetry, a Core Objectives / User Roles system map, a connected Subscription / Score Management experience, authenticated Registered Subscriber and member-briefing surfaces, a public Past Draws / Charity Impact archive, a Gemini-powered Help Center, and a role-protected administrator control room.

## Run

```bash
npm install
npm run build
npm start
```

For local end-to-end coverage, run `npm run test:e2e`. The test defaults to a temporary SQLite database and a local mock Stripe checkout, so it never charges a card. To exercise the live Stripe branch intentionally, run `E2E_STRIPE_MODE=live npm run test:e2e` with live environment variables configured.

Open `http://localhost:8787`.

CI/CD setup, GitHub Environment placeholders, Vercel frontend deployment, Render backend deployment, and secret injection instructions are documented in `docs/ci-cd.md`.

Open `http://localhost:8787/objectives-roles` for page two.

Open `http://localhost:8787/subscription-scores` for page three.

Open `http://localhost:8787/admin-dashboard` for the administrator control room.

Open `http://localhost:8787/admin-content` for the role-protected content publishing studio.

Open `http://localhost:8787/member-content` for the authenticated registered-member briefing channel.

Open `http://localhost:8787/winner-verification` for the dedicated Winner Verification & Payout Management proofroom. The local demo admin is `admin@digitalheroes.local` / `demo-admin`.

Open `http://localhost:8787/past-draws` for the public draw archive and charity impact ledger.

Open `http://localhost:8787/help-center` for the 3D Help Center and AI support console.

Open `http://localhost:8787/subscriber-dashboard` for the authenticated member dashboard. The local demo member is `member@digitalheroes.local` / `demo-subscriber`.

The server exposes:

- `GET /api/impact` for live platform summary data
- `GET /api/past-draws` for searchable published draw history and charity totals
- `GET /api/past-draws/:id` for a published draw's winning numbers and prize tiers
- `GET /api/charity-impact` for contribution totals grouped by cause
- `GET /api/help/articles` for searchable support articles and categories
- `GET /api/help/articles/:slug` for a full support article
- `GET /api/help/status` for public knowledge-base and Gemini availability status
- `GET /api/member/content` for authenticated registered-member briefings
- `POST /api/help/chat` for the server-side Gemini support assistant or local knowledge-base fallback
- `POST /api/subscribe` for early-list signup validation
- `POST /api/checkout/session` for a live INR Razorpay order when configured, with Stripe Checkout as a fallback
- `POST /api/checkout/razorpay/verify` for server-side Razorpay signature verification
- `GET /api/checkout/session/status?session_id=...` for post-checkout status
- `POST /api/stripe/webhook` for signed Stripe subscription updates
- `GET/POST /mock-stripe/checkout/...` for local-only checkout completion and cancellation when `STRIPE_MOCK_MODE=true`
- `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout` for member/admin sessions
- `GET /api/scores` for the latest five Stableford scores
- `POST /api/scores` to add a score
- `PUT /api/scores/:id` to edit a score
- `DELETE /api/scores/:id` to remove a score
- `GET /api/admin/overview` for operational metrics
- `GET/POST/PUT/DELETE /api/admin/charities...` for the charity directory
- `GET/POST /api/admin/draws...` for draw setup, frequency-weighted simulations, and publication
- `GET /api/admin/winners` plus verify/pay actions for winner operations
- `GET /api/admin/winner-workflow` for winner queue metrics, filtered cases, audit events, and storage status
- `GET /api/admin/winners/:id/events` for a winner's immutable workflow timeline
- `POST /api/winners/:id/proof` for winner proof submission
- `POST /api/admin/winners/:id/verify` for proof approval or rejection with admin notes
- `POST /api/admin/winners/:id/pay` for verified-only payout completion with provider and payout reference
- `GET /api/member/dashboard` for the authenticated member's scores, draw entries, rewards, perks, and impact totals

## Current scope

The root page communicates what users do, how the draw works, where charity money goes, and the subscription call to action with live API-backed INR pool totals. Page two maps the six Core Objectives and the three PRD User Roles. Page three covers INR monthly/yearly Stripe subscriptions, signed webhook state changes, authenticated score management, and five-score Stableford management. The Registered Subscriber Dashboard aggregates live member data, score-window state, published draw entries, reward proof and payout state, plan perks, cancellation, and charity impact. The member briefing channel exposes active content published specifically for registered members, while the Help Center exposes only public content and routes support questions through Gemini when configured, with a knowledge-base fallback. The public archive exposes only published draws with server-side search, month filtering, winning numbers, prize tiers, and contribution totals. The administrator control room adds frequency-weighted draw simulation/publication, prize tiers, jackpot rollover, charity controls, audience-scoped content publishing, and the dedicated Winner Verification & Payout Management proofroom. The proofroom enforces proof-before-approval, admin rejection notes, verified-only payout completion, payout references, immutable SQLite audit events, and an optional MongoDB Atlas Data API mirror. The current auth bootstrap is intended for development; production accounts should be connected to the project’s identity provider before launch.

## Stripe configuration

Set these server-side environment variables in the deployment environment:

- `STRIPE_SECRET_KEY`: live Stripe secret key; never expose it to the browser
- `STRIPE_WEBHOOK_SECRET`: signing secret for the `/api/stripe/webhook` endpoint
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: server-side Razorpay client credentials; the instance is initialized only when both values are present
- `PUBLIC_BASE_URL`: public HTTPS origin used for Stripe success and cancel redirects
- `FRONTEND_ORIGIN`: exact frontend HTTPS origin allowed to make credentialed API requests
- `DH_DB_PATH`: persistent SQLite path, such as `/data/digital-heroes.sqlite`; on Railway, attach a persistent volume mounted at `/data`
- `STRIPE_MOCK_MODE`: set to `true` only for local testing; it is disabled automatically in production
- `DEMO_SUBSCRIBER_EMAIL` and `DEMO_SUBSCRIBER_PASSWORD`: optional local bootstrap credentials
- `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`: local bootstrap credentials; production should use `DEMO_ADMIN_ACCOUNTS`
- `DEMO_ADMIN_ACCOUNTS`: required production JSON array of assigned administrator credentials; administrator access never accepts social login
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET`: backend-only OAuth credentials for subscriber/member sign-in
- `GEMINI_API_KEY`: server-side Gemini API key for AI support; never expose it to the browser
- `GEMINI_MODEL`: optional Gemini model name, defaulting to `gemini-2.5-flash`
- `MONGODB_URI`: server-only MongoDB connection string for the native application snapshot and winner workflow mirror
- `MONGODB_DATA_API_URL`, `MONGODB_DATA_API_KEY`, `MONGODB_DATA_SOURCE`, `MONGODB_DATABASE`, and `MONGODB_WINNER_COLLECTION`: optional MongoDB Atlas Data API alternative for application snapshots and mirrored winner workflow events

## Mock Stripe flow

Run the server with `STRIPE_MOCK_MODE=true` and open the subscription page. Submitting checkout redirects to a local Mock Stripe page. `Complete mock payment` sends a signed `checkout.session.completed` event through the same webhook verification and database update path as Stripe. `Cancel checkout` sends `checkout.session.expired`. No Stripe account, key, card, or network call is used.

## Design direction

- Dark mission-control palette with acid-lime action color and coral signal color
- Editorial serif emphasis against an accessible sans-serif body
- No traditional golf imagery; impact and transparency lead the story
- Keyboard-visible focus, 44px touch targets, reduced-motion support, and semantic buttons
- 3D signal orb uses React Three Fiber primitives with drag orbit and clickable signal nodes
- 3D role constellation uses React Three Fiber primitives with clickable role nodes and role-specific navigation surfaces
- 3D subscription engine and score orbit use React Three Fiber primitives with clickable plan and score nodes

The hero direction uses the 21st.dev interactive 3D hero pattern: a dark editorial layout, responsive CTA hierarchy, and an ambient Three.js field of floating geometry behind the content. The implementation is intentionally local and tailored to the Digital Heroes requirements rather than copying a template wholesale.

The standalone preview is available at `outputs/digital-heroes.html`.
