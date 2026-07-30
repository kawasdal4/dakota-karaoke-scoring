'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw,
  Save, Lock, Unlock, Music, Clock, Sparkles, FileText, UserCheck, RefreshCw,
} from 'lucide-react';
import StepperInput from '@/components/ui/stepper-input';
import ConfirmationModal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  getStoredJudge, getActiveEvent, getAdminSettings,
  getVocalSubmissions, saveVocalSubmission, unlockVocal, lockVocal,
  getPerformanceSubmissions, savePerformanceSubmission, unlockPerformance, lockPerformance,
  getStagingSubmissions, saveStagingSubmission, unlockStaging, lockStaging,
  saveDraft, getDraft,
} from '@/lib/storage';
import { submitVocalToSheets, submitPerformanceToSheets, submitStagingToSheets, fetchParticipants, fetchSubmissionsFromSheets, toggleLockToSheets } from '@/lib/google-sheets';
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

  // Prevents auto-poll from reverting a lock change the user just made
  const lastLockActionRef = useRef<number>(0);
  const LOCK_DEBOUNCE_MS = 15000;

  const fetchAndInit = async (session: JudgeRole) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await fetchSubmissionsFromSheets().catch(() => {});
      const parts = await fetchParticipants();
      
      const evt = getActiveEvent();
      // Map to Participant interface in memory
      evt.participants = parts.map((p) => ({
        id: `p${p.number}`,
        no: p.number,
        name: p.name,
        songTitle: 'TBA',
        category: 'Umum'
      }));
      evt.totalParticipants = parts.length;
      
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

  const refreshCurrentScores = () => {
    if (!participant || !event) return;
    const settings = getAdminSettings();
    const isGlobal = settings.isGlobalScoringLocked;

    if (judge === 'Kenji') {
      const subs = getVocalSubmissions(event.id, event.currentRound);
      const existing = subs.find((s) => s.participantId === participant.id);
      if (existing) {
        setVocal(existing.scores);
        setNotes(existing.notes ?? '');
        setIsLocked(isGlobal || existing.isLocked);
        return;
      }
      const draft = getDraft(judge, participant.id) as VocalScores | null;
      setVocal(draft ?? DEFAULT_VOCAL);
      setNotes('');
      setIsLocked(isGlobal);

    } else if (judge === 'Ukey') {
      const subs = getPerformanceSubmissions(event.id, event.currentRound);
      const existing = subs.find((s) => s.participantId === participant.id);
      if (existing) {
        setPerf(existing.scores);
        setNotes(existing.notes ?? '');
        setIsLocked(isGlobal || existing.isLocked);
        return;
      }
      const draft = getDraft(judge, participant.id) as PerformanceScores | null;
      setPerf(draft ?? DEFAULT_PERF);
      setNotes('');
      setIsLocked(isGlobal);

    } else if (judge === 'Revan') {
      const subs = getStagingSubmissions(event.id, event.currentRound);
      const existing = subs.find((s) => s.participantId === participant.id);
      if (existing) {
        setStaging(existing.scores);
        setNotes(existing.notes ?? '');
        setIsLocked(isGlobal || existing.isLocked);
        return;
      }
      const draft = getDraft(judge, participant.id) as StagingScores | null;
      setStaging(draft ?? DEFAULT_STAGING);
      setNotes('');
      setIsLocked(isGlobal);
    }
  };

  // Load existing submission or draft when participant changes
  useEffect(() => {
    refreshCurrentScores();
  }, [currentIndex, event, judge]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncSheets = async () => {
    if (!participant || !event) {
      showToast('Peserta belum dimuat.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await fetchSubmissionsFromSheets();
      if (result) {
        const settings = getAdminSettings();
        const isGlobal = settings.isGlobalScoringLocked;

        if (judge === 'Kenji') {
          const existing = (result.vocal ?? []).find(
            (s) => s.participantId === participant.id && s.eventId === event.id && s.round === event.currentRound
          );
          if (existing) {
            setVocal({ accuracy: Number(existing.scores.accuracy), character: Number(existing.scores.character), tempo: Number(existing.scores.tempo), technique: Number(existing.scores.technique), expression: Number(existing.scores.expression) });
            setNotes(existing.notes ?? '');
            setIsLocked(isGlobal || existing.isLocked);
          } else { setIsLocked(isGlobal); }
        } else if (judge === 'Ukey') {
          const existing = (result.performance ?? []).find(
            (s) => s.participantId === participant.id && s.eventId === event.id && s.round === event.currentRound
          );
          if (existing) {
            setPerf({ expression: Number(existing.scores.expression), confidence: Number(existing.scores.confidence), appearance: Number(existing.scores.appearance), gesture: Number(existing.scores.gesture), creativity: Number(existing.scores.creativity) });
            setNotes(existing.notes ?? '');
            setIsLocked(isGlobal || existing.isLocked);
          } else { setIsLocked(isGlobal); }
        } else if (judge === 'Revan') {
          const existing = (result.staging ?? []).find(
            (s) => s.participantId === participant.id && s.eventId === event.id && s.round === event.currentRound
          );
          if (existing) {
            setStaging({ interaction: Number(existing.scores.interaction), communication: Number(existing.scores.communication), roomAtmosphere: Number(existing.scores.roomAtmosphere), audienceEngagement: Number(existing.scores.audienceEngagement) });
            setNotes(existing.notes ?? '');
            setIsLocked(isGlobal || existing.isLocked);
          } else { setIsLocked(isGlobal); }
        }
        showToast('✅ Berhasil sinkronisasi nilai dari Google Sheets!', 'success');
      } else {
        showToast('⚠️ Gagal sinkronisasi. Periksa URL Google Script.', 'error');
      }
    } catch (err: any) {
      showToast('❌ Error sinkronisasi: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Live storage / focus listener to pick up Admin unlock changes dynamically
  useEffect(() => {
    const syncLockState = () => {
      if (!participant || !event) return;
      const settings = getAdminSettings();
      if (settings.isGlobalScoringLocked) {
        setIsLocked(true);
        return;
      }

      if (judge === 'Kenji') {
        const subs = getVocalSubmissions(event.id, event.currentRound);
        const existing = subs.find((s) => s.participantId === participant.id);
        setIsLocked(existing ? existing.isLocked : false);
      } else if (judge === 'Ukey') {
        const subs = getPerformanceSubmissions(event.id, event.currentRound);
        const existing = subs.find((s) => s.participantId === participant.id);
        setIsLocked(existing ? existing.isLocked : false);
      } else if (judge === 'Revan') {
        const subs = getStagingSubmissions(event.id, event.currentRound);
        const existing = subs.find((s) => s.participantId === participant.id);
        setIsLocked(existing ? existing.isLocked : false);
      }
    };

    const syncFromSheetsAndRefresh = async () => {
      // Skip if user just changed a lock — let Sheets process it first
      if (Date.now() - lastLockActionRef.current < LOCK_DEBOUNCE_MS) {
        syncLockState();
        return;
      }
      try {
        const result = await fetchSubmissionsFromSheets();
        if (!result || !participant || !event) { syncLockState(); return; }
        const settings = getAdminSettings();
        const isGlobal = settings.isGlobalScoringLocked;
        if (judge === 'Kenji') {
          const ex = (result.vocal ?? []).find(
            (s) => s.participantId === participant.id && s.eventId === event.id && s.round === event.currentRound
          );
          if (ex) {
            setVocal({ accuracy: Number(ex.scores.accuracy), character: Number(ex.scores.character), tempo: Number(ex.scores.tempo), technique: Number(ex.scores.technique), expression: Number(ex.scores.expression) });
            setNotes(ex.notes ?? '');
            setIsLocked(isGlobal || ex.isLocked);
          } else { setIsLocked(isGlobal); }
        } else if (judge === 'Ukey') {
          const ex = (result.performance ?? []).find(
            (s) => s.participantId === participant.id && s.eventId === event.id && s.round === event.currentRound
          );
          if (ex) {
            setPerf({ expression: Number(ex.scores.expression), confidence: Number(ex.scores.confidence), appearance: Number(ex.scores.appearance), gesture: Number(ex.scores.gesture), creativity: Number(ex.scores.creativity) });
            setNotes(ex.notes ?? '');
            setIsLocked(isGlobal || ex.isLocked);
          } else { setIsLocked(isGlobal); }
        } else if (judge === 'Revan') {
          const ex = (result.staging ?? []).find(
            (s) => s.participantId === participant.id && s.eventId === event.id && s.round === event.currentRound
          );
          if (ex) {
            setStaging({ interaction: Number(ex.scores.interaction), communication: Number(ex.scores.communication), roomAtmosphere: Number(ex.scores.roomAtmosphere), audienceEngagement: Number(ex.scores.audienceEngagement) });
            setNotes(ex.notes ?? '');
            setIsLocked(isGlobal || ex.isLocked);
          } else { setIsLocked(isGlobal); }
        }
      } catch { syncLockState(); }
    };

    window.addEventListener('storage', syncLockState);
    window.addEventListener('focus', syncFromSheetsAndRefresh);

    // Auto-poll Google Sheets every 8 seconds for real-time lock/unlock changes from Admin
    const pollId = setInterval(syncFromSheetsAndRefresh, 8000);

    return () => {
      window.removeEventListener('storage', syncLockState);
      window.removeEventListener('focus', syncFromSheetsAndRefresh);
      clearInterval(pollId);
    };
  }, [participant, event, judge]);

  // Autosave draft every 5 s
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

  // Admin lock toggle directly from scoring page
  const handleAdminToggleLock = () => {
    if (!participant || !event) return;
    const pNo = parseInt(participant.id.replace('p', '')) || 0;
    const newLockState = !isLocked;
    // Mark timestamp so auto-poll won't override for 15s
    lastLockActionRef.current = Date.now();
    if (isLocked) {
      if (judge === 'Kenji') unlockVocal(event.id, event.currentRound, participant.id);
      else if (judge === 'Ukey') unlockPerformance(event.id, event.currentRound, participant.id);
      else if (judge === 'Revan') unlockStaging(event.id, event.currentRound, participant.id);
      setIsLocked(false);
      showToast(`Kunci nilai ${judge} DIBUKA oleh Admin.`, 'info');
    } else {
      if (judge === 'Kenji') lockVocal(event.id, event.currentRound, participant.id);
      else if (judge === 'Ukey') lockPerformance(event.id, event.currentRound, participant.id);
      else if (judge === 'Revan') lockStaging(event.id, event.currentRound, participant.id);
      setIsLocked(true);
      showToast(`Nilai ${judge} DITERAPKAN & TERKUNCI oleh Admin.`, 'info');
    }
    // Sync lock change to Google Sheets
    toggleLockToSheets(event.id, event.currentRound, judge, pNo, newLockState);
  };

  // Save handler
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

    if (judge === 'Kenji') {
      const sub: VocalSubmission = { ...base, scores: vocal, subtotal: calcVocalSubtotal(vocal) };
      saveVocalSubmission(sub);
      submitVocalToSheets(sub);
    } else if (judge === 'Ukey') {
      const sub: PerformanceSubmission = { ...base, scores: perf, subtotal: calcPerformanceSubtotal(perf) };
      savePerformanceSubmission(sub);
      submitPerformanceToSheets(sub);
    } else if (judge === 'Revan') {
      const sub: StagingSubmission = { ...base, scores: staging, subtotal: calcStagingSubtotal(staging) };
      saveStagingSubmission(sub);
      submitStagingToSheets(sub);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    setIsLocked(true);

    showToast(
      `Nilai #${participant.no} ${participant.name} tersimpan & terkunci!`,
      'success',
      () => {
        // Undo: unlock
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
