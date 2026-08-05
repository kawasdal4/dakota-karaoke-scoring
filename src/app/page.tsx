'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Trophy, Settings, User, CheckCircle2, Users, KeyRound, LogOut } from 'lucide-react';
import { getActiveEvent, getVocalSubmissions, getPerformanceSubmissions, getStagingSubmissions, getQualifiedParticipants, buildFinalScores } from '@/lib/storage';
import { fetchParticipants } from '@/lib/google-sheets';
import { getAuthSession, logoutSession } from '@/lib/auth';
import { JudgeRole, KaraokeEvent } from '@/types';
import ChangePinModal from '@/components/change-pin-modal';

export default function DashboardPage() {
  const router = useRouter();
  const [judge, setJudge] = useState<JudgeRole | null>(null);
  const [activeEvent, setActiveEvent] = useState<KaraokeEvent | null>(null);
  const [activeParticipantsCount, setActiveParticipantsCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAndInit = async (session: JudgeRole) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const parts = await fetchParticipants();
      
      const evt = getActiveEvent();
      const mappedParts = parts.map((p) => ({
        id: `p${p.number}`,
        no: p.number,
        name: p.name,
        songTitle: 'TBA',
        category: 'Umum'
      }));
      evt.participants = mappedParts;
      evt.totalParticipants = parts.length;
      
      setActiveEvent(evt);

      // Get qualified participants for active round
      const qualified = getQualifiedParticipants(evt.id, evt.currentRound, mappedParts);
      setActiveParticipantsCount(qualified.length);

      // Count complete 3-judge submissions for active round
      const scores = buildFinalScores(evt.id, evt.currentRound, qualified);
      const completeScores = scores.filter((s) => s.isComplete);
      setCompletedCount(completeScores.length);
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
    setJudge(session);
    fetchAndInit(session);
  }, [router]);

  const handleLogout = () => {
    logoutSession();
    router.replace('/login');
  };

  if (!judge) return null;

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
            onClick={() => fetchAndInit(judge)}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <span>🔄 Muat Ulang Peserta</span>
          </button>
        </div>
      </div>
    );
  }

  const currentRoundName = activeEvent?.currentRound || 'Round Penyisihan';
  const isPenyisihan = currentRoundName.toLowerCase().includes('penyisihan');
  const isSemifinal  = currentRoundName.toLowerCase().includes('semi');
  const isFinal      = currentRoundName.toLowerCase().includes('final') && !isSemifinal;

  const remainingCount = Math.max(0, activeParticipantsCount - completedCount);
  const isRoundComplete = activeParticipantsCount > 0 && completedCount === activeParticipantsCount;

  return (
    <div className="p-5 flex flex-col gap-6 justify-center min-h-[85vh]">
      {/* ── TOP DASHBOARD CARD ──────────────────────────────────── */}
      <div className="glass-panel rounded-3xl p-6 border border-purple-500/30 flex flex-col items-center text-center gap-4 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Judge Active Indicator Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-black tracking-wide shadow-md">
          <User className="w-3.5 h-3.5 text-purple-400" />
          <span>Login sebagai {judge}</span>
        </div>

        {/* ACTIVE ROUND CARD */}
        <div className="flex flex-col items-center gap-2 w-full">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">BABAK AKTIF</span>
          <div className="flex items-center gap-2">
            {isPenyisihan && (
              <span className="px-4 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-lg font-black shadow-lg">
                🟠 PENYISIHAN
              </span>
            )}
            {isSemifinal && (
              <span className="px-4 py-1.5 rounded-2xl bg-purple-500/20 border border-purple-500/50 text-purple-300 text-lg font-black shadow-lg">
                🟣 SEMIFINAL
              </span>
            )}
            {isFinal && (
              <span className="px-4 py-1.5 rounded-2xl bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-lg font-black shadow-lg">
                🟡 FINAL
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-semibold">{activeEvent?.name}</span>
        </div>

        {/* PROGRESS STEPPER (Penyisihan → Semifinal → Final) */}
        <div className="w-full bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-1">
          <div className={`flex-1 py-1.5 rounded-xl text-[11px] font-black text-center transition-all ${
            isPenyisihan ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-500 bg-slate-950/50'
          }`}>
            1. Penyisihan
          </div>
          <span className="text-slate-600 font-bold">→</span>
          <div className={`flex-1 py-1.5 rounded-xl text-[11px] font-black text-center transition-all ${
            isSemifinal ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 bg-slate-950/50'
          }`}>
            2. Semifinal
          </div>
          <span className="text-slate-600 font-bold">→</span>
          <div className={`flex-1 py-1.5 rounded-xl text-[11px] font-black text-center transition-all ${
            isFinal ? 'bg-yellow-400 text-slate-950 shadow-md' : 'text-slate-500 bg-slate-950/50'
          }`}>
            3. Final
          </div>
        </div>

        {/* STATS 4-GRID */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold">Peserta Babak</span>
            <span className="text-lg font-black text-white">{activeParticipantsCount} Peserta</span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold">Status Penilaian</span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full mt-1 ${
              isRoundComplete ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
            }`}>
              {isRoundComplete ? '✅ Selesai' : '⏳ Berjalan'}
            </span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-emerald-400 font-semibold">Sudah Dinilai</span>
            <span className="text-lg font-black text-emerald-400">{completedCount}</span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-amber-400 font-semibold">Belum Dinilai</span>
            <span className="text-lg font-black text-amber-400">{remainingCount}</span>
          </div>
        </div>
      </div>


      {/* Primary Action Buttons (56px Min Height) */}
      <div className="flex flex-col gap-3 w-full">
        {/* Button 1: Mulai Scoring */}
        <Link
          href="/scoring"
          className="w-full min-h-[56px] h-14 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-extrabold text-lg flex items-center justify-center gap-3 shadow-xl shadow-purple-600/30 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>▶ Mulai Scoring</span>
        </Link>

        {/* Button 2: Ranking */}
        <Link
          href="/ranking"
          className="w-full min-h-[56px] h-14 rounded-2xl bg-slate-900/80 border border-purple-500/30 hover:border-purple-400 text-white font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
        >
          <Trophy className="w-5 h-5 text-amber-400" />
          <span>🏆 Live Ranking</span>
        </Link>

        {/* Button 3: Admin (If Admin or viewable) */}
        {judge === 'Admin' && (
          <Link
            href="/admin"
            className="w-full min-h-[56px] h-14 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <Settings className="w-5 h-5 text-amber-400" />
            <span>⚙ Admin Panel</span>
          </Link>
        )}

        {/* Account Management Actions */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="w-full min-h-[56px] h-14 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <KeyRound className="w-4 h-4 text-purple-400" />
            <span>Ganti PIN</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full min-h-[56px] h-14 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 text-rose-400 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Modal Change PIN */}
      {judge && (
        <ChangePinModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          currentRole={judge}
        />
      )}
    </div>
  );
}
