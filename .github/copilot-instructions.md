# Copilot Instructions for FRCDesignApp

## Project Architecture

-   **Monorepo**: Contains both frontend (`frontend/`, React+Vite+TypeScript) and backend (`backend/`, Flask+Python) code. Shared logic and types are in `backend/common/`, `backend/endpoints/`, and `frontend/src/api/backend-types.ts`.
-   **API Layer**: Backend exposes REST endpoints, with business logic in `backend/endpoints/` and shared utilities in `backend/common/`.
-   **Onshape Integration**: Uses OAuth and API keys for Onshape API access. See `onshape_api/` for the Python client library.
-   **Database**: Uses Google Cloud Firestore (emulated locally via `gcloud emulators firestore`).
-   **Deployment**: Deploys to Google Cloud Run. See VSCode tasks for build/deploy automation.

## Key Workflows

-   **Local Dev**: Use the `Launch servers` VSCode task to start all dev servers (frontend, backend, Firestore emulator). This is the main entry point for development.
-   **Build**: Use the `Build app` task (runs `npm run build` in `frontend/`).
-   **Deploy**: Use the `Deploy app` task (runs `gcloud run deploy ...`).
-   **Testing**: Python tests are in `tests/`. No formal frontend test setup is present. Tests are not a major focus currently.

## Conventions & Patterns

-   **Environment**: All secrets/configs are in `.env` (not checked in). Changing env vars requires restarting the backend server.
-   **HTTPS**: Local dev uses self-signed certs (`localhost.pem`, `localhost-key.pem`). See README for mkcert setup.
-   **Frontend Routing**: Uses Tanstack Router, entry point is `frontend/src/main.tsx` and `frontend/src/app/`.
-   **Backend Structure**: REST endpoints are arranged in `backend/endpoints/`. Shared logic is in `backend/common/`.
-   **Onshape API**: Python client in `onshape_api/` (see its README for usage). OAuth and API key flows are both supported.
-   **Database Access**: All Firestore access is via backend Python code; frontend does not talk to Firestore directly.

## Integration Points

-   **Onshape**: OAuth and API key setup required for full functionality. See README for setup and extension registration.
-   **Google Cloud**: Firestore emulator for local dev; production uses GCP Firestore. Deployment via Cloud Run.

## Examples

-   **Add a new backend endpoint**: Create a new file in `backend/endpoints/`, register it in `backend/server.py`.
-   **Add a new frontend page**: Add a route in `frontend/src/router.tsx`, create a component in `frontend/src/app/`.
-   **Type coordination**: Place in `backend/endpoints/` for backend, or `frontend/src/api/` for frontend.

## References

-   [Project README](../README.md) — full setup, OAuth, and dev instructions.
-   [Onshape API Python Client README](../onshape_api/README.md)
-   Key files: `.env`, `Procfile`, `requirements.txt`, `frontend/package.json`, `backend/server.py`, `backend/endpoints/`, `frontend/src/`, `onshape_api/`

---

If you are unsure about a workflow or pattern, check the main README or ask for clarification. Update this file as the project evolves.
