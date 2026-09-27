import React, { type ButtonHTMLAttributes } from 'react';

const tones = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 border-teal-600',
  secondary: 'bg-white text-slate-900 hover:bg-slate-50 border-slate-300',
  quiet: 'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent',
} as const;

export function Button({
  tone = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof tones;
}) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
