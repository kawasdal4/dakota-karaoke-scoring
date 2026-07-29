import { VocalSubmission, PerformanceSubmission, StagingSubmission } from '@/types';
import { getAdminSettings } from './storage';

function getScriptUrl(): string | null {
  const settings = getAdminSettings();
  return settings.googleScriptUrl || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || null;
}

// ─── Kenji: Write Vocal cells ONLY ──────────────────────────

export async function submitVocalToSheets(sub: VocalSubmission): Promise<void> {
  const url = getScriptUrl();
  if (!url) return; // offline mode – already saved to localStorage

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveVocal',
        // Identifiers
        eventId: sub.eventId,
        round: sub.round,
        participantNo: sub.participantNo,
        participantName: sub.participantName,
        songTitle: sub.songTitle,
        // Vocal scores ONLY — Kenji writes these cells
        accuracy:   sub.scores.accuracy,
        character:  sub.scores.character,
        tempo:      sub.scores.tempo,
        technique:  sub.scores.technique,
        expression: sub.scores.expression,
        // Vocal subtotal (formulas can also compute this, but we write for safety)
        vocalSubtotal: sub.subtotal,
        // Metadata
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
        // Performance scores ONLY — Ukey writes these cells
        perfExpression: sub.scores.expression,
        confidence:     sub.scores.confidence,
        appearance:     sub.scores.appearance,
        gesture:        sub.scores.gesture,
        creativity:     sub.scores.creativity,
        performanceSubtotal: sub.subtotal,
        // Metadata
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
        // Staging scores ONLY — Revan writes these cells
        interaction:        sub.scores.interaction,
        communication:      sub.scores.communication,
        roomAtmosphere:     sub.scores.roomAtmosphere,
        audienceEngagement: sub.scores.audienceEngagement,
        stagingSubtotal:    sub.subtotal,
        // Metadata
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
