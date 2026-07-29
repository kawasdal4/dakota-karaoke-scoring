'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Settings, ArrowLeft, Plus, Lock, Unlock, Download, Upload,
  ShieldAlert, Database, History, RefreshCw,
} from 'lucide-react';
import {
  getStoredEvents, getActiveEvent, saveEvents, setActiveEventId,
  getAdminSettings, saveAdminSettings, getAuditLogs,
  buildFinalScores,
  getVocalSubmissions, getPerformanceSubmissions, getStagingSubmissions,
  unlockVocal, unlockPerformance, unlockStaging,
  exportBackupJSON, importBackupJSON,
} from '@/lib/storage';
import { KaraokeEvent, AdminSettings, AuditLogEntry } from '@/types';
import { useToast } from '@/components/ui/toast';
import { fetchParticipants } from '@/lib/google-sheets';

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

  const load = async () => {
    // 1. Fetch live participants from Google Sheets first
    const parts = await fetchParticipants();
    if (parts.length > 0) {
      const { syncParticipants } = await import('@/lib/storage');
      syncParticipants(parts);
    }

    // 2. Load local state
    const allEvents = getStoredEvents();
    const active = getActiveEvent();
    setEvents(allEvents);
    setActiveEvent(active);
    setSettings(getAdminSettings());
    setAuditLogs(getAuditLogs().slice(0, 50));
  };

  useEffect(() => { load(); }, []);

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

  // Unlock individual submission
  const handleUnlock = (judge: string, participantId: string) => {
    if (!activeEvent) return;
    const round = activeEvent.currentRound;
    if (judge === 'Kenji') unlockVocal(activeEvent.id, round, participantId);
    else if (judge === 'Ukey') unlockPerformance(activeEvent.id, round, participantId);
    else if (judge === 'Revan') unlockStaging(activeEvent.id, round, participantId);
    showToast(`Kunci nilai ${judge} dibuka.`, 'info');
    load();
  };

  // Build submission view for locked-score management
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
        <button onClick={load} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
          <RefreshCw className="w-4 h-4" />
        </button>
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

      {/* ── 3. SCORE LOCK MANAGEMENT ───────────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-rose-500/30 flex flex-col gap-4">
        <h2 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 border-b border-rose-900/40 pb-2">
          <Lock className="w-4 h-4 text-rose-400" />
          <span>KELOLA KUNCI NILAI</span>
        </h2>

        {/* Vocal (Kenji) */}
        <SubSection title="KENJI — VOCAL" color="text-purple-300" submissions={vocalSubs} onUnlock={(id) => handleUnlock('Kenji', id)} />

        {/* Performance (Ukey) */}
        <SubSection title="UKEY — PERFORMANCE" color="text-blue-300" submissions={perfSubs} onUnlock={(id) => handleUnlock('Ukey', id)} />

        {/* Staging (Revan) */}
        <SubSection title="REVAN — STAGING" color="text-cyan-300" submissions={stagingSubs} onUnlock={(id) => handleUnlock('Revan', id)} />
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
    </div>
  );
}

// ─── Sub-component for each judge's locked submissions ───────

function SubSection({
  title, color, submissions, onUnlock,
}: {
  title: string;
  color: string;
  submissions: Array<{ participantId: string; participantNo: number; participantName: string; subtotal: number; isLocked: boolean }>;
  onUnlock: (participantId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={`text-[11px] font-extrabold uppercase tracking-wider ${color}`}>{title}</span>
      {submissions.length === 0 ? (
        <p className="text-[10px] text-slate-500 pl-1">Belum ada nilai tersimpan.</p>
      ) : submissions.map((s) => (
        <div key={s.participantId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-white font-semibold">#{s.participantNo} {s.participantName}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black ${color}`}>{s.subtotal}</span>
            {s.isLocked ? (
              <button
                onClick={() => onUnlock(s.participantId)}
                className="text-[10px] font-bold text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-lg flex items-center gap-1 hover:bg-rose-950/40"
              >
                <Unlock className="w-3 h-3" />
                <span>Buka</span>
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 font-semibold">Editable</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
