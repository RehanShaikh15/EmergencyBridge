import type { IncidentReport, IncidentRequest } from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

export async function analyzeEmergency(input: IncidentRequest): Promise<IncidentReport> {
  if (!API_BASE_URL) {
    throw new Error('Report service is not configured. Set EXPO_PUBLIC_API_BASE_URL and restart Expo.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(`${API_BASE_URL}/analyze-emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'The report could not be prepared. Check your photo or description and try again.');
    }
    return payload as IncidentReport;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('This is taking too long. Try again when the connection is available. You can still call 112.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
