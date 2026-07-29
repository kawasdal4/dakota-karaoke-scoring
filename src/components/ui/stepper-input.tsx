'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface StepperInputProps {
  label: string;
  max: number;
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  error?: string;
}

export default function StepperInput({
  label,
  max,
  value,
  onChange,
  disabled = false,
  error,
}: StepperInputProps) {
  const handleDecrement = () => {
    if (disabled) return;
    if (value > 0) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (disabled) return;
    if (value < max) onChange(value + 1);
  };

  const handleDirectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const num = parseInt(e.target.value, 10);
    if (isNaN(num)) {
      onChange(0);
    } else if (num < 0) {
      onChange(0);
    } else if (num > max) {
      onChange(max);
    } else {
      onChange(num);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <span className="text-[11px] font-bold text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-full">
          Maks: {max}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 mt-1">
        {/* Decrement [-] Button - Min 56px height */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= 0}
          className="h-14 w-14 rounded-xl bg-slate-800/80 border border-purple-500/30 flex items-center justify-center text-purple-300 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md active:bg-purple-900/50"
          aria-label="Decrease score"
        >
          <Minus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Numeric Display & Input */}
        <div className="flex-1 h-14 rounded-xl bg-slate-950/80 border border-purple-500/40 flex items-center justify-center px-3 relative focus-within:ring-2 focus-within:ring-purple-500 shadow-inner">
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            max={max}
            value={value === 0 ? '0' : value}
            onChange={handleDirectChange}
            disabled={disabled}
            className="w-full h-full bg-transparent text-center text-2xl font-black text-white focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Increment [+] Button - Min 56px height */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="h-14 w-14 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 border border-purple-400/40 flex items-center justify-center text-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg shadow-purple-600/30 active:from-purple-700 active:to-blue-700"
          aria-label="Increase score"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {error && <span className="text-[11px] font-medium text-rose-400 mt-0.5">{error}</span>}
    </div>
  );
}
