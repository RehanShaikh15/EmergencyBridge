# EmergencyBridge backend

FastAPI validates the request and response around a single conservative extraction call. It does not dispatch responders or provide clinical advice.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Fill OPENAI_API_KEY and OPENAI_MODEL in .env on the server only.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

`GET /health` reports only whether the API process is alive. `POST /analyze-emergency` returns a validated extraction plus the original user/device supplied location. No incident text or coordinates are logged by the application.

The current adapter calls an OpenAI-compatible hosted model directly as the implementation-plan fallback. Hermes Agent has not yet been connected; the extraction boundary and JSON contract are ready for that adapter. Do not describe this build as Hermes-integrated until that work is complete.
