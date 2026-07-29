import {
  KaraokeEvent,
  VocalSubmission,
  PerformanceSubmission,
  StagingSubmission,
  AuditLogEntry,
  AdminSettings,
  JudgeRole,
  ParticipantFinalScore,
  Participant,
} from '@/types';

export const INITIAL_EVENT: KaraokeEvent = {
  id: 'evt-dakota-2026',
  name: 'Dakota Karaoke Cup 2026',
  date: new Date().toISOString().split('T')[0],
  totalParticipants: 0,
  judges: ['Kenji', 'Ukey', 'Revan', 'Admin'],
  rounds: ['Round Penyisihan', 'Semifinal', 'Grand Final'],
  currentRound: 'Round Penyisihan',
  isLocked: false,
  participants: [], // Loaded from Google Sheets
};

const KEYS = {
  ACTIVE_JUDGE:    'dakota_active_judge',
  EVENTS:          'dakota_events',
  ACTIVE_EVENT_ID: 'dakota_active_event_id',
  VOCAL:           'dakota_vocal_submissions',
  PERFORMANCE:     'dakota_performance_submissions',
  STAGING:         'dakota_staging_submissions',
  DRAFTS:          'dakota_drafts',
  AUDIT_LOGS:      'dakota_audit_logs',
  ADMIN_SETTINGS:  'dakota_admin_settings',
};

// ─── Helpers ────────────────────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Active Judge ────────────────────────────────────────────

export function getStoredJudge(): JudgeRole {
  if (typeof window === 'undefined') return 'Kenji';
  return (localStorage.getItem(KEYS.ACTIVE_JUDGE) as JudgeRole) || 'Kenji';
}

export function setStoredJudge(judge: JudgeRole): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.ACTIVE_JUDGE, judge);
}

// ─── Events ──────────────────────────────────────────────────

export function getStoredEvents(): KaraokeEvent[] {
  const events = readJSON<KaraokeEvent[]>(KEYS.EVENTS, []);
  if (events.length === 0) {
    writeJSON(KEYS.EVENTS, [INITIAL_EVENT]);
    return [INITIAL_EVENT];
  }
  return events;
}

export function saveEvents(events: KaraokeEvent[]): void {
  writeJSON(KEYS.EVENTS, events);
}

export function getActiveEvent(): KaraokeEvent {
  const events = getStoredEvents();
  if (typeof window === 'undefined') return events[0];
  const activeId = localStorage.getItem(KEYS.ACTIVE_EVENT_ID);
  return events.find((e) => e.id === activeId) || events[0];
}

export function setActiveEventId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.ACTIVE_EVENT_ID, id);
}



// ─── Vocal Submissions (Kenji) ───────────────────────────────

export function getVocalSubmissions(eventId: string, round: string): VocalSubmission[] {
  const all = readJSON<VocalSubmission[]>(KEYS.VOCAL, []);
  return all.filter((s) => s.eventId === eventId && s.round === round);
}

export function saveVocalSubmission(sub: VocalSubmission): void {
  let all = readJSON<VocalSubmission[]>(KEYS.VOCAL, []);
  all = all.filter(
    (s) => !(s.eventId === sub.eventId && s.round === sub.round && s.participantId === sub.participantId)
  );
  all.push(sub);
  writeJSON(KEYS.VOCAL, all);
  _addAuditLog({
    id: `audit-${Date.now()}`,
    eventId: sub.eventId,
    judgeName: 'Kenji',
    participantNo: sub.participantNo,
    participantName: sub.participantName,
    category: 'VOCAL',
    subtotal: sub.subtotal,
    timestamp: sub.timestamp,
    deviceInfo: sub.deviceInfo,
    userAgent: sub.userAgent,
    action: 'SUBMIT_SCORE',
  });
}

export function unlockVocal(eventId: string, round: string, participantId: string): void {
  let all = readJSON<VocalSubmission[]>(KEYS.VOCAL, []);
  const target = all.find(
    (s) => s.eventId === eventId && s.round === round && s.participantId === participantId
  );
  if (target) {
    target.isLocked = false;
    writeJSON(KEYS.VOCAL, all);
  }
}

