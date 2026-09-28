import React, { type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-[var(--text)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--link)] focus:ring-2 focus:ring-blue-500/25 aria-invalid:border-[var(--danger)]',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
