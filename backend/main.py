import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from agent import AgentUnavailable, extract_incident
from schemas import IncidentReport, IncidentRequest

load_dotenv(Path(__file__).with_name(".env"), override=True)

app = FastAPI(title="EmergencyBridge API", version="0.1.0")
origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:8081").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    # This reports API process health only. It does not claim that the model is reachable.
    return {"status": "ok"}


@app.post("/analyze-emergency", response_model=IncidentReport)
async def analyze_emergency(request: IncidentRequest) -> IncidentReport:
    try:
        extracted = await extract_incident(request.description, request.photo)
    except AgentUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        return IncidentReport(**extracted.model_dump(), location=request.location)
    except ValidationError as exc:
        # Do not return provider content or user incident data in error details.
        raise HTTPException(status_code=502, detail="The report service returned an invalid report.") from exc
