'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw,
  Save, Lock, Unlock, Music, Clock, Sparkles, FileText, UserCheck, RefreshCw,
  Wifi, WifiOff, Loader2,
} from 'lucide-react';
import StepperInput from '@/components/ui/stepper-input';
import ConfirmationModal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  getStoredJudge, getActiveEvent, getAdminSettings, getQualifiedParticipants,
  getVocalSubmissions, saveVocalSubmission, unlockVocal, lockVocal,
  getPerformanceSubmissions, savePerformanceSubmission, unlockPerformance, lockPerformance,
  getStagingSubmissions, saveStagingSubmission, unlockStaging, lockStaging,
  saveDraft, getDraft,
  RemoteSubmissions,
} from '@/lib/storage';
import {
  submitVocalToSheets, submitPerformanceToSheets, submitStagingToSheets,
  fetchParticipants, fetchSubmissionsFromSheets, toggleLockToSheets,
  setLockStatusToSheets,
} from '@/lib/google-sheets';
import {
  VOCAL_FIELDS, PERFORMANCE_FIELDS, STAGING_FIELDS,
  calcVocalSubtotal, calcPerformanceSubtotal, calcStagingSubtotal,
  getScoreColorTheme, detectDevice, JUDGE_CATEGORIES,
} from '@/lib/utils';
import {
  JudgeRole, KaraokeEvent, Participant,
  VocalScores, PerformanceScores, StagingScores,
  VocalSubmission, PerformanceSubmission, StagingSubmission,
} from '@/types';
import { useLockStatus } from '@/hooks/useLockStatus';
import { getAuthSession } from '@/lib/auth';

// ─── Default score states ───────────────────────────────────

const DEFAULT_VOCAL: VocalScores = { accuracy: 12, character: 8, tempo: 8, technique: 8, expression: 4 };
const DEFAULT_PERF: PerformanceScores = { expression: 8, confidence: 4, appearance: 4, gesture: 4, creativity: 4 };
const DEFAULT_STAGING: StagingScores = { interaction: 4, communication: 4, roomAtmosphere: 4, audienceEngagement: 4 };

// ─── Main Page ───────────────────────────────────────────────

