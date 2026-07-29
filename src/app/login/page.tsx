'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, ShieldCheck, Sparkles, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { JudgeRole } from '@/types';
import { verifyPin, setAuthSession } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';

const ROLES: { name: JudgeRole; description: string; color: string }[] = [
  { name: 'Kenji', description: 'Penilaian Vocal (Maks 50 Poin)', color: 'from-purple-600 to-indigo-600' },
  { name: 'Ukey', description: 'Penilaian Performance (Maks 30 Poin)', color: 'from-blue-600 to-cyan-600' },
  { name: 'Revan', description: 'Penilaian Staging (Maks 20 Poin)', color: 'from-pink-600 to-rose-600' },
  { name: 'Admin', description: 'Management & Lock Control', color: 'from-amber-600 to-orange-600' },
];

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [selectedRole, setSelectedRole] = useState<JudgeRole | null>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setErrorMsg(null);
    }
  };

  const handleKeypadBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRole || pin.length < 4 || pin.length > 6) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const verifyRes = await verifyPin(selectedRole, pin);
    setIsSubmitting(false);

    if (!verifyRes.success) {
      setErrorMsg(verifyRes.message || 'PIN salah. Silakan coba lagi.');
      setPin('');
      return;
    }

    showToast(`Berhasil masuk sebagai ${selectedRole}`, 'success');
    router.replace(selectedRole === 'Admin' ? '/admin' : '/');
  };

  return (
    <div className="min-h-[90vh] p-4 flex flex-col justify-center items-center pb-12">
      {/* App Branding */}
      <div className="w-full flex flex-col items-center text-center gap-2 mb-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-xl shadow-purple-500/30 mb-1 border border-purple-400/30">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">DAKOTA KARAOKE</h1>
        <p className="text-xs text-slate-400 font-medium">Sistem Penilaian & Auth PIN Juri</p>
      </div>

      <div className="w-full max-w-[430px] flex flex-col gap-4">
        {/* Step 1: Account Selector */}
        {!selectedRole ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-1">
              Pilih Akun Pengguna
            </h2>
            {ROLES.map((role) => (
              <button
                key={role.name}
                onClick={() => {
                  setSelectedRole(role.name);
                  setPin('');
                  setErrorMsg(null);
                }}
                className="w-full min-h-[56px] p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-purple-900/30 hover:border-purple-500/50 transition-all flex items-center justify-between text-left glass-button active:scale-98"
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
              </button>
            ))}
          </div>
        ) : (
          /* Step 2: Enter PIN Form */
          <div className="glass-panel rounded-3xl p-6 border border-purple-500/30 shadow-2xl flex flex-col gap-5 animate-fade-in">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-300">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Akun: <span className="text-purple-300 font-black">{selectedRole}</span></h3>
                  <p className="text-[11px] text-slate-400">Masukkan 4-6 Digit PIN</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRole(null);
                  setPin('');
                  setErrorMsg(null);
                }}
                className="text-xs font-bold text-purple-400 hover:underline"
              >
                Ganti Akun
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Hidden/Visble PIN Display Input */}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="relative flex items-center">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setPin(clean);
                    setErrorMsg(null);
                  }}
                  placeholder="PIN (4-6 digit)"
                  className="w-full h-14 text-center text-xl font-bold tracking-[0.4em] bg-slate-950/80 border border-slate-800 rounded-2xl text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-4 text-slate-400 hover:text-white p-1"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* On-screen Large Touch Keypad for Mobile Comfort */}
              <div className="grid grid-cols-3 gap-2 my-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="h-12 rounded-xl bg-slate-900/90 border border-slate-800 text-lg font-bold text-white active:scale-95 transition-all hover:bg-slate-800"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="h-12 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-rose-400 active:scale-95 transition-all"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-12 rounded-xl bg-slate-900/90 border border-slate-800 text-lg font-bold text-white active:scale-95 transition-all hover:bg-slate-800"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-12 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-400 active:scale-95 transition-all"
                >
                  ⌫
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || pin.length < 4 || pin.length > 6}
                className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-base font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:pointer-events-none active:scale-98 transition-all mt-1"
              >
                <LogIn className="w-5 h-5" />
                <span>{isSubmitting ? 'Verifikasi...' : 'Masuk Aplikasi'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 text-center mt-8 font-medium">
        PWA Mobile-First • Dakota Karaoke Scoring
      </p>
    </div>
  );
}
