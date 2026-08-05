import { VocalSubmission, PerformanceSubmission, StagingSubmission } from '@/types';
import { getAdminSettings, saveAdminSettings, syncSubmissionsToStorage, RemoteSubmissions } from './storage';

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwLjIYlTeMPnEKkhTrZ8mEiKKRSqFpi1y_YzIBcNfeUfUfRR9xayvJ-Dx_pmvC9aj5xKA/exec';

function getScriptUrl(): string | null {
  if (typeof window !== 'undefined') {
    const urlParam = new URLSearchParams(window.location.search).get('scriptUrl');
    if (urlParam) {
      localStorage.setItem('dakota_global_script_url', urlParam);
      return urlParam;
    }
    const globalSaved = localStorage.getItem('dakota_global_script_url');
    if (globalSaved) return globalSaved;
  }
  const settings = getAdminSettings();
  return settings.googleScriptUrl || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || DEFAULT_SCRIPT_URL;
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

export async function submitVocalToSheets(sub: VocalSubmission): Promise<{status: string; message?: string}> {
  const url = getScriptUrl();
  if (!url) return {status: 'error', message: 'Missing script URL'};

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { const data = await response.json(); if (data && data.message) errMsg = data.message; } catch (_) {}
      return {status: 'error', message: errMsg};
    }
    const result = await response.json();
    if (result && result.status === 'error' && result.code === 'SCORING_LOCKED') {
      return {status: 'locked', message: result.message || 'Scoring is locked'};
    }
    return {status: 'success'};
  } catch (err) {
    console.warn('[Sheets] Vocal submit error (local fallback active):', err);
    return {status: 'error', message: String(err)};
  }
}

// ─── Ukey: Write Performance cells ONLY ─────────────────────

export async function submitPerformanceToSheets(sub: PerformanceSubmission): Promise<{status: string; message?: string}> {
  const url = getScriptUrl();
  if (!url) return {status: 'error', message: 'Missing script URL'};

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { const data = await response.json(); if (data && data.message) errMsg = data.message; } catch (_) {}
      return {status: 'error', message: errMsg};
    }
    const result = await response.json();
    if (result && result.status === 'error' && result.code === 'SCORING_LOCKED') {
      return {status: 'locked', message: result.message || 'Scoring is locked'};
    }
    return {status: 'success'};
  } catch (err) {
    console.warn('[Sheets] Performance submit error (local fallback active):', err);
    return {status: 'error', message: String(err)};
  }
}

// ─── Revan: Write Staging cells ONLY ────────────────────────

