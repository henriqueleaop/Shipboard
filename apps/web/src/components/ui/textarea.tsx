import React, { type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-[var(--text)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--link)] focus:ring-2 focus:ring-blue-500/25 aria-invalid:border-[var(--danger)]',
        className,
      )}
      {...props}
    />
  );
}