// ─── Performance Submissions (Ukey) ──────────────────────────

export function getPerformanceSubmissions(eventId: string, round: string): PerformanceSubmission[] {
  const all = readJSON<PerformanceSubmission[]>(KEYS.PERFORMANCE, []);
  return all.filter((s) => s.eventId === eventId && s.round === round);
}

export function savePerformanceSubmission(sub: PerformanceSubmission): void {
  let all = readJSON<PerformanceSubmission[]>(KEYS.PERFORMANCE, []);
  all = all.filter(
    (s) => !(s.eventId === sub.eventId && s.round === sub.round && s.participantId === sub.participantId)
  );
  all.push(sub);
  writeJSON(KEYS.PERFORMANCE, all);
  _addAuditLog({
    id: `audit-${Date.now()}`,
    eventId: sub.eventId,
    judgeName: 'Ukey',
    participantNo: sub.participantNo,
    participantName: sub.participantName,
    category: 'PERFORMANCE',
    subtotal: sub.subtotal,
    timestamp: sub.timestamp,
    deviceInfo: sub.deviceInfo,
    userAgent: sub.userAgent,
    action: 'SUBMIT_SCORE',
  });
}

export function unlockPerformance(eventId: string, round: string, participantId: string): void {
  let all = readJSON<PerformanceSubmission[]>(KEYS.PERFORMANCE, []);
  const target = all.find(
    (s) => s.eventId === eventId && s.round === round && s.participantId === participantId
  );
  if (target) {
    target.isLocked = false;
    writeJSON(KEYS.PERFORMANCE, all);
  }
}

// ─── Staging Submissions (Revan) ─────────────────────────────

export function getStagingSubmissions(eventId: string, round: string): StagingSubmission[] {
  const all = readJSON<StagingSubmission[]>(KEYS.STAGING, []);
  return all.filter((s) => s.eventId === eventId && s.round === round);
}

export function saveStagingSubmission(sub: StagingSubmission): void {
  let all = readJSON<StagingSubmission[]>(KEYS.STAGING, []);
  all = all.filter(
    (s) => !(s.eventId === sub.eventId && s.round === sub.round && s.participantId === sub.participantId)
  );
  all.push(sub);
  writeJSON(KEYS.STAGING, all);
  _addAuditLog({
    id: `audit-${Date.now()}`,
    eventId: sub.eventId,
    judgeName: 'Revan',
    participantNo: sub.participantNo,
    participantName: sub.participantName,
    category: 'STAGING',
    subtotal: sub.subtotal,
    timestamp: sub.timestamp,
    deviceInfo: sub.deviceInfo,
    userAgent: sub.userAgent,
    action: 'SUBMIT_SCORE',
  });
}

export function unlockStaging(eventId: string, round: string, participantId: string): void {
  let all = readJSON<StagingSubmission[]>(KEYS.STAGING, []);
  const target = all.find(
    (s) => s.eventId === eventId && s.round === round && s.participantId === participantId
  );
  if (target) {
    target.isLocked = false;
    writeJSON(KEYS.STAGING, all);
  }
}

// ─── Combined Final Score View (Admin) ───────────────────────

export function buildFinalScores(eventId: string, round: string, participants: Participant[] = []): ParticipantFinalScore[] {
  const vocals = getVocalSubmissions(eventId, round);
  const perfs  = getPerformanceSubmissions(eventId, round);
  const stages = getStagingSubmissions(eventId, round);

  return participants.map((p) => {
    const v = vocals.find((s) => s.participantId === p.id);
    const pf = perfs.find((s) => s.participantId === p.id);
    const st = stages.find((s) => s.participantId === p.id);

    const kenjiScore  = v  ? v.subtotal  : null;
    const ukeyScore   = pf ? pf.subtotal : null;
    const revanScore  = st ? st.subtotal : null;
    const isComplete  = kenjiScore !== null && ukeyScore !== null && revanScore !== null;
    const finalScore  = isComplete ? kenjiScore! + ukeyScore! + revanScore! : null;

    return {
      participantId:   p.id,
      participantNo:   p.no,
      participantName: p.name,
      songTitle:       p.songTitle,
      kenjiscore:      kenjiScore,
      ukeyscore:       ukeyScore,
      revanscore:      revanScore,
      finalScore,
      isComplete,
    };
  });
}

