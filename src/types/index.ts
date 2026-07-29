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
