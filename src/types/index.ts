export type JudgeRole = 'Kenji' | 'Ukey' | 'Revan' | 'Admin';

// ============================================================
// SCORE DATA STRUCTURES (Per Judge Category)
// ============================================================

/** Kenji's domain — Vocal scores, max 50 points */
export interface VocalScores {
  accuracy: number;   // 0-15
  character: number;  // 0-10
  tempo: number;      // 0-10
  technique: number;  // 0-10
  expression: number; // 0-5
}

/** Ukey's domain — Performance scores, max 30 points */
export interface PerformanceScores {
  expression: number;  // 0-10
  confidence: number;  // 0-5
  appearance: number;  // 0-5
  gesture: number;     // 0-5
  creativity: number;  // 0-5
}

/** Revan's domain — Staging scores, max 20 points */
export interface StagingScores {
  interaction: number;        // 0-5
  communication: number;      // 0-5
  roomAtmosphere: number;     // 0-5
  audienceEngagement: number; // 0-5
}

// ============================================================
// JUDGE SUBMISSIONS (One per judge per participant per round)
// ============================================================

export interface VocalSubmission {
  id: string;
  eventId: string;
  round: string;
  participantId: string;
  participantNo: number;
  participantName: string;
  songTitle: string;
  scores: VocalScores;
  subtotal: number; // max 50
  notes?: string;
  isLocked: boolean;
  timestamp: string;
  deviceInfo: string;
  userAgent: string;
}

export interface PerformanceSubmission {
  id: string;
  eventId: string;
  round: string;
  participantId: string;
  participantNo: number;
  participantName: string;
  songTitle: string;
  scores: PerformanceScores;
  subtotal: number; // max 30
  notes?: string;
  isLocked: boolean;
  timestamp: string;
  deviceInfo: string;
  userAgent: string;
}

export interface StagingSubmission {
  id: string;
  eventId: string;
  round: string;
  participantId: string;
  participantNo: number;
  participantName: string;
  songTitle: string;
  scores: StagingScores;
  subtotal: number; // max 20
  notes?: string;
  isLocked: boolean;
  timestamp: string;
  deviceInfo: string;
  userAgent: string;
}

// ============================================================
// COMBINED FINAL SCORE (Computed, not stored)
// ============================================================

export interface ParticipantFinalScore {
  participantId: string;
  participantNo: number;
  participantName: string;
  songTitle: string;
  kenjiscore: number | null;   // Vocal subtotal (max 50), null = waiting
  ukeyscore: number | null;    // Performance subtotal (max 30), null = waiting
  revanscore: number | null;   // Staging subtotal (max 20), null = waiting
  finalScore: number | null;   // Sum, null if any judge is missing
  isComplete: boolean;         // true only when all 3 judges submitted
}

// ============================================================
// PARTICIPANT & EVENT
// ============================================================

export interface Participant {
  id: string;
  no: number;
  name: string;
  songTitle: string;
  category: string;
}

export interface KaraokeEvent {
  id: string;
  name: string;
  date: string;
  totalParticipants: number;
  judges: JudgeRole[];
  rounds: string[];
  currentRound: string;
  isLocked: boolean;
  participants: Participant[];
}

// ============================================================
// AUDIT LOG
// ============================================================

export interface AuditLogEntry {
  id: string;
  eventId: string;
  judgeName: string;
  participantNo: number;
  participantName: string;
  category: 'VOCAL' | 'PERFORMANCE' | 'STAGING' | 'SYSTEM';
  subtotal: number;
  timestamp: string;
  deviceInfo: string;
  userAgent: string;
  action: 'SUBMIT_SCORE' | 'UNLOCK_SCORE' | 'UPDATE_EVENT' | 'IMPORT_BACKUP';
}

// ============================================================
// ADMIN SETTINGS
// ============================================================

export interface AdminSettings {
  activeEventId: string;
  googleScriptUrl: string;
  isGlobalScoringLocked: boolean;
}

// ============================================================
// ROUNDS & AWARDS CONSTANTS
// ============================================================

export const DEFAULT_ROUNDS = [
  'Round Penyisihan',
  'Semifinal',
  'Grand Final',
] as const;

export interface AwardBadge {
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  icon: string;
}

export const GRAND_FINAL_AWARDS: Record<number, AwardBadge> = {
  1: {
    label: 'Juara 1',
    shortLabel: 'JUARA 1',
    badgeBg: 'bg-amber-500/20',
    badgeBorder: 'border-amber-400/60',
    badgeText: 'text-amber-300',
    icon: '🥇',
  },
  2: {
    label: 'Juara 2',
    shortLabel: 'JUARA 2',
    badgeBg: 'bg-slate-300/20',
    badgeBorder: 'border-slate-300/60',
    badgeText: 'text-slate-200',
    icon: '🥈',
  },
  3: {
    label: 'Juara 3',
    shortLabel: 'JUARA 3',
    badgeBg: 'bg-amber-700/20',
    badgeBorder: 'border-amber-600/60',
    badgeText: 'text-amber-400',
    icon: '🥉',
  },
  4: {
    label: 'Harapan 1',
    shortLabel: 'HARAPAN 1',
    badgeBg: 'bg-emerald-500/20',
    badgeBorder: 'border-emerald-400/60',
    badgeText: 'text-emerald-300',
    icon: '🏅',
  },
  5: {
    label: 'Harapan 2',
    shortLabel: 'HARAPAN 2',
    badgeBg: 'bg-cyan-500/20',
    badgeBorder: 'border-cyan-400/60',
    badgeText: 'text-cyan-300',
    icon: '🏅',
  },
};

