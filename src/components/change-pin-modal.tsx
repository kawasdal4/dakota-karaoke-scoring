'use client';

import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { JudgeRole } from '@/types';
import { changePin } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: JudgeRole;
}

export default function ChangePinModal({ isOpen, onClose, currentRole }: ChangePinModalProps) {
  const { showToast } = useToast();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const res = await changePin(currentRole, oldPin, newPin, confirmPin);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Gagal mengubah PIN');
      return;
    }

    showToast('PIN berhasil diubah.', 'success');
    // Reset state & close
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-[400px] glass-panel rounded-3xl p-6 border border-purple-500/30 shadow-2xl flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-900/50 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Ubah PIN</h3>
              <p className="text-xs text-slate-400">Pengguna: <strong className="text-purple-300">{currentRole}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Old PIN */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">PIN Lama</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Masukkan PIN lama"
                className="w-full h-12 px-4 pr-10 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 tracking-widest"
                required
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New PIN */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">PIN Baru (4-6 angka)</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Masukkan PIN baru"
                className="w-full h-12 px-4 pr-10 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 tracking-widest"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New PIN */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Konfirmasi PIN Baru</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ketik ulang PIN baru"
                className="w-full h-12 px-4 pr-10 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 tracking-widest"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-12 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || newPin.length < 4 || newPin.length > 6}
              className="px-5 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-black shadow-lg shadow-purple-600/30 disabled:opacity-40"
            >
              {isSubmitting ? 'Simpan...' : 'Simpan PIN Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