export default function ScoringPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [judge, setJudge] = useState<JudgeRole>('Kenji');
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [event, setEvent] = useState<KaraokeEvent | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Timer
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Scores
  const [vocal, setVocal] = useState<VocalScores>(DEFAULT_VOCAL);
  const [perf, setPerf]   = useState<PerformanceScores>(DEFAULT_PERF);
  const [staging, setStaging] = useState<StagingScores>(DEFAULT_STAGING);
  const [notes, setNotes] = useState('');

  const [isLocked, setIsLocked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── LOCK STATUS via useLockStatus hook ──────────────────────
  // LOCK_STATUS from Google Sheets is primary source of truth.
  // isLocked state is DRIVEN by this hook; localStorage/SUBMISSIONS.isLocked
  // are only used as a fallback during initial load before first poll completes.

  const participants_computed = event?.participants ?? [];
  const participant_computed: Participant | undefined = participants_computed[currentIndex];

  const { locked: remoteLocked, syncStatus, isInitializing: lockInitializing } = useLockStatus({
    round: event?.currentRound ?? '',
    participantName: participant_computed?.name ?? '',
    judge: judge === 'Admin' ? 'Kenji' : judge,
    enabled: !isLoading && !!event && !!participant_computed,
    onLocked: () => {
      showToast('🔒 Penilaian dikunci oleh Admin. Draft Anda tetap tersimpan.', 'info');
    },
    onUnlocked: () => {
      showToast('🔓 Penilaian dibuka oleh Admin.', 'info');
    },
  });

  // LOCK_STATUS hook is authoritative once first poll completes.
  // Before that, use the local state as initial placeholder.
  useEffect(() => {
    if (!lockInitializing) {
      // Remote LOCK_STATUS overrides any localStorage / SUBMISSIONS.isLocked
      setIsLocked(remoteLocked);
    }
  }, [remoteLocked, lockInitializing]);

  const fetchAndInit = async (session: JudgeRole) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await fetchSubmissionsFromSheets().catch(() => {});
      const parts = await fetchParticipants();
      
      const evt = getActiveEvent();
      // Map to Participant interface in memory
      const mappedParts = parts.map((p) => ({
        id: `p${p.number}`,
        no: p.number,
        name: p.name,
        songTitle: 'TBA',
        category: 'Umum'
      }));

      // Filter participants based on active round qualification (Top 10 for Semifinal, Top 5 for Final)
      const qualifiedParts = getQualifiedParticipants(evt.id, evt.currentRound, mappedParts);
      evt.participants = qualifiedParts;
      evt.totalParticipants = qualifiedParts.length;
      
      setEvent(evt);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat peserta');
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    if (session === 'Admin') {
      setIsAdminSession(true);
      setJudge('Kenji');
      fetchAndInit('Kenji');
    } else {
      setIsAdminSession(false);
      setJudge(session);
      fetchAndInit(session);
    }
  }, [router]);
  const participants = event?.participants ?? [];
  const participant: Participant | undefined = participants[currentIndex];

  // Timer
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const refreshCurrentScores = (overrideParticipant?: typeof participant, overrideEvent?: typeof event) => {
    const p = overrideParticipant ?? participant;
    const ev = overrideEvent ?? event;
    if (!p || !ev) return;
    const settings = getAdminSettings();
    const isGlobal = settings.isGlobalScoringLocked;

    if (judge === 'Kenji') {
      const subs = getVocalSubmissions(ev.id, ev.currentRound);
      const existing = subs.find((s) => s.participantId === p.id);
      if (existing) {
        // Coerce to Number to handle any type mismatch from localStorage/Sheets
        setVocal({
          accuracy:  Number(existing.scores?.accuracy)  || 0,
          character: Number(existing.scores?.character) || 0,
          tempo:     Number(existing.scores?.tempo)     || 0,
          technique: Number(existing.scores?.technique) || 0,
          expression:Number(existing.scores?.expression)|| 0,
        });
        setNotes(existing.notes ?? '');
        setIsLocked(isGlobal || existing.isLocked);
        return;
      }
      const draft = getDraft(judge, p.id) as VocalScores | null;
      setVocal(draft ?? DEFAULT_VOCAL);
      setNotes('');
      setIsLocked(isGlobal);

    } else if (judge === 'Ukey') {
      const subs = getPerformanceSubmissions(ev.id, ev.currentRound);
      const existing = subs.find((s) => s.participantId === p.id);
      if (existing) {
        setPerf({
          expression: Number(existing.scores?.expression) || 0,
          confidence: Number(existing.scores?.confidence) || 0,
          appearance: Number(existing.scores?.appearance) || 0,
          gesture:    Number(existing.scores?.gesture)    || 0,
          creativity: Number(existing.scores?.creativity) || 0,
        });
        setNotes(existing.notes ?? '');
        setIsLocked(isGlobal || existing.isLocked);
        return;
      }
      const draft = getDraft(judge, p.id) as PerformanceScores | null;
      setPerf(draft ?? DEFAULT_PERF);
      setNotes('');
      setIsLocked(isGlobal);

    } else if (judge === 'Revan') {
      const subs = getStagingSubmissions(ev.id, ev.currentRound);
      const existing = subs.find((s) => s.participantId === p.id);
      if (existing) {
        setStaging({
          interaction:        Number(existing.scores?.interaction)        || 0,
          communication:     Number(existing.scores?.communication)     || 0,
          roomAtmosphere:    Number(existing.scores?.roomAtmosphere)    || 0,
          audienceEngagement:Number(existing.scores?.audienceEngagement)|| 0,
        });
        setNotes(existing.notes ?? '');
        setIsLocked(isGlobal || existing.isLocked);
        return;
      }
      const draft = getDraft(judge, p.id) as StagingScores | null;
      setStaging(draft ?? DEFAULT_STAGING);
      setNotes('');
      setIsLocked(isGlobal);
    }
  };

  // Load existing submission or draft when participant/event/judge changes
  useEffect(() => {
    refreshCurrentScores(participant, event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, event, judge]);

  const [isSyncing, setIsSyncing] = useState(false);

  // ─── Core helper: apply a single remote submission to React state ────────
  const applyRemoteSubmission = (result: RemoteSubmissions, p: typeof participant, isGlobal: boolean): boolean => {
    if (!p) return false;

    // 3-tier match strategy:
    //  1. By participantId string ('p1')
    //  2. By participantNo number (1)
    //  3. Last resort: first entry in list (for single-entry Sheets)
    const findMatch = (list: any[]): any => {
      const arr = list ?? [];
      // Tier 1: exact participantId
      let m = arr.find((s: any) => String(s.participantId) === String(p!.id));
      if (m) return m;
      // Tier 2: participantNo number equality
      m = arr.find((s: any) => Number(s.participantNo) === Number(p!.no));
      if (m) return m;
      // Tier 3: single-entry fallback (only one submission exists → apply it)
      if (arr.length === 1) return arr[0];
      return undefined;
    };

    const applyScores = (m: any, setter: (v: any) => void, keys: string[]): boolean => {
      const scores: Record<string, number> = {};
      keys.forEach(k => { scores[k] = Number(m.scores?.[k]) || 0; });

      // Guard: only apply scores to form if at least one value is non-zero.
      // Zero scores indicate a placeholder row (from lock operation), not real input.
      const hasRealScores = Object.values(scores).some(v => v > 0);
      if (hasRealScores) {
        setter(scores);
        setNotes(m.notes ?? '');
      }
      // Always propagate lock state from Sheets (even from placeholder rows)
      setIsLocked(isGlobal || Boolean(m.isLocked));
      return hasRealScores;
    };

    if (judge === 'Kenji') {
      const m = findMatch(result.vocal ?? []);
      if (m) {
        applyScores(m, setVocal, ['accuracy', 'character', 'tempo', 'technique', 'expression']);
        return true;
      }
      setIsLocked(isGlobal);
    } else if (judge === 'Ukey') {
      const m = findMatch(result.performance ?? []);
      if (m) {
        applyScores(m, setPerf, ['expression', 'confidence', 'appearance', 'gesture', 'creativity']);
        return true;
      }
      setIsLocked(isGlobal);
    } else if (judge === 'Revan') {
      const m = findMatch(result.staging ?? []);
      if (m) {
        applyScores(m, setStaging, ['interaction', 'communication', 'roomAtmosphere', 'audienceEngagement']);
        return true;
      }
      setIsLocked(isGlobal);
    }
    return false;
  };

  const handleSyncSheets = async () => {
    if (!participant || !event) {
      showToast('Peserta belum dimuat.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await fetchSubmissionsFromSheets();
      if (result) {
        // Debug: log raw result so user can check browser console
        const vLen = result.vocal?.length ?? 0;
        const pLen = result.performance?.length ?? 0;
        const sLen = result.staging?.length ?? 0;
        console.log(
          `[Sync] Sheets data — vocal:${vLen} perf:${pLen} staging:${sLen}`,
          '| participant id:', participant.id, 'no:', participant.no,
          '| raw:', JSON.stringify(result)
        );
        const settings = getAdminSettings();
        const found = applyRemoteSubmission(result, participant, settings.isGlobalScoringLocked);
        if (found) {
          showToast('\u2705 Berhasil sinkronisasi nilai dari Google Sheets!', 'success');
        } else {
          const total = vLen + pLen + sLen;
          showToast(
            total > 0
              ? `\u26a0\ufe0f Ada ${total} data di Sheets tapi tidak cocok. Cek konsol browser (F12).`
              : '\u26a0\ufe0f SUBMISSIONS sheet masih kosong. Submit nilai dulu dari form juri.',
            'info'
          );
        }
      } else {
        showToast('\u26a0\ufe0f Gagal menjangkau Google Script. Cek URL di .env.local.', 'error');
      }
    } catch (err: any) {
      console.error('[Sync] Error:', err);
      showToast('\u274c Error sinkronisasi: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Autosave draft every 5s (preserved even when locked) ─────
  useEffect(() => {
    if (!participant || isLocked) return;
    const id = setInterval(() => {
      if (judge === 'Kenji') saveDraft(judge, participant.id, vocal);
      else if (judge === 'Ukey') saveDraft(judge, participant.id, perf);
      else if (judge === 'Revan') saveDraft(judge, participant.id, staging);
    }, 5000);
    return () => clearInterval(id);
  }, [judge, participant, vocal, perf, staging, isLocked]);

  // Computed subtotals
  const subtotal =
    judge === 'Kenji' ? calcVocalSubtotal(vocal) :
    judge === 'Ukey'  ? calcPerformanceSubtotal(perf) :
    calcStagingSubtotal(staging);

  const maxScore =
    judge === 'Kenji' ? 50 :
    judge === 'Ukey'  ? 30 : 20;

  const categoryMeta = judge !== 'Admin' ? JUDGE_CATEGORIES[judge] : null;
  const colorTheme = getScoreColorTheme(subtotal, maxScore);

  // Admin lock toggle from scoring page — uses setLockStatusToSheets (primary)
  const handleAdminToggleLock = async () => {
    if (!participant || !event) return;
    const pNo = parseInt(participant.id.replace('p', '')) || 0;
    const newLockState = !isLocked;
    const judgeTarget = judge === 'Admin' ? 'Kenji' : judge;

    setIsLocked(newLockState);

    // 1. Update LOCK_STATUS in Google Sheets (primary source of truth)
    const result = await setLockStatusToSheets(
      event.currentRound,
      participant.name,
      judgeTarget,
      newLockState
    );

    if (result.status === 'success') {
      showToast(
        newLockState
          ? `🔒 Penilaian berhasil dikunci. Akun juri akan terkunci otomatis.`
          : `🔓 Penilaian berhasil dibuka. Status sudah dikirim ke akun juri.`,
        'info'
      );
    } else {
      // Revert optimistic update if API fails
      setIsLocked(!newLockState);
      showToast('Gagal mengubah status lock. Coba lagi.', 'error');
      return;
    }

    // 2. Also update legacy SUBMISSIONS.isLocked for backward compat
    if (newLockState) {
      if (judge === 'Kenji') lockVocal(event.id, event.currentRound, participant.id);
      else if (judge === 'Ukey') lockPerformance(event.id, event.currentRound, participant.id);
      else if (judge === 'Revan') lockStaging(event.id, event.currentRound, participant.id);
    } else {
      if (judge === 'Kenji') unlockVocal(event.id, event.currentRound, participant.id);
      else if (judge === 'Ukey') unlockPerformance(event.id, event.currentRound, participant.id);
      else if (judge === 'Revan') unlockStaging(event.id, event.currentRound, participant.id);
    }

    // 3. Keep legacy toggleLock call for backward compat with SUBMISSIONS sheet
    toggleLockToSheets(event.id, event.currentRound, judgeTarget, pNo, newLockState);
  };

  // ─── Save handler with backend lock validation ─────────────
  const executeSave = async () => {
    if (!participant || !event) return;
    setIsSubmitting(true);

    const now = new Date().toLocaleString('id-ID');
    const device = detectDevice();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    const base = {
      id: `sub-${Date.now()}`,
      eventId: event.id,
      round: event.currentRound,
      participantId: participant.id,
      participantNo: participant.no,
      participantName: participant.name,
      songTitle: participant.songTitle,
      notes,
      isLocked: true,
      timestamp: now,
      deviceInfo: isAdminSession ? `${device} (Admin)` : device,
      userAgent: ua,
    };

    let saveResult: any;

    if (judge === 'Kenji') {
      const sub: VocalSubmission = { ...base, scores: vocal, subtotal: calcVocalSubtotal(vocal) };
      saveVocalSubmission(sub);
      saveResult = await submitVocalToSheets(sub);
    } else if (judge === 'Ukey') {
      const sub: PerformanceSubmission = { ...base, scores: perf, subtotal: calcPerformanceSubtotal(perf) };
      savePerformanceSubmission(sub);
      saveResult = await submitPerformanceToSheets(sub);
    } else if (judge === 'Revan') {
      const sub: StagingSubmission = { ...base, scores: staging, subtotal: calcStagingSubtotal(staging) };
      saveStagingSubmission(sub);
      saveResult = await submitStagingToSheets(sub);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);

    // Check if backend returned locked status
    if (saveResult && saveResult.status === 'locked') {
      showToast('🔒 Nilai tidak disimpan karena penilaian baru saja dikunci oleh Admin.', 'error');
      setIsLocked(true);
      return;
    }

    setIsLocked(true);

    showToast(
      `Nilai #${participant.no} ${participant.name} tersimpan & terkunci!`,
      'success',
      () => {
        // Undo: unlock via LOCK_STATUS (primary)
        setLockStatusToSheets(event.currentRound, participant.name, judge === 'Admin' ? 'Kenji' : judge, false);
        if (judge === 'Kenji') unlockVocal(event.id, event.currentRound, participant.id);
        else if (judge === 'Ukey') unlockPerformance(event.id, event.currentRound, participant.id);
        else if (judge === 'Revan') unlockStaging(event.id, event.currentRound, participant.id);
        setIsLocked(false);
        showToast('Kunci nilai dibuka kembali (Undo).', 'info');
      }
    );

    // Autoskip
    if (currentIndex < participants.length - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 600);
    }
  };

  if (isLoading) {
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-[85vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-white text-lg font-medium">Memuat data peserta...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-[85vh] text-center gap-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30">
          <p className="text-rose-400 font-medium mb-4">{errorMsg}</p>
          <button
            onClick={() => {
              if (judge) fetchAndInit(judge);
            }}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <span>🔄 Muat Ulang Peserta</span>
          </button>
        </div>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="p-6 text-center text-slate-400 mt-12 text-sm">
        Data peserta tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-5 pb-32">

      {/* ── ACTIVE ROUND BANNER ────────────────────────────────── */}
      {event && (
        <div className="w-full p-3 rounded-2xl bg-slate-900/90 border border-purple-500/40 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400">BABAK:</span>
            {event.currentRound.toLowerCase().includes('penyisihan') && (
              <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                🟠 BABAK PENYISIHAN
              </span>
            )}
            {event.currentRound.toLowerCase().includes('semi') && (
              <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-black">
                🟣 BABAK SEMIFINAL
              </span>
            )}
            {event.currentRound.toLowerCase().includes('final') && !event.currentRound.toLowerCase().includes('semi') && (
              <span className="px-3 py-1 rounded-xl bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs font-black">
                🟡 BABAK FINAL
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {participants.length} Peserta Babak Ini
          </span>
        </div>
      )}

      {/* ── HEADER SYNC BAR ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <span>{judge.toUpperCase()} SCORING</span>
        </h1>
        <button
          onClick={handleSyncSheets}
          disabled={isSyncing}
          className="px-3 py-1.5 rounded-xl bg-purple-600/30 border border-purple-500/50 text-purple-300 text-xs font-bold flex items-center gap-1.5 hover:bg-purple-600/50 transition-all disabled:opacity-50"
          title="Sinkronisasi data nilai dari Google Sheets ke web app"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Sheets'}</span>
        </button>
      </div>

      {/* ── REAL-TIME LOCK STATUS BADGE ─────────────────────── */}
      <div className={`w-full px-4 py-2.5 rounded-2xl border flex items-center justify-between transition-all duration-500 ${
        syncStatus === 'checking'
          ? 'bg-yellow-950/50 border-yellow-500/40'
          : syncStatus === 'locked'
          ? 'bg-rose-950/60 border-rose-500/50 shadow-rose-500/10 shadow-md'
          : syncStatus === 'error'
          ? 'bg-slate-900/70 border-slate-700/50'
          : 'bg-emerald-950/50 border-emerald-500/40'
      }`}>
        <div className="flex items-center gap-2">
          {syncStatus === 'checking' && (
            <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
          )}
          {syncStatus === 'locked' && (
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block" />
          )}
          {syncStatus === 'open' && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
          )}
          {syncStatus === 'error' && (
            <WifiOff className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className={`text-xs font-extrabold ${
            syncStatus === 'checking' ? 'text-yellow-300'
            : syncStatus === 'locked' ? 'text-rose-300'
            : syncStatus === 'error' ? 'text-slate-400'
            : 'text-emerald-300'
          }`}>
            {syncStatus === 'checking' && 'Memeriksa status Admin...'}
            {syncStatus === 'locked' && '🔴 PENILAIAN TERKUNCI'}
            {syncStatus === 'open' && '🟢 PENILAIAN TERBUKA'}
            {syncStatus === 'error' && 'Sinkronisasi Admin sedang bermasalah'}
          </span>
        </div>
        <span className={`text-[10px] font-medium ${
          syncStatus === 'error' ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {syncStatus === 'error' ? 'Cek koneksi' : 'Status tersinkron dengan Admin'}
        </span>
      </div>

      {/* ── ADMIN ROLE SWITCHER (Only visible when logged in as Admin) ── */}
      {isAdminSession && (
        <div className="p-3 rounded-2xl bg-purple-950/80 border border-purple-500/40 flex flex-col gap-2 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
            <UserCheck className="w-4 h-4 text-purple-400" />
            <span>MODE ADMIN: Pilih Juri untuk Input / Edit Nilai</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['Kenji', 'Ukey', 'Revan'] as JudgeRole[]).map((jRole) => (
              <button
                key={jRole}
                onClick={() => setJudge(jRole)}
                className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                  judge === jRole
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-purple-400 shadow-md'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {jRole} ({jRole === 'Kenji' ? 'Vocal' : jRole === 'Ukey' ? 'Perf' : 'Staging'})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── HEADER CARD ─────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-purple-500/40 shadow-2xl flex flex-col items-center text-center gap-3 relative overflow-hidden">
        {/* SEDANG TAMPIL banner */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-black tracking-widest uppercase shadow-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>SEDANG TAMPIL</span>
        </div>

        {/* Participant stepper */}
        <div className="flex items-center justify-between w-full px-2">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <span className="text-xs font-bold text-slate-300 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
            Peserta {currentIndex + 1} / {participants.length}
          </span>

          <button
            onClick={() => setCurrentIndex((i) => Math.min(participants.length - 1, i + 1))}
            disabled={currentIndex === participants.length - 1}
            className="w-10 h-10 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-30 active:scale-95 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/80 border border-purple-900/60 text-purple-300">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="font-mono font-bold text-base tracking-wider">{formatTimer(timerSecs)}</span>
          <button onClick={() => setTimerRunning((r) => !r)} className="ml-1 p-1 rounded-lg bg-purple-900/40">
            {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { setTimerRunning(false); setTimerSecs(0); }} className="p-1 rounded-lg bg-slate-800">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* BIG Participant # & Name */}
        <div className="flex flex-col items-center gap-1 my-1">
          <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-blue-200 to-indigo-300 tracking-tight">
            #{String(participant.no).padStart(2, '0')}
          </span>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">
            {participant.name}
          </h2>
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold mt-0.5">
            <Music className="w-3.5 h-3.5 text-purple-400" />
            <span>{participant.songTitle}</span>
          </div>
        </div>

        {/* Judge Category Badge */}
        {categoryMeta && (
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${categoryMeta.borderColor} bg-slate-900/60`}>
            <span className={`text-xs font-black uppercase tracking-widest ${categoryMeta.color}`}>
              {categoryMeta.label} — Juri: {judge}
            </span>
          </div>
        )}

        {/* Lock badge with Admin toggle option */}
        {isLocked ? (
          <div className="w-full py-2 px-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-rose-400" />
              <span>NILAI TERKUNCI</span>
            </div>
            {isAdminSession && (
              <button
                onClick={handleAdminToggleLock}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 hover:bg-emerald-500 transition-all"
              >
                <Unlock className="w-3 h-3" />
                <span>Admin Buka Kunci</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full py-1.5 px-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Unlock className="w-4 h-4 text-emerald-400" />
              <span>TERBUKA — Nilai dapat diedit & disimpan</span>
            </div>
            {isAdminSession && (
              <button
                onClick={handleAdminToggleLock}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black flex items-center gap-1 hover:bg-rose-500 transition-all"
              >
                <Lock className="w-3 h-3" />
                <span>Admin Kunci</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── SUBTOTAL DISPLAY ─────────────────────────────────── */}
      <div className={`glass-panel rounded-2xl p-4 border flex items-center justify-between ${colorTheme.borderColor}`}>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SUBTOTAL</span>
          <span className="text-[10px] text-slate-500">{colorTheme.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-4xl font-black ${colorTheme.textColor}`}>{subtotal}</span>
          <span className="text-xs font-semibold text-slate-400">/ {maxScore}</span>
        </div>
      </div>

      {/* ── KENJI — VOCAL SCORES ─────────────────────────────── */}
      {judge === 'Kenji' && (
        <div className="glass-panel rounded-3xl p-4 border border-purple-500/30 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-purple-900/40 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">VOCAL</h3>
            </div>
            <span className="text-xs font-bold text-purple-300 bg-purple-950/80 border border-purple-800/40 px-2.5 py-0.5 rounded-full">
              Maks 50 Poin
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {VOCAL_FIELDS.map(({ key, label, max }) => (
              <StepperInput
                key={key}
                label={label}
                max={max}
                value={vocal[key]}
                onChange={(val) => setVocal((prev) => ({ ...prev, [key]: val }))}
                disabled={isLocked && !isAdminSession}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── UKEY — PERFORMANCE SCORES ────────────────────────── */}
      {judge === 'Ukey' && (
        <div className="glass-panel rounded-3xl p-4 border border-blue-500/30 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-blue-900/40 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">PERFORMANCE</h3>
            </div>
            <span className="text-xs font-bold text-blue-300 bg-blue-950/80 border border-blue-800/40 px-2.5 py-0.5 rounded-full">
              Maks 30 Poin
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {PERFORMANCE_FIELDS.map(({ key, label, max }) => (
              <StepperInput
                key={key}
                label={label}
                max={max}
                value={perf[key]}
                onChange={(val) => setPerf((prev) => ({ ...prev, [key]: val }))}
                disabled={isLocked && !isAdminSession}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── REVAN — STAGING SCORES ───────────────────────────── */}
      {judge === 'Revan' && (
        <div className="glass-panel rounded-3xl p-4 border border-cyan-500/30 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">STAGING</h3>
            </div>
            <span className="text-xs font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/40 px-2.5 py-0.5 rounded-full">
              Maks 20 Poin
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {STAGING_FIELDS.map(({ key, label, max }) => (
              <StepperInput
                key={key}
                label={label}
                max={max}
                value={staging[key]}
                onChange={(val) => setStaging((prev) => ({ ...prev, [key]: val }))}
                disabled={isLocked && !isAdminSession}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional Notes */}
      <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-purple-400" />
          <span>Catatan (Opsional)</span>
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isLocked && !isAdminSession}
          placeholder="Catatan penampilan..."
          className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
        />
      </div>

      {/* Draft autosave note */}
      {!isLocked && (
        <p className="text-center text-[10px] text-slate-500">Draft autosave setiap 5 detik.</p>
      )}

      {/* ── STICKY ACTION BAR ────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-3 bg-slate-950/90 backdrop-blur-xl border-t border-purple-500/30 z-40 flex items-center justify-between gap-2 shadow-2xl">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex-1 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Sebelumnya</span>
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isLocked && !isAdminSession}
          className="flex-[1.4] h-14 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/40 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <Save className="w-5 h-5" />
          <span>💾 Simpan</span>
        </button>

        <button
          onClick={() => setCurrentIndex((i) => Math.min(participants.length - 1, i + 1))}
          disabled={currentIndex === participants.length - 1}
          className="flex-1 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30 active:scale-95 transition-all"
        >
          <span>Berikutnya</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        title="Simpan & Kunci Nilai?"
        message={`Simpan skor ${subtotal}/${maxScore} (${judge}) untuk #${participant.no} ${participant.name}? Nilai akan tersimpan ke database & Google Sheets.`}
        confirmText="Simpan & Lanjut"
        cancelText="Periksa Lagi"
        onConfirm={executeSave}
        onCancel={() => setIsModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
