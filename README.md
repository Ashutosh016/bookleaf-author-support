# BookLeaf Author Support & Communication Portal

A full-stack technical assignment implementation with an author portal, operations dashboard, REST API, role-based access control, AI-assisted classification/priority/drafting, and near-real-time ticket refresh.

## Stack
- React + Vite frontend
- Node.js + Express REST API
- MongoDB + Mongoose
- JWT authentication and bcrypt password hashing
- OpenAI API (optional; deterministic local fallback keeps the workflow usable without a key)
- Polling every 5 seconds for ticket updates

## Run locally
1. Install Node.js 20+ and MongoDB (local or hosted).
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `JWT_SECRET`, and optionally `OPENAI_API_KEY`.
3. From the project root run `npm install`.
4. Run `npm run seed -w server` to load demo accounts and sample records.
5. Run `npm run dev` and open the URL printed by Vite (normally http://localhost:5173).

If MongoDB is unavailable, the API returns a clear database connection error. Configure MongoDB before running the seed command.

## Demo accounts

- Admin: `admin@bookleaf.demo` / `Admin@123` -->

These are demo-only credentials. Change them before any public deployment. Seed data is synthetic because the companion `bookleaf_sample_data.json` referenced in the assignment was not included with the uploaded PDF. Replace `server/src/seed.js` data with the provided exact dataset before submission if BookLeaf sends it separately.

## AI behavior
When `OPENAI_API_KEY` is configured, the server uses the OpenAI Chat Completions API for structured category/priority analysis and knowledge-base-grounded draft replies. If the API key is absent, rate-limited, or fails, a local rules-based fallback keeps ticket creation and manual response sending available. The model is instructed not to invent payment dates, production statuses, or account facts; uncertain specifics are escalated for human verification.

Cost controls: classification uses a compact prompt containing the new ticket and relevant policy snippets, rather than full ticket history. Drafting sends only the current ticket, a short policy context, and the latest conversation messages. AI output is treated as a draft and requires admin review before sending.

## API overview
All routes except `/api/health` and `/api/auth/login` require a bearer JWT.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/login` | Public | Email/password login |
| GET | `/api/auth/me` | Authenticated | Current user |
| GET | `/api/books` | Author/Admin | Author books; admins may use `?authorId=` |
| GET | `/api/tickets` | Author/Admin | Own tickets or admin queue; supports `status`, `category`, `priority`, `q` |
| POST | `/api/tickets` | Author | Create ticket; AI classification runs asynchronously/safely |
| GET | `/api/tickets/:id` | Owner/Admin | Ticket detail |
| PATCH | `/api/tickets/:id` | Admin | Update status/category/priority/assignee |
| POST | `/api/tickets/:id/ai-draft` | Admin | Generate response draft |
| POST | `/api/tickets/:id/messages` | Admin | Send author-visible response |
| POST | `/api/tickets/:id/notes` | Admin | Add internal note |

Errors use `{ "error": "Human-readable message" }` with appropriate HTTP status codes. Request bodies are validated and ticket ownership is enforced server-side.

## Architecture
- `client/`: presentation and route-state UI. The API base URL is controlled by `VITE_API_URL`.
- `server/src/models.js`: persisted user, book, and ticket schemas.
- `server/src/routes.js`: API endpoints and authorization checks.
- `server/src/ai.js`: prompt construction, policy snippets, OpenAI integration, and fallback logic.
- `server/src/seed.js`: demo account and synthetic sample data.

## Production hardening / known limitations
- Replace synthetic seed data with the supplied official JSON dataset.
- Add email verification, password reset, refresh-token rotation, rate limiting, audit logs, malware scanning for uploads, and managed secrets.
- Use object storage for attachments; current UI accepts an attachment name only (per assignment's UI-only allowance).
- Use MongoDB Atlas and deploy the API separately from the static frontend. Configure CORS, `CLIENT_ORIGIN`, `VITE_API_URL`, and secrets in the hosting dashboards.
- For high-volume production, replace polling with Socket.IO/SSE and add queue-backed AI processing, retry/backoff, metrics, and idempotency.