// ─── Drafts ──────────────────────────────────────────────────

export function saveDraft(judge: JudgeRole, participantId: string, data: unknown): void {
  const drafts = readJSON<Record<string, unknown>>(KEYS.DRAFTS, {});
  drafts[`${judge}_${participantId}`] = { data, ts: Date.now() };
  writeJSON(KEYS.DRAFTS, drafts);
}

export function getDraft(judge: JudgeRole, participantId: string): unknown {
  const drafts = readJSON<Record<string, { data: unknown }>>(KEYS.DRAFTS, {});
  return drafts[`${judge}_${participantId}`]?.data ?? null;
}

// ─── Audit Logs ──────────────────────────────────────────────

function _addAuditLog(entry: AuditLogEntry): void {
  const logs = readJSON<AuditLogEntry[]>(KEYS.AUDIT_LOGS, []);
  logs.unshift(entry);
  writeJSON(KEYS.AUDIT_LOGS, logs.slice(0, 300));
}

export function getAuditLogs(): AuditLogEntry[] {
  return readJSON<AuditLogEntry[]>(KEYS.AUDIT_LOGS, []);
}

// ─── Admin Settings ──────────────────────────────────────────

const DEFAULT_SETTINGS: AdminSettings = {
  activeEventId: INITIAL_EVENT.id,
  googleScriptUrl: '',
  isGlobalScoringLocked: false,
};

export function getAdminSettings(): AdminSettings {
  return readJSON<AdminSettings>(KEYS.ADMIN_SETTINGS, DEFAULT_SETTINGS);
}

export function saveAdminSettings(s: AdminSettings): void {
  writeJSON(KEYS.ADMIN_SETTINGS, s);
}

// ─── Backup / Restore ────────────────────────────────────────

export function exportBackupJSON(): string {
  if (typeof window === 'undefined') return '';
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    events:      getStoredEvents(),
    activeEventId: localStorage.getItem(KEYS.ACTIVE_EVENT_ID),
    vocal:       readJSON(KEYS.VOCAL, []),
    performance: readJSON(KEYS.PERFORMANCE, []),
    staging:     readJSON(KEYS.STAGING, []),
    auditLogs:   getAuditLogs(),
    adminSettings: getAdminSettings(),
  };
  return JSON.stringify(backup, null, 2);
}

export function importBackupJSON(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (!data.events || !Array.isArray(data.events)) return false;
    writeJSON(KEYS.EVENTS, data.events);
    if (data.activeEventId) localStorage.setItem(KEYS.ACTIVE_EVENT_ID, data.activeEventId);
    if (data.vocal)       writeJSON(KEYS.VOCAL, data.vocal);
    if (data.performance) writeJSON(KEYS.PERFORMANCE, data.performance);
    if (data.staging)     writeJSON(KEYS.STAGING, data.staging);
    if (data.auditLogs)   writeJSON(KEYS.AUDIT_LOGS, data.auditLogs);
    if (data.adminSettings) saveAdminSettings(data.adminSettings);
    _addAuditLog({
      id: `audit-${Date.now()}`,
      eventId: data.activeEventId || 'system',
      judgeName: 'Admin',
      participantNo: 0,
      participantName: 'SYSTEM_BACKUP',
      category: 'SYSTEM',
      subtotal: 0,
      timestamp: new Date().toISOString(),
      deviceInfo: 'Admin Console',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      action: 'IMPORT_BACKUP',
    });
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}
