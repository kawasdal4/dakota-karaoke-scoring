import { VocalSubmission, PerformanceSubmission, StagingSubmission } from '@/types';
import { getAdminSettings } from './storage';

function getScriptUrl(): string | null {
  const settings = getAdminSettings();
  return settings.googleScriptUrl || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || null;
}

export interface AuthResponse {
  status: 'success' | 'error';
  authenticated?: boolean;
  user?: {
    username: string;
    role: string;
  };
  message?: string;
}

export interface ChangePinResponse {
  status: 'success' | 'error';
  message: string;
}

// ─── Centralized Authentication API ──────────────────────────

export async function loginWithSheets(username: string, pinHash: string): Promise<AuthResponse> {
  const url = getScriptUrl();
  if (!url) {
    return {
      status: 'error',
      authenticated: false,
      message: 'Google Apps Script URL belum diatur di Admin Settings.',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        username,
        pinHash,
      }),
    });
    if (!res.ok) {
      return { status: 'error', authenticated: false, message: 'Gagal terhubung ke server.' };
    }
    const json = await res.json();
    return json as AuthResponse;
  } catch (err) {
    console.error('[Sheets Auth] Login error:', err);
    return { status: 'error', authenticated: false, message: 'Terjadi kesalahan koneksi internet.' };
  }
}

export async function changePinInSheets(
  username: string,
  oldPinHash: string,
  newPinHash: string
): Promise<ChangePinResponse> {
  const url = getScriptUrl();
  if (!url) {
    return {
      status: 'error',
      message: 'Google Apps Script URL belum diatur di Admin Settings.',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'changePin',
        username,
        oldPinHash,
        newPinHash,
      }),
    });
    if (!res.ok) {
      return { status: 'error', message: 'Gagal terhubung ke server.' };
    }
    const json = await res.json();
    return json as ChangePinResponse;
  } catch (err) {
    console.error('[Sheets Auth] Change PIN error:', err);
    return { status: 'error', message: 'Terjadi kesalahan koneksi internet.' };
  }
}

// ─── Kenji: Write Vocal cells ONLY ──────────────────────────

export async function submitVocalToSheets(sub: VocalSubmission): Promise<void> {
  const url = getScriptUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveVocal',
        eventId: sub.eventId,
        round: sub.round,
        participantNo: sub.participantNo,
        participantName: sub.participantName,
        songTitle: sub.songTitle,
        accuracy:   sub.scores.accuracy,
        character:  sub.scores.character,
        tempo:      sub.scores.tempo,
        technique:  sub.scores.technique,
        expression: sub.scores.expression,
        vocalSubtotal: sub.subtotal,
        timestamp:  sub.timestamp,
        deviceInfo: sub.deviceInfo,
        userAgent:  sub.userAgent,
        notes:      sub.notes ?? '',
      }),
    });
  } catch (err) {
    console.warn('[Sheets] Vocal submit error (local fallback active):', err);
  }
}

// ─── Ukey: Write Performance cells ONLY ─────────────────────

export async function submitPerformanceToSheets(sub: PerformanceSubmission): Promise<void> {
  const url = getScriptUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'savePerformance',
        eventId: sub.eventId,
        round: sub.round,
        participantNo: sub.participantNo,
        participantName: sub.participantName,
        songTitle: sub.songTitle,
        perfExpression: sub.scores.expression,
        confidence:     sub.scores.confidence,
        appearance:     sub.scores.appearance,
        gesture:        sub.scores.gesture,
        creativity:     sub.scores.creativity,
        performanceSubtotal: sub.subtotal,
        timestamp:  sub.timestamp,
        deviceInfo: sub.deviceInfo,
        userAgent:  sub.userAgent,
        notes:      sub.notes ?? '',
      }),
    });
  } catch (err) {
    console.warn('[Sheets] Performance submit error (local fallback active):', err);
  }
}

// ─── Revan: Write Staging cells ONLY ────────────────────────

export async function submitStagingToSheets(sub: StagingSubmission): Promise<void> {
  const url = getScriptUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveStaging',
        eventId: sub.eventId,
        round: sub.round,
        participantNo: sub.participantNo,
        participantName: sub.participantName,
        songTitle: sub.songTitle,
        interaction:        sub.scores.interaction,
        communication:      sub.scores.communication,
        roomAtmosphere:     sub.scores.roomAtmosphere,
        audienceEngagement: sub.scores.audienceEngagement,
        stagingSubtotal:    sub.subtotal,
        timestamp:  sub.timestamp,
        deviceInfo: sub.deviceInfo,
        userAgent:  sub.userAgent,
        notes:      sub.notes ?? '',
      }),
    });
  } catch (err) {
    console.warn('[Sheets] Staging submit error (local fallback active):', err);
  }
}

// ─── Fetch Participants ──────────────────────────────────────

export async function fetchParticipants(): Promise<Array<{ number: number; name: string }>> {
  const baseUrl = getScriptUrl();

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SCRIPT_URL belum diatur");
  }

  const url = `${baseUrl}?action=getParticipants`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil peserta: HTTP ${response.status}`);
  }

  const result = await response.json();
  
  console.log("Dakota peserta API:", result);

  if (result.status !== "success") {
    throw new Error(result.message || "Gagal memuat peserta");
  }

  if (!Array.isArray(result.participants)) {
    throw new Error("Format data peserta tidak valid");
  }

  return result.participants
    .filter((participant: any) => participant && participant.number !== undefined && participant.name)
    .map((participant: any) => ({
      number: Number(participant.number),
      name: String(participant.name).trim()
    }));
}
