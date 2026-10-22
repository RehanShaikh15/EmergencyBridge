import base64
import binascii
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class IncidentLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0)
    manual_text: str | None = Field(default=None, max_length=300)


class IncidentPhoto(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base64: str = Field(min_length=1, max_length=4_194_304)
    mime_type: Literal["image/jpeg", "image/png"]

    @model_validator(mode="after")
    def validate_image(self):
        try:
            raw = base64.b64decode(self.base64, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ValueError("Photo must contain valid base64 image data") from exc
        signature = b"\xff\xd8\xff" if self.mime_type == "image/jpeg" else b"\x89PNG\r\n\x1a\n"
        if not raw.startswith(signature):
            raise ValueError("Photo data does not match its image type")
        return self


class IncidentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(default="", max_length=1000)
    photo: IncidentPhoto | None = None
    location: IncidentLocation | None = None

    @field_validator("description")
    @classmethod
    def description_must_not_be_blank(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def require_incident_input(self):
        if not self.description.strip() and self.photo is None:
            raise ValueError("Add a description or a photo")
        return self


class IncidentExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    incident_type: str = Field(min_length=1, max_length=80)
    people_count: int | None = Field(ge=0, le=1000)
    observed_conditions: list[str] = Field(max_length=20)
    breathing_status: Literal["reported_breathing", "reported_not_breathing", "unknown"]
    missing_information: list[str] = Field(max_length=20)
    summary: str = Field(min_length=1, max_length=800)


class IncidentReport(IncidentExtraction):
    location: IncidentLocation | None = None
