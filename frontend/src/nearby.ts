import type { IncidentLocation } from './types';

export type CarePlace = 'hospital' | 'pharmacy';

export function reportSearchArea(location: IncidentLocation | null): string {
  if (location?.manual_text?.trim()) return location.manual_text.trim();
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    return `${latitude}, ${longitude}`;
  }
  return '';
}

export function nearbySearchUrl(kind: CarePlace, area: string): string | null {
  const trimmed = area.trim().slice(0, 300);
  if (!trimmed) return null;
  const category = kind === 'hospital' ? 'hospital emergency department' : 'pharmacy medical shop';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${category} near ${trimmed}`)}`;
}