export async function submitStagingToSheets(sub: StagingSubmission): Promise<{status: string; message?: string}> {
  const url = getScriptUrl();
  if (!url) return {status: 'error', message: 'Missing script URL'};

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { const data = await response.json(); if (data && data.message) errMsg = data.message; } catch (_) {}
      return {status: 'error', message: errMsg};
    }
    const result = await response.json();
    if (result && result.status === 'error' && result.code === 'SCORING_LOCKED') {
      return {status: 'locked', message: result.message || 'Scoring is locked'};
    }
    return {status: 'success'};
  } catch (err) {
    console.warn('[Sheets] Staging submit error (local fallback active):', err);
    return {status: 'error', message: String(err)};
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

// ─── Fetch Submissions ───────────────────────────────────────

export async function fetchSubmissionsFromSheets(): Promise<RemoteSubmissions | null> {
  const baseUrl = getScriptUrl();
  if (!baseUrl) return null;

  try {
    const url = `${baseUrl}?action=getSubmissions&t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 'success') {
      if (typeof data.isGlobalScoringLocked === 'boolean') {
        const settings = getAdminSettings();
        if (settings.isGlobalScoringLocked !== data.isGlobalScoringLocked) {
          saveAdminSettings({ ...settings, isGlobalScoringLocked: data.isGlobalScoringLocked });
        }
      }
      const remoteData: RemoteSubmissions = {
        vocal: data.vocal || [],
        performance: data.performance || [],
        staging: data.staging || [],
      };
      syncSubmissionsToStorage(remoteData);
      return remoteData;
    }
  } catch (err) {
    console.warn('[Sheets] Failed to fetch remote submissions:', err);
  }
  return null;
}

// ─── Toggle Lock Status ──────────────────────────────────────

export async function toggleLockToSheets(
  eventId: string,
  round: string,
  role: string,
  participantNo: number,
  isLocked: boolean
): Promise<void> {
  const url = getScriptUrl();
  if (!url) return;

  const roleMap: Record<string, string> = {
    kenji: 'vocal',
    vocal: 'vocal',
    ukey: 'performance',
    performance: 'performance',
    revan: 'staging',
    staging: 'staging',
  };
  const normalizedRole = roleMap[role.toLowerCase()] || role.toLowerCase();

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'toggleLock',
        eventId,
        round,
        role: normalizedRole,
        participantNo,
        isLocked,
      }),
    });
  } catch (err) {
    console.warn('[Sheets] toggleLock submit error:', err);
  }
}

export async function saveGlobalLockToSheets(isGlobalScoringLocked: boolean): Promise<void> {
  const url = getScriptUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveGlobalLock',
        isGlobalScoringLocked,
      }),
    });
  } catch (err) {
    console.warn('[Sheets] saveGlobalLock submit error:', err);
  }
}

// ─── LOCK STATUS (Primary Source of Truth) ────────────────────
// Per-round / per-participant / per-judge lock — synced via Google Sheets

export interface LockStatusResponse {
  status: 'success' | 'error';
  locked: boolean;
  round?: string;
  participantName?: string;
  judge?: string;
  updatedAt?: string;
  source?: string;
  message?: string;
}

/**
 * getLockStatusFromSheets
 * Fetch lock status from Google Sheets LOCK_STATUS sheet.
 * Uses cache:no-store + timestamp to prevent stale data.
 * Default: locked = false if not found.
 */
export async function getLockStatusFromSheets(
  round: string,
  participantName: string,
  judge: string
): Promise<LockStatusResponse> {
  const baseUrl = getScriptUrl();
  if (!baseUrl) {
    return { status: 'error', locked: false, message: 'Script URL belum diatur' };
  }

  // Normalize round to lowercase to match GAS normalizeText()
  const normRound = round.trim().toLowerCase();

  const url =
    `${baseUrl}` +
    `?action=getLockStatus` +
    `&round=${encodeURIComponent(normRound)}` +
    `&participantName=${encodeURIComponent(participantName)}` +
    `&judge=${encodeURIComponent(judge)}` +
    `&_=${Date.now()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      return { status: 'error', locked: false, message: `HTTP ${res.status}` };
    }
    const data = await res.json();
    // Ensure locked is strictly boolean
    const locked = data.locked === true || data.locked === 'true';
    return { ...data, locked };
  } catch (err) {
    console.warn('[LockStatus] getLockStatusFromSheets error:', err);
    return { status: 'error', locked: false, message: String(err) };
  }
}

// ─── GET PARTICIPANT SCORES ───────────────────────────────────────
export async function getParticipantScoresFromSheets(
  round: string,
  participantName: string,
  judge: string
): Promise<any> {
  const baseUrl = getScriptUrl();
  if (!baseUrl) {
    throw new Error('Script URL belum diatur');
  }
  const normRound = round.trim().toLowerCase();
  const url = `${baseUrl}?action=getParticipantScores&round=${encodeURIComponent(normRound)}&participantName=${encodeURIComponent(participantName)}&judge=${encodeURIComponent(judge)}&_=${Date.now()}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}

export async function fetchAllLockStatuses(): Promise<any> {
  const baseUrl = getScriptUrl();
  if (!baseUrl) return [];
  const url = `${baseUrl}?action=getAllLockStatuses&_=${Date.now()}`;
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[LockStatus] fetchAllLockStatuses error:', err);
    return [];
  }
}

/**
 * setLockStatusToSheets
 * POST to Google Sheets LOCK_STATUS sheet (upsert row).
 * judge must be 'Kenji', 'Ukey', or 'Revan' (display names).
 */
export async function setLockStatusToSheets(
  round: string,
  participantName: string,
  judge: string,
  locked: boolean
): Promise<LockStatusResponse> {
  const url = getScriptUrl();
  if (!url) {
    return { status: 'error', locked, message: 'Script URL belum diatur' };
  }

  const normRound = round.trim().toLowerCase();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'setLockStatus',
        round: normRound,
        participantName,
        judge,
        locked,
      }),
    });
    if (!res.ok) {
      return { status: 'error', locked, message: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const lockedResult = data.locked === true || data.locked === 'true';
    return { ...data, locked: lockedResult };
  } catch (err) {
    console.warn('[LockStatus] setLockStatusToSheets error:', err);
    return { status: 'error', locked, message: String(err) };
  }
}




