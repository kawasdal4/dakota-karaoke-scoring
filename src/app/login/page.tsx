'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { setStoredJudge } from '@/lib/storage';
import { JudgeRole } from '@/types';
import { useToast } from '@/components/ui/toast';

const ROLES: { name: JudgeRole; description: string; color: string }[] = [
  { name: 'Kenji', description: 'Juri Utama (Vokal & Teknis)', color: 'from-purple-600 to-indigo-600' },
  { name: 'Ukey', description: 'Juri Performa & Panggung', color: 'from-blue-600 to-cyan-600' },
  { name: 'Revan', description: 'Juri Ekspresi & Penguasaan Lagu', color: 'from-pink-600 to-rose-600' },
  { name: 'Admin', description: 'Akses Penuh Management & Lock', color: 'from-amber-600 to-orange-600' },
];

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<JudgeRole>('Kenji');

  const handleSelectRole = (role: JudgeRole) => {
    setSelected(role);
    setStoredJudge(role);
    showToast(`Masuk sebagai Juri: ${role}`, 'success');
    router.push('/');
  };

  return (
    <div className="min-h-[85vh] p-6 flex flex-col justify-center items-center">
      <div className="w-full flex flex-col items-center text-center gap-2 mb-8">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-xl shadow-purple-500/30 mb-2 border border-purple-400/30">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">DAKOTA KARAOKE</h1>
        <p className="text-xs text-slate-400 font-medium">Pilih Peran Juri untuk Memulai Penilaian</p>
      </div>

      <div className="w-full flex flex-col gap-3.5">
        {ROLES.map((role) => (
          <button
            key={role.name}
            onClick={() => handleSelectRole(role.name)}
            className={`w-full min-h-[56px] p-4 rounded-2xl border transition-all flex items-center justify-between text-left glass-button ${
              selected === role.name
                ? 'bg-purple-900/40 border-purple-400 shadow-lg shadow-purple-900/50'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center text-white font-bold text-sm shadow-md`}
              >
                {role.name === 'Admin' ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-white">{role.name}</span>
                <span className="text-[11px] text-slate-400">{role.description}</span>
              </div>
            </div>
            <div className="w-4 h-4 rounded-full border-2 border-purple-400 flex items-center justify-center">
              {selected === role.name && <div className="w-2 h-2 rounded-full bg-purple-400" />}
            </div>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 text-center mt-8 font-medium">
        PWA Optimized for Chrome Android & iPhone • Standalone Mode
      </p>
    </div>
  );
}
