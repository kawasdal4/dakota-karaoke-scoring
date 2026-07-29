'use client';

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Ya, Simpan',
  cancelText = 'Batal',
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-[360px] glass-panel rounded-3xl p-6 border border-purple-500/40 shadow-2xl flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-400">
          <CheckCircle className="w-6 h-6 text-purple-400" />
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
