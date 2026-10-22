# EmergencyBridge

EmergencyBridge helps a bystander prepare a concise, human-reviewed incident report while keeping India's 112 dialer one tap away. The app does not contact or dispatch emergency responders and does not give clinical advice.

## Run the API

Follow [backend/README.md](backend/README.md). Configure the model credentials in `backend/.env` on the server only.

## Run the Expo app

```powershell
cd frontend
Copy-Item .env.example .env
# On a physical phone, set EXPO_PUBLIC_API_BASE_URL to the laptop's LAN IP, e.g. http://192.168.1.25:8000
npm start
```

Open the project in Expo Go. The Expo dev server and FastAPI network paths are separate; the phone must be able to reach the configured API URL. For Android emulator use `http://10.0.2.2:8000`; for a physical device use the laptop's LAN IP. Never use real emergency services to test the dialer; inspect the native dialer without placing a call. Use fictional incident details.

The API currently uses a direct OpenAI-compatible hosted-model fallback. Hermes Agent integration is not complete and must be represented accurately in any demo or pitch.

## Photo reports

Tap **Take a photo** or **Choose photo**, review the preview, and tap **Generate report from photo**. Description text is optional when a photo is attached. Camera permission is requested on capture; permission denial leaves description and photo selection available.

Photos are resized to at most 1280 pixels on the longest edge and JPEG-compressed before upload. The API accepts JPEG/PNG base64 payloads up to 4 MiB encoded. Photos are sent to the configured model provider and are not included in native report sharing or stored by the application backend. Provider data retention is governed by its terms.

For NVIDIA, photo requests use `OPENAI_VISION_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b` (also the default when the NVIDIA endpoint is configured). Text requests continue using `OPENAI_MODEL`. A photo alone cannot establish breathing or responsiveness; generated reports preserve those unknowns and require review. Restart Expo after installing the new camera modules and restart FastAPI after backend changes.

## After report approval

The review screen now has **Approve & see next steps**. Approval is local user review; it does not submit the report to emergency services. The next screen contains sharing, fixed general first-aid guidance, and Google Maps searches for hospital emergency departments and pharmacies. Returning to review requires approval again before sharing or showing next steps. An empty summary cannot be approved.

Nearby searches start from the manually corrected report location when available, otherwise its device coordinates. Users can enter another city/landmark or request their current device location; this search location does not change the approved report. No Places API key is needed. Facility details, directions and availability must be checked in Maps or with the facility; the app does not claim verified beds, hours, or travel times.

Guidance is fixed content in `frontend/src/care.ts`, based on the American Red Cross first-aid steps and St John Ambulance bleeding, CPR, and spinal-injury guidance (sources linked in the app, checked 22 October 2026). It is not generated or selected by the model. 112 remains accessible throughout the app, and basic guidance does not depend on a further model call.
