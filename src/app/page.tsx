'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Trophy, Settings, User, CheckCircle2, Users, KeyRound, LogOut } from 'lucide-react';
import { getActiveEvent, getVocalSubmissions, getPerformanceSubmissions, getStagingSubmissions } from '@/lib/storage';
import { fetchParticipants } from '@/lib/google-sheets';
import { getAuthSession, logoutSession } from '@/lib/auth';
import { JudgeRole, KaraokeEvent } from '@/types';
import ChangePinModal from '@/components/change-pin-modal';

export default function DashboardPage() {
  const router = useRouter();
  const [judge, setJudge] = useState<JudgeRole | null>(null);
  const [activeEvent, setActiveEvent] = useState<KaraokeEvent | null>(null);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setJudge(session);

    const init = async () => {
      const parts = await fetchParticipants();
      if (parts.length > 0) {
        const { syncParticipants } = await import('@/lib/storage');
        syncParticipants(parts);
      }
      
      const evt = getActiveEvent();
      setActiveEvent(evt);

      let count = 0;
      if (session === 'Kenji') {
        count = getVocalSubmissions(evt.id, evt.currentRound).length;
      } else if (session === 'Ukey') {
        count = getPerformanceSubmissions(evt.id, evt.currentRound).length;
      } else if (session === 'Revan') {
        count = getStagingSubmissions(evt.id, evt.currentRound).length;
      }
      setCompletedCount(count);
    };
    init();
  }, [router]);

  const handleLogout = () => {
    logoutSession();
    router.replace('/login');
  };

  if (!judge) return null;

  const totalParticipants = activeEvent?.totalParticipants || 31;

  return (
    <div className="p-5 flex flex-col gap-6 justify-center min-h-[85vh]">
      {/* Top Minimalist Card */}
      <div className="glass-panel rounded-3xl p-6 border border-purple-500/30 flex flex-col items-center text-center gap-4 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Judge Active Indicator Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-sm font-black tracking-wide shadow-md">
          <User className="w-4 h-4 text-purple-400" />
          <span>Login sebagai {judge}</span>
        </div>

        {/* Round Title */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            {activeEvent?.name || 'Dakota Karaoke'}
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {activeEvent?.currentRound || 'Round Penyisihan'}
          </h2>
        </div>

        {/* Stats Pill Grid */}
        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mb-1">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Total Peserta</span>
            </div>
            <span className="text-xl font-black text-white">{totalParticipants} Peserta</span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sudah Dinilai</span>
            </div>
            <span className="text-xl font-black text-emerald-400">{completedCount} Dinilai</span>
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
