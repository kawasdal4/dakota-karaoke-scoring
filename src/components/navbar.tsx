'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Trophy, Award, Settings, UserCheck, ShieldCheck, Home } from 'lucide-react';
import { getStoredJudge, getActiveEvent } from '@/lib/storage';
import { JudgeRole, KaraokeEvent } from '@/types';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeJudge, setActiveJudge] = useState<JudgeRole>('Kenji');
  const [activeEvent, setActiveEvent] = useState<KaraokeEvent | null>(null);

  useEffect(() => {
    setActiveJudge(getStoredJudge());
    setActiveEvent(getActiveEvent());
  }, [pathname]);

  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-40 w-full max-w-[430px] mx-auto bg-slate-950/80 backdrop-blur-md border-b border-purple-500/20 px-4 py-2.5 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-bold text-xs shadow-lg shadow-purple-500/30 text-white">
          DK
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            DAKOTA KARAOKE
          </span>
          <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
            {activeEvent?.name || 'Event 2026'}
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/login')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-xs font-semibold text-purple-300 hover:bg-purple-900/60 transition-colors"
          title="Switch Judge Role"
        >
          <UserCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>{activeJudge}</span>
        </button>

        <Link
          href="/admin"
          className={`p-2 rounded-full border transition-colors ${
            pathname === '/admin'
              ? 'bg-blue-600/30 border-blue-400 text-blue-300'
              : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:text-white'
          }`}
          title="Admin Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
