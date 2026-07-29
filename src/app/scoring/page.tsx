'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw,
  Save, Lock, Music, Clock, Sparkles, FileText,
} from 'lucide-react';
import StepperInput from '@/components/ui/stepper-input';
import ConfirmationModal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  getStoredJudge, getActiveEvent,
  getVocalSubmissions, saveVocalSubmission, unlockVocal,
  getPerformanceSubmissions, savePerformanceSubmission, unlockPerformance,
  getStagingSubmissions, saveStagingSubmission, unlockStaging,
  saveDraft, getDraft,
} from '@/lib/storage';
import { submitVocalToSheets, submitPerformanceToSheets, submitStagingToSheets, fetchParticipants } from '@/lib/google-sheets';
import {
  VOCAL_FIELDS, PERFORMANCE_FIELDS, STAGING_FIELDS,
  calcVocalSubtotal, calcPerformanceSubtotal, calcStagingSubtotal,
  getScoreColorTheme, detectDevice, JUDGE_CATEGORIES,
} from '@/lib/utils';
import {
  JudgeRole, KaraokeEvent, Participant,
  VocalScores, PerformanceScores, StagingScores,
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

  // Load judge + event
  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session === 'Admin') {
      router.replace('/admin');
      return;
    }
    setJudge(session);

    const init = async () => {
      const parts = await fetchParticipants();
      if (parts.length > 0) {
        const { syncParticipants } = await import('@/lib/storage');
        syncParticipants(parts);
      }
      setEvent(getActiveEvent());
    };
    init();
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

  // Load existing submission or draft when participant changes
  useEffect(() => {
    if (!participant || !event) return;

    if (judge === 'Kenji') {
      const subs = getVocalSubmissions(event.id, event.currentRound);
      const existing = subs.find((s) => s.participantId === participant.id);
      if (existing) {
        setVocal(existing.scores);
        setNotes(existing.notes ?? '');
        setIsLocked(existing.isLocked);
        return;
      }
      const draft = getDraft(judge, participant.id) as VocalScores | null;
      setVocal(draft ?? DEFAULT_VOCAL);
      setNotes('');
      setIsLocked(false);

    } else if (judge === 'Ukey') {
      const subs = getPerformanceSubmissions(event.id, event.currentRound);
      const existing = subs.find((s) => s.participantId === participant.id);
      if (existing) {
        setPerf(existing.scores);
        setNotes(existing.notes ?? '');
        setIsLocked(existing.isLocked);
        return;
      }
      const draft = getDraft(judge, participant.id) as PerformanceScores | null;
      setPerf(draft ?? DEFAULT_PERF);
      setNotes('');
      setIsLocked(false);

    } else if (judge === 'Revan') {
      const subs = getStagingSubmissions(event.id, event.currentRound);
      const existing = subs.find((s) => s.participantId === participant.id);
      if (existing) {
        setStaging(existing.scores);
        setNotes(existing.notes ?? '');
        setIsLocked(existing.isLocked);
        return;
      }
      const draft = getDraft(judge, participant.id) as StagingScores | null;
      setStaging(draft ?? DEFAULT_STAGING);
      setNotes('');
      setIsLocked(false);
    }
  }, [currentIndex, event, judge]);

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
      deviceInfo: device,
      userAgent: ua,
    };

    if (judge === 'Kenji') {
      const sub = { ...base, scores: vocal, subtotal: calcVocalSubtotal(vocal) };
      saveVocalSubmission(sub);
      submitVocalToSheets(sub); // fire-and-forget, formulas untouched
    } else if (judge === 'Ukey') {
      const sub = { ...base, scores: perf, subtotal: calcPerformanceSubtotal(perf) };
      savePerformanceSubmission(sub);
      submitPerformanceToSheets(sub);
    } else if (judge === 'Revan') {
      const sub = { ...base, scores: staging, subtotal: calcStagingSubtotal(staging) };
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

  if (!participant) {
    return (
      <div className="p-6 text-center text-slate-400 mt-12 text-sm">
        Data peserta belum dimuat.
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-5 pb-32">

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

        {/* Lock badge */}
        {isLocked && (
          <div className="w-full py-1.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5">
            <Lock className="w-4 h-4 text-rose-400" />
            <span>NILAI TERKUNCI — Admin dapat membuka</span>
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
                disabled={isLocked}
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
                disabled={isLocked}
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
                disabled={isLocked}
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
          disabled={isLocked}
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
          disabled={isLocked}
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
        message={`Simpan skor ${subtotal}/${maxScore} untuk #${participant.no} ${participant.name}? Nilai akan terkunci otomatis.`}
        confirmText="Simpan & Lanjut"
        cancelText="Periksa Lagi"
        onConfirm={executeSave}
        onCancel={() => setIsModalOpen(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
