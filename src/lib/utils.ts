import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VocalScores, PerformanceScores, StagingScores, JudgeRole } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// JUDGE CATEGORY METADATA
// ============================================================

export const JUDGE_CATEGORIES: Record<Exclude<JudgeRole, 'Admin'>, {
  label: string;
  maxScore: number;
  color: string;
  borderColor: string;
  glowColor: string;
}> = {
  Kenji: {
    label: 'VOCAL',
    maxScore: 50,
    color: 'text-purple-300',
    borderColor: 'border-purple-500/40',
    glowColor: 'shadow-purple-500/30',
  },
  Ukey: {
    label: 'PERFORMANCE',
    maxScore: 30,
    color: 'text-blue-300',
    borderColor: 'border-blue-500/40',
    glowColor: 'shadow-blue-500/30',
  },
  Revan: {
    label: 'STAGING',
    maxScore: 20,
    color: 'text-cyan-300',
    borderColor: 'border-cyan-500/40',
    glowColor: 'shadow-cyan-500/30',
  },
};

// ============================================================
// VOCAL SCORING (Kenji)
// ============================================================

export const VOCAL_FIELDS: { key: keyof VocalScores; label: string; max: number }[] = [
  { key: 'accuracy',   label: 'Accuracy (Ketepatan Nada)',  max: 15 },
  { key: 'character',  label: 'Character (Karakter Vokal)', max: 10 },
  { key: 'tempo',      label: 'Tempo & Ritme',              max: 10 },
  { key: 'technique',  label: 'Technique (Teknik Vokal)',   max: 10 },
  { key: 'expression', label: 'Expression (Ekspresi)',      max: 5  },
];

export function calcVocalSubtotal(s: VocalScores): number {
  return s.accuracy + s.character + s.tempo + s.technique + s.expression;
}

// ============================================================
// PERFORMANCE SCORING (Ukey)
// ============================================================

export const PERFORMANCE_FIELDS: { key: keyof PerformanceScores; label: string; max: number }[] = [
  { key: 'expression',  label: 'Expression (Ekspresi Panggung)', max: 10 },
  { key: 'confidence',  label: 'Confidence (Kepercayaan Diri)',  max: 5  },
  { key: 'appearance',  label: 'Appearance (Kostum & Penampilan)', max: 5 },
  { key: 'gesture',     label: 'Gesture & Penguasaan',            max: 5  },
  { key: 'creativity',  label: 'Creativity (Kreativitas)',         max: 5  },
];

export function calcPerformanceSubtotal(s: PerformanceScores): number {
  return s.expression + s.confidence + s.appearance + s.gesture + s.creativity;
}

// ============================================================
// STAGING SCORING (Revan)
// ============================================================

export const STAGING_FIELDS: { key: keyof StagingScores; label: string; max: number }[] = [
  { key: 'interaction',        label: 'Interaction (Interaksi Penonton)',   max: 5 },
  { key: 'communication',      label: 'Communication (Komunikasi Panggung)', max: 5 },
  { key: 'roomAtmosphere',     label: 'Room Atmosphere (Suasana)',           max: 5 },
  { key: 'audienceEngagement', label: 'Audience Engagement',                 max: 5 },
];

export function calcStagingSubtotal(s: StagingScores): number {
  return s.interaction + s.communication + s.roomAtmosphere + s.audienceEngagement;
}

// ============================================================
// FINAL SCORE COLOR CODING
// ============================================================

export function getScoreColorTheme(score: number, max: number = 100): {
  textColor: string;
  borderColor: string;
  label: string;
} {
  const pct = (score / max) * 100;
  if (pct >= 90) {
    return {
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      label: 'Sangat Bagus',
    };
  }
  if (pct >= 75) {
    return {
      textColor: 'text-amber-400',
      borderColor: 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      label: 'Bagus',
    };
  }
  return {
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]',
    label: 'Perlu Peningkatan',
  };
}

// ============================================================
// DEVICE DETECTION
// ============================================================

export function detectDevice(): string {
  if (typeof window === 'undefined') return 'Server';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android Mobile';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone iOS';
  if (/Windows/i.test(ua)) return 'Windows Desktop';
  if (/Mac/i.test(ua)) return 'Mac Desktop';
  return 'Mobile Web Browser';
}
