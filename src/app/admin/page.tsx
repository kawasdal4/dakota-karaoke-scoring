'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Settings, ArrowLeft, Plus, Lock, Unlock, Download, Upload,
  ShieldAlert, Database, History, RefreshCw, Edit3, X, Save,
} from 'lucide-react';
import {
  getStoredEvents, getActiveEvent, saveEvents, setActiveEventId,
  getAdminSettings, saveAdminSettings, getAuditLogs,
  getVocalSubmissions, getPerformanceSubmissions, getStagingSubmissions,
  unlockVocal, unlockPerformance, unlockStaging,
  lockVocal, lockPerformance, lockStaging,
  saveVocalSubmission, savePerformanceSubmission, saveStagingSubmission,
  exportBackupJSON, importBackupJSON,
} from '@/lib/storage';
import {
  VOCAL_FIELDS, PERFORMANCE_FIELDS, STAGING_FIELDS,
  calcVocalSubtotal, calcPerformanceSubtotal, calcStagingSubtotal,
  detectDevice
} from '@/lib/utils';
import { submitVocalToSheets, submitPerformanceToSheets, submitStagingToSheets, fetchParticipants, fetchSubmissionsFromSheets, toggleLockToSheets, saveGlobalLockToSheets } from '@/lib/google-sheets';
import { KaraokeEvent, AdminSettings, AuditLogEntry, VocalSubmission, PerformanceSubmission, StagingSubmission } from '@/types';
import { useToast } from '@/components/ui/toast';
import StepperInput from '@/components/ui/stepper-input';
import { getAuthSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { showToast } = useToast();

  const [events, setEvents] = useState<KaraokeEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<KaraokeEvent | null>(null);
  const [settings, setSettings] = useState<AdminSettings>({
    activeEventId: '', googleScriptUrl: '', isGlobalScoringLocked: false,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventParticipants, setNewEventParticipants] = useState(31);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Admin direct score editor modal state
  const [editingSub, setEditingSub] = useState<{
    judge: 'Kenji' | 'Ukey' | 'Revan';
    participantId: string;
    participantNo: number;
    participantName: string;
    songTitle?: string;
    scores: any;
    notes: string;
    isLocked: boolean;
  } | null>(null);

  const router = useRouter();

  const handleSyncSheets = async () => {
    setIsSyncing(true);
    try {
      const result = await fetchSubmissionsFromSheets();
      if (result) {
        showToast('Berhasil sinkronisasi data nilai dari Google Sheets!', 'success');
        load();
      } else {
        showToast('Gagal sinkronisasi data (Cek URL Google Script).', 'error');
      }
    } catch (err: any) {
      showToast('Error sinkronisasi: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Load local state only (without re-fetching from Sheets)
  const loadLocal = async () => {
    try {
      const parts = await fetchParticipants();
      const evt = getActiveEvent();
      evt.participants = parts.map((p) => ({
        id: `p${p.number}`,
        no: p.number,
        name: p.name,
        songTitle: 'TBA',
        category: 'Umum'
      }));
      evt.totalParticipants = parts.length;
      setActiveEvent(evt);
    } catch { /* keep existing participants */ }
    const allEvents = getStoredEvents();
    const active = getActiveEvent();
    setEvents(allEvents);
    setActiveEvent(active);
    setSettings(getAdminSettings());
    setAuditLogs(getAuditLogs().slice(0, 50));
  };

  const load = async () => {
    await fetchSubmissionsFromSheets().catch(() => {});
    // 1. Fetch live participants from Google Sheets first
    try {
      const parts = await fetchParticipants();
      
      const evt = getActiveEvent();
      evt.participants = parts.map((p) => ({
        id: `p${p.number}`,
        no: p.number,
        name: p.name,
        songTitle: 'TBA',
        category: 'Umum'
      }));
      evt.totalParticipants = parts.length;
      setActiveEvent(evt);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat peserta', 'error');
    }

    // 2. Load local state
    const allEvents = getStoredEvents();
    const active = getActiveEvent();
    setEvents(allEvents);
    setActiveEvent(active);
    setSettings(getAdminSettings());
    setAuditLogs(getAuditLogs().slice(0, 50));
  };

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session !== 'Admin') {
      router.replace('/');
      return;
    }
    load();
  }, [router]);

  const handleSwitchEvent = (id: string) => {
    setActiveEventId(id);
    load();
    showToast('Event aktif diubah.', 'info');
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    const newEvt: KaraokeEvent = {
      id: `evt-${Date.now()}`,
      name: newEventName,
      date: new Date().toISOString().split('T')[0],
      totalParticipants: newEventParticipants,
      judges: ['Kenji', 'Ukey', 'Revan', 'Admin'],
      rounds: ['Round Penyisihan', 'Semifinal', 'Grand Final'],
      currentRound: 'Round Penyisihan',
      isLocked: false,
      participants: [],
    };
    const updated = [...events, newEvt];
    saveEvents(updated);
    setActiveEventId(newEvt.id);
    setNewEventName('');
    setIsCreatingEvent(false);
    load();
    showToast(`Event "${newEvt.name}" dibuat & diaktifkan!`, 'success');
  };

  const handleToggleGlobalLock = () => {
    const next = { ...settings, isGlobalScoringLocked: !settings.isGlobalScoringLocked };
    setSettings(next);
    saveAdminSettings(next);
    saveGlobalLockToSheets(next.isGlobalScoringLocked);
    showToast(next.isGlobalScoringLocked ? 'Scoring TERKUNCI global.' : 'Scoring DIBUKA global.', 'info');
  };

  const handleSaveSettings = () => {
    saveAdminSettings(settings);
    showToast('Pengaturan disimpan.', 'success');
  };

  const handleExport = () => {
    const json = exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dakota-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Backup JSON berhasil diunduh!', 'success');
  };

  const handleImport = () => {
    if (!importJsonText.trim()) return;
    const ok = importBackupJSON(importJsonText);
    if (ok) {
      load();
      setImportJsonText('');
      setShowImportBox(false);
      showToast('Data berhasil di-restore!', 'success');
    } else {
      showToast('Format JSON tidak valid.', 'error');
    }
  };

  // Toggle lock individual submission
  const handleToggleLock = (judge: 'Kenji' | 'Ukey' | 'Revan', participantId: string, isCurrentlyLocked: boolean) => {
    if (!activeEvent) return;
    const round = activeEvent.currentRound;
    const pNo = parseInt(participantId.replace('p', '')) || 0;
    const newLockState = !isCurrentlyLocked;

    if (isCurrentlyLocked) {
      if (judge === 'Kenji') unlockVocal(activeEvent.id, round, participantId);
      else if (judge === 'Ukey') unlockPerformance(activeEvent.id, round, participantId);
      else if (judge === 'Revan') unlockStaging(activeEvent.id, round, participantId);
      showToast(`Kunci nilai ${judge} DIBUKA. Juri/Admin sekarang bisa edit.`, 'info');
    } else {
      if (judge === 'Kenji') lockVocal(activeEvent.id, round, participantId);
      else if (judge === 'Ukey') lockPerformance(activeEvent.id, round, participantId);
      else if (judge === 'Revan') lockStaging(activeEvent.id, round, participantId);
      showToast(`Nilai ${judge} DITERAPKAN & TERKUNCI.`, 'info');
    }
    toggleLockToSheets(activeEvent.id, round, judge, pNo, newLockState);
    // Use loadLocal() to avoid re-fetching from Sheets (which may not have processed the lock yet)
    loadLocal();
  };

  // Open Edit modal for a submission
  const handleOpenEdit = (judge: 'Kenji' | 'Ukey' | 'Revan', sub: any) => {
    setEditingSub({
      judge,
      participantId: sub.participantId,
      participantNo: sub.participantNo,
      participantName: sub.participantName,
      songTitle: sub.songTitle,
      scores: { ...sub.scores },
      notes: sub.notes || '',
      isLocked: sub.isLocked ?? false,
    });
  };

  // Save changes from Admin Edit Modal
  const handleSaveEditSub = () => {
    if (!editingSub || !activeEvent) return;
    const now = new Date().toLocaleString('id-ID');
    const device = detectDevice();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    const base = {
      id: `sub-${Date.now()}`,
      eventId: activeEvent.id,
      round: activeEvent.currentRound,
      participantId: editingSub.participantId,
      participantNo: editingSub.participantNo,
      participantName: editingSub.participantName,
      songTitle: editingSub.songTitle || 'TBA',
      notes: editingSub.notes,
      isLocked: editingSub.isLocked,
      timestamp: now,
      deviceInfo: `${device} (Admin Edit)`,
      userAgent: ua,
    };

    if (editingSub.judge === 'Kenji') {
      const sub: VocalSubmission = {
        ...base,
        scores: editingSub.scores,
        subtotal: calcVocalSubtotal(editingSub.scores),
      };
      saveVocalSubmission(sub);
      submitVocalToSheets(sub);
    } else if (editingSub.judge === 'Ukey') {
      const sub: PerformanceSubmission = {
        ...base,
        scores: editingSub.scores,
        subtotal: calcPerformanceSubtotal(editingSub.scores),
      };
      savePerformanceSubmission(sub);
      submitPerformanceToSheets(sub);
    } else if (editingSub.judge === 'Revan') {
      const sub: StagingSubmission = {
        ...base,
        scores: editingSub.scores,
        subtotal: calcStagingSubtotal(editingSub.scores),
      };
      saveStagingSubmission(sub);
      submitStagingToSheets(sub);
    }

    setEditingSub(null);
    showToast(`Nilai ${editingSub.judge} untuk #${editingSub.participantNo} ${editingSub.participantName} berhasil diperbarui!`, 'success');
    load();
  };

  // Submissions lists for locked-score management
  const vocalSubs   = activeEvent ? getVocalSubmissions(activeEvent.id, activeEvent.currentRound) : [];
  const perfSubs    = activeEvent ? getPerformanceSubmissions(activeEvent.id, activeEvent.currentRound) : [];
  const stagingSubs = activeEvent ? getStagingSubmissions(activeEvent.id, activeEvent.currentRound) : [];

  return (
    <div className="p-4 flex flex-col gap-6 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <span>ADMIN CONTROL</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncSheets}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-purple-600/30 border border-purple-500/50 text-purple-300 text-xs font-bold flex items-center gap-1.5 hover:bg-purple-600/50 transition-all disabled:opacity-50"
            title="Sinkronisasi data nilai dari Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Sheets'}</span>
          </button>
        </div>
      </div>

      {/* ── 1. MULTI-EVENT ──────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-purple-500/30 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-2">
          <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            <span>EVENT MANAGER</span>
          </h2>
          <button
            onClick={() => setIsCreatingEvent((p) => !p)}
            className="px-3 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Event Baru</span>
          </button>
        </div>

        {isCreatingEvent && (
          <form onSubmit={handleCreateEvent} className="p-3 rounded-2xl bg-slate-900/80 border border-purple-800/40 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-300">Nama Event</label>
              <input
                type="text" required value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="Dakota Karaoke Cup 2026"
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-300">Jumlah Peserta</label>
              <input
                type="number" min={1} max={100} inputMode="numeric"
                value={newEventParticipants}
                onChange={(e) => setNewEventParticipants(parseInt(e.target.value) || 31)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold">
              Simpan & Aktifkan Event
            </button>
          </form>
        )}

        <div className="flex flex-col gap-2">
          {events.map((evt) => (
            <button
              key={evt.id}
              onClick={() => handleSwitchEvent(evt.id)}
              className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-all ${
                activeEvent?.id === evt.id
                  ? 'bg-purple-950/80 border-purple-400 text-white shadow-lg'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">{evt.name}</span>
                <span className="text-[10px] text-slate-400">{evt.totalParticipants} Peserta • {evt.currentRound}</span>
              </div>
              {activeEvent?.id === evt.id && (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">AKTIF</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. GLOBAL LOCK & APPS SCRIPT URL ────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-blue-500/30 flex flex-col gap-4">
        <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 border-b border-blue-900/40 pb-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <span>KONTROL & GOOGLE SHEETS</span>
        </h2>

        {/* Global Lock */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Global Lock Penilaian</span>
            <span className="text-[10px] text-slate-400">Cegah semua juri submit nilai baru</span>
          </div>
          <button
            onClick={handleToggleGlobalLock}
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
              settings.isGlobalScoringLocked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
            }`}
          >
            {settings.isGlobalScoringLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{settings.isGlobalScoringLocked ? 'TERKUNCI' : 'BUKA'}</span>
          </button>
        </div>

        {/* Apps Script URL */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300">Google Apps Script Web App URL</label>
          <input
            type="text"
            value={settings.googleScriptUrl}
            onChange={(e) => setSettings((p) => ({ ...p, googleScriptUrl: e.target.value }))}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
          />
          <p className="text-[10px] text-slate-400">
            Kenji → Vocal cells. Ukey → Performance cells. Revan → Staging cells. Formulas tidak disentuh.
          </p>
          <button onClick={handleSaveSettings} className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold mt-1">
            Simpan Endpoint URL
          </button>
        </div>
      </div>

      {/* ── 3. SCORE LOCK & EDIT MANAGEMENT ───────────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-rose-500/30 flex flex-col gap-4">
        <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 border-b border-rose-900/40 pb-2">
          <Lock className="w-4 h-4 text-rose-400" />
          <span>KELOLA & EDIT NILAI JURI</span>
        </h2>

        {/* Vocal (Kenji) */}
        <SubSection
          judgeRole="Kenji"
          title="KENJI — VOCAL"
          color="text-purple-300"
          participants={activeEvent?.participants || []}
          submissions={vocalSubs}
          onToggleLock={(id, locked) => handleToggleLock('Kenji', id, locked)}
          onEdit={(sub) => handleOpenEdit('Kenji', sub)}
        />

        {/* Performance (Ukey) */}
        <SubSection
          judgeRole="Ukey"
          title="UKEY — PERFORMANCE"
          color="text-blue-300"
          participants={activeEvent?.participants || []}
          submissions={perfSubs}
          onToggleLock={(id, locked) => handleToggleLock('Ukey', id, locked)}
          onEdit={(sub) => handleOpenEdit('Ukey', sub)}
        />

        {/* Staging (Revan) */}
        <SubSection
          judgeRole="Revan"
          title="REVAN — STAGING"
          color="text-cyan-300"
          participants={activeEvent?.participants || []}
          submissions={stagingSubs}
          onToggleLock={(id, locked) => handleToggleLock('Revan', id, locked)}
          onEdit={(sub) => handleOpenEdit('Revan', sub)}
        />
      </div>

      {/* ── 4. BACKUP & RESTORE ──────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-emerald-500/30 flex flex-col gap-4">
        <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 border-b border-emerald-900/40 pb-2">
          <Download className="w-4 h-4 text-emerald-400" />
          <span>EMERGENCY BACKUP & RESTORE</span>
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExport}
            className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex flex-col items-center gap-1.5 active:scale-95 transition-all"
          >
            <Download className="w-5 h-5 text-emerald-400" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={() => setShowImportBox((p) => !p)}
            className="p-3 rounded-2xl bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-bold flex flex-col items-center gap-1.5 active:scale-95 transition-all"
          >
            <Upload className="w-5 h-5 text-blue-400" />
            <span>Restore JSON</span>
          </button>
        </div>

        {showImportBox && (
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Paste JSON Backup:</span>
            <textarea
              rows={4} value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste teks JSON backup di sini..."
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleImport} className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">
              Proses Restore
            </button>
          </div>
        )}
      </div>

      {/* ── 5. AUDIT LOG ──────────────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-purple-500/30 flex flex-col gap-4">
        <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 border-b border-purple-900/40 pb-2">
          <History className="w-4 h-4 text-purple-400" />
          <span>AUDIT LOG PENILAIAN</span>
        </h2>

        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto no-scrollbar">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Belum ada log.</p>
          ) : auditLogs.map((log) => (
            <div key={log.id} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">#{log.participantNo} {log.participantName}</span>
                <span className={`font-black text-sm ${
                  log.category === 'VOCAL' ? 'text-purple-400' :
                  log.category === 'PERFORMANCE' ? 'text-blue-400' :
                  log.category === 'STAGING' ? 'text-cyan-400' : 'text-slate-400'
                }`}>{log.subtotal > 0 ? `${log.subtotal} pts` : log.action}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Juri: <strong className="text-slate-200">{log.judgeName}</strong> ({log.category})</span>
                <span>{log.timestamp}</span>
              </div>
              <span className="text-[10px] text-slate-500">{log.deviceInfo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ADMIN DIRECT EDIT MODAL ─────────────────────────── */}
      {editingSub && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-950 border border-purple-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-purple-900/40 pb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">EDIT NILAI LANGSUNG (ADMIN)</span>
                <h3 className="text-base font-black text-white">#{editingSub.participantNo} {editingSub.participantName}</h3>
              </div>
              <button onClick={() => setEditingSub(null)} className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {editingSub.judge === 'Kenji' && VOCAL_FIELDS.map(({ key, label, max }) => (
                <StepperInput
                  key={key}
                  label={label}
                  max={max}
                  value={editingSub.scores[key] ?? 0}
                  onChange={(val) => setEditingSub((prev) => prev ? {
                    ...prev,
                    scores: { ...prev.scores, [key]: val }
                  } : null)}
                />
              ))}

              {editingSub.judge === 'Ukey' && PERFORMANCE_FIELDS.map(({ key, label, max }) => (
                <StepperInput
                  key={key}
                  label={label}
                  max={max}
                  value={editingSub.scores[key] ?? 0}
                  onChange={(val) => setEditingSub((prev) => prev ? {
                    ...prev,
                    scores: { ...prev.scores, [key]: val }
                  } : null)}
                />
              ))}

              {editingSub.judge === 'Revan' && STAGING_FIELDS.map(({ key, label, max }) => (
                <StepperInput
                  key={key}
                  label={label}
                  max={max}
                  value={editingSub.scores[key] ?? 0}
                  onChange={(val) => setEditingSub((prev) => prev ? {
                    ...prev,
                    scores: { ...prev.scores, [key]: val }
                  } : null)}
                />
              ))}
            </div>

            {/* Total score preview */}
            <div className="p-3 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-between">
              <span className="text-xs font-bold text-purple-200">SUBTOTAL REVISI:</span>
              <span className="text-xl font-black text-purple-300">
                {editingSub.judge === 'Kenji' ? calcVocalSubtotal(editingSub.scores) :
                 editingSub.judge === 'Ukey'  ? calcPerformanceSubtotal(editingSub.scores) :
                 calcStagingSubtotal(editingSub.scores)} Poin
              </span>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Catatan Juri/Admin:</label>
              <textarea
                rows={2}
                value={editingSub.notes}
                onChange={(e) => setEditingSub((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Lock Status Checkbox */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <input
                type="checkbox"
                id="editLockCheck"
                checked={editingSub.isLocked}
                onChange={(e) => setEditingSub((prev) => prev ? { ...prev, isLocked: e.target.checked } : null)}
                className="w-4 h-4 accent-purple-600 rounded"
              />
              <label htmlFor="editLockCheck" className="text-xs font-bold text-slate-200 cursor-pointer">
                Kunci Nilai Setelah Disimpan (Locked)
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setEditingSub(null)}
                className="flex-1 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditSub}
                className="flex-[1.5] py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/40"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Sub-component for each judge's locked submissions ───────

function SubSection({
  judgeRole, title, color, participants, submissions, onToggleLock, onEdit,
}: {
  judgeRole: 'Kenji' | 'Ukey' | 'Revan';
  title: string;
  color: string;
  participants: Array<{ id: string; no: number; name: string }>;
  submissions: Array<{ participantId: string; participantNo: number; participantName: string; subtotal: number; isLocked: boolean }>;
  onToggleLock: (participantId: string, currentLocked: boolean) => void;
  onEdit: (sub: any) => void;
}) {
  const displayList = participants.length > 0 ? participants.map((p) => {
    const sub = submissions.find((s) => s.participantId === p.id);
    return {
      participantId: p.id,
      participantNo: p.no,
      participantName: p.name,
      subtotal: sub ? sub.subtotal : null,
      isLocked: sub ? sub.isLocked : false,
      subObj: sub || null,
    };
  }) : submissions.map((s) => ({
    participantId: s.participantId,
    participantNo: s.participantNo,
    participantName: s.participantName,
    subtotal: s.subtotal,
    isLocked: s.isLocked,
    subObj: s,
  }));

  return (
    <div className="flex flex-col gap-2">
      <span className={`text-[11px] font-extrabold uppercase tracking-wider ${color}`}>{title}</span>
      {displayList.length === 0 ? (
        <p className="text-[10px] text-slate-500 pl-1">Belum ada peserta.</p>
      ) : displayList.map((item) => (
        <div key={item.participantId} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex flex-col">
            <span className="text-xs text-white font-semibold">#{item.participantNo} {item.participantName}</span>
            <span className={`text-xs font-black ${item.subtotal !== null ? color : 'text-slate-500'}`}>
              {item.subtotal !== null ? `${item.subtotal} Poin` : 'Belum Submit'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {item.subObj && (
              <button
                onClick={() => onEdit(item.subObj)}
                className="px-2.5 py-1 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center gap-1 hover:bg-purple-900/80 transition-all"
                title="Edit Nilai Langsung"
              >
                <Edit3 className="w-3 h-3 text-purple-400" />
                <span>Edit</span>
              </button>
            )}

            <button
              onClick={() => onToggleLock(item.participantId, item.isLocked)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 transition-all ${
                item.isLocked
                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-300 hover:bg-rose-900/80'
                  : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80'
              }`}
            >
              {item.isLocked ? (
                <>
                  <Unlock className="w-3 h-3 text-rose-400" />
                  <span>Buka Kunci</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Kunci</span>
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
