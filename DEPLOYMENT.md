# Hosting EmergencyBridge

## Render API

Import `render.yaml` as a Blueprint, or create a Python web service from this repository with root directory `backend`, build command `pip install -r requirements.txt`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`, and health path `/health`.

Set the model variables from the Blueprint. Set `OPENAI_API_KEY` to the NVIDIA key in Render's environment settings only. Set `CORS_ORIGINS` to the exact Vercel website origin, with no trailing slash; multiple origins can be comma separated. Do not upload `.env` to GitHub or Vercel. Confirm the deployed API's `/health` returns `{"status":"ok"}`.

The Blueprint selects Render's free instance type. Free web services can sleep when idle; allow for startup delay in a demo. Emergency calling remains independent of the API.

## Vercel website

Import this GitHub repository and set **Root Directory** to `frontend`. The included `frontend/vercel.json` selects `npm ci`, `npm run build:web`, and output folder `dist`.

Add `EXPO_PUBLIC_API_BASE_URL` with the HTTPS Render API origin to Vercel's production and preview build environment. This variable is public and contains only a URL. The production build deliberately ignores the local frontend `.env` and fails if the API URL is missing or does not use HTTPS.

After Vercel assigns a production URL, update Render's `CORS_ORIGINS` to match it. Rebuild Vercel whenever changing the public API URL, because Expo embeds it at build time. Native Expo Go development can continue using the existing local `.env`.

Verify the live website can generate a fictional text report and photo report, approve it, display next steps, and open nearby searches. The web camera and location features require HTTPS and browser permission. Keep all real emergency calls out of deployment tests.
