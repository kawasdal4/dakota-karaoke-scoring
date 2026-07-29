'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy, RefreshCw, ArrowLeft, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { getActiveEvent, buildFinalScores, getStoredJudge } from '@/lib/storage';
import { ParticipantFinalScore, KaraokeEvent } from '@/types';
import { useToast } from '@/components/ui/toast';
import { fetchParticipants } from '@/lib/google-sheets';
import { getAuthSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function RankingPage() {
  const { showToast } = useToast();
  const [event, setEvent] = useState<KaraokeEvent | null>(null);
  const [rows, setRows] = useState<ParticipantFinalScore[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const router = useRouter();

  const load = async () => {
    setIsRefreshing(true);
    
    // Fetch live participants
    const parts = await fetchParticipants();
    if (parts.length > 0) {
      const { syncParticipants } = await import('@/lib/storage');
      syncParticipants(parts);
    }
    
    const evt = getActiveEvent();
    setEvent(evt);
    const scores = buildFinalScores(evt.id, evt.currentRound);
    // Sort: complete entries by finalScore desc, then incomplete by name
    scores.sort((a, b) => {
      if (a.isComplete && b.isComplete) return (b.finalScore ?? 0) - (a.finalScore ?? 0);
      if (a.isComplete) return -1;
      if (b.isComplete) return 1;
      return a.participantNo - b.participantNo;
    });
    setRows(scores);
    setIsRefreshing(false);
  };

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    load();
  }, [router]);

  const handleRefresh = () => {
    load();
    showToast('Data ranking diperbarui.', 'info');
  };

  const judge = getStoredJudge();

  return (
    <div className="p-4 flex flex-col gap-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-black text-white flex items-center gap-1.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>LIVE RANKING</span>
          </h1>
          <span className="text-[10px] text-slate-400 font-semibold">{event?.name} • {event?.currentRound}</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-400 px-1">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Lengkap (3 juri)</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Menunggu juri</span>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[40px_1fr_52px_52px_52px_60px] gap-1 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
        <span>#</span>
        <span>Peserta</span>
        <span className="text-center text-purple-300">Kenji</span>
        <span className="text-center text-blue-300">Ukey</span>
        <span className="text-center text-cyan-300">Revan</span>
        <span className="text-center text-white">Total</span>
      </div>

      {/* Table Rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => {
          const rank = row.isComplete ? idx + 1 : null;
          return (
            <div
              key={row.participantId}
              className={`grid grid-cols-[40px_1fr_52px_52px_52px_60px] gap-1 items-center px-3 py-3 rounded-2xl border transition-all ${
                row.isComplete
                  ? rank === 1
                    ? 'bg-amber-950/30 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
                    : 'bg-slate-900/60 border-slate-800'
                  : 'bg-slate-900/30 border-slate-800/50 opacity-75'
              }`}
            >
              {/* Rank */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                rank === 1 ? 'bg-amber-400 text-slate-950' :
                rank === 2 ? 'bg-slate-300 text-slate-950' :
                rank === 3 ? 'bg-amber-700 text-white' :
                'bg-slate-800 text-slate-400'
              }`}>
                {rank ?? '—'}
              </div>

              {/* Name */}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  #{row.participantNo} {row.participantName}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{row.songTitle}</span>
              </div>

              {/* Kenji */}
              <ScoreCell value={row.kenjiscore} judgeLabel="Kenji" max={50} color="text-purple-300" />

              {/* Ukey */}
              <ScoreCell value={row.ukeyscore} judgeLabel="Ukey" max={30} color="text-blue-300" />

              {/* Revan */}
              <ScoreCell value={row.revanscore} judgeLabel="Revan" max={20} color="text-cyan-300" />

              {/* Final */}
              <div className="text-center">
                {row.isComplete ? (
                  <span className="text-lg font-black text-white">{row.finalScore}</span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-semibold leading-tight">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-component: Single score cell ───────────────────────

function ScoreCell({
  value, judgeLabel, max, color,
}: { value: number | null; judgeLabel: string; max: number; color: string }) {
  if (value !== null) {
    return (
      <div className="text-center">
        <span className={`text-sm font-black ${color}`}>{value}</span>
      </div>
    );
  }
  return (
    <div className="text-center flex flex-col items-center">
      <Clock className="w-3.5 h-3.5 text-amber-400" />
      <span className="text-[9px] text-amber-400 font-semibold leading-tight">Wait</span>
    </div>
  );
}
