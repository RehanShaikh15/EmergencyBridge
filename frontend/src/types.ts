export type IncidentLocation = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  manual_text?: string | null;
};

export type IncidentRequest = {
  description: string;
  photo?: { base64: string; mime_type: 'image/jpeg' | 'image/png' };
  location?: IncidentLocation | null;
};

export type IncidentReport = {
  incident_type: string;
  people_count: number | null;
  observed_conditions: string[];
  breathing_status: string;
  missing_information: string[];
  summary: string;
  location: IncidentLocation | null;
};
